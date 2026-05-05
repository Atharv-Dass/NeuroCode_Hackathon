import cv2
import numpy as np
from scipy.fft import fft, fftfreq
from scipy.signal import windows
from collections import deque
from dataclasses import dataclass, field
from typing import Optional

import mediapipe as mp

TREMOR_LOW_HZ  = 3.0
TREMOR_HIGH_HZ = 12.0
PD_RANGE       = (3.0, 7.0)
ET_RANGE       = (7.0, 12.0)
BUFFER_SECONDS = 4
LANDMARK_IDX   = 8

mp_hands = mp.solutions.hands


@dataclass
class HandBuffer:
    fps: float
    max_frames: int = 120

    def __post_init__(self):
        self.y_series: deque = deque(maxlen=self.max_frames)

    def add(self, y_value: float):
        self.y_series.append(y_value)

    def ready(self) -> bool:
        min_needed = max(int(self.fps * 1.5), 20)   # lowered floor for live recordings
        return len(self.y_series) >= min_needed

    def analyze(self) -> Optional[dict]:
        if not self.ready():
            return None

        arr = np.array(self.y_series, dtype=float)
        arr -= np.mean(arr)

        if arr.max() - arr.min() < 1.0:
            return {
                "freq_hz":      0.0,
                "amplitude_px": 0.0,
                "label":        "No significant tremor",
            }

        n = len(arr)
        win = windows.hann(n)
        spectrum = np.abs(fft(arr * win))[: n // 2]
        freqs = fftfreq(n, d=1.0 / self.fps)[: n // 2]

        mask = (freqs >= TREMOR_LOW_HZ) & (freqs <= TREMOR_HIGH_HZ)
        if not np.any(mask):
            return {"freq_hz": 0.0, "amplitude_px": 0.0,
                    "label": "No tremor detected"}

        band = spectrum.copy()
        band[~mask] = 0
        peak_idx  = int(np.argmax(band))
        peak_freq = float(freqs[peak_idx])
        peak_amp  = float(band[peak_idx]) / (n / 2)

        return {
            "freq_hz":      round(peak_freq, 2),
            "amplitude_px": round(peak_amp,  2),
            "label":        _classify(peak_freq, peak_amp),
        }


def _classify(freq_hz: float, amp_px: float) -> str:
    if amp_px < 0.15:
        return "No significant tremor"
    if PD_RANGE[0] <= freq_hz <= PD_RANGE[1]:
        return "Parkinsonian Range (3–7 Hz)"
    if ET_RANGE[0] < freq_hz <= ET_RANGE[1]:
        return "Essential Tremor Range (7–12 Hz)"
    return f"Tremor detected ({freq_hz:.1f} Hz)"


def compute_asymmetry(
    left: Optional[dict], right: Optional[dict]
) -> Optional[dict]:
    if left is None or right is None:
        return None
    L, R = left["amplitude_px"], right["amplitude_px"]
    eps = 1e-6
    ai = (L - R) / (L + R + eps)
    return {
        "value":    round(ai, 3),
        "percent":  round(abs(ai) * 100, 1),
        "dominant": ("Left" if ai > 0 else "Right")
                    if abs(ai) > 0.05 else "Symmetric",
    }


def get_fps(cap: cv2.VideoCapture, default: float = 30.0) -> float:
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 0 or fps > 120:
        return default
    return fps


def convert_webm_to_mp4(input_path: str) -> Optional[str]:
    import subprocess
    output_path = input_path.rsplit(".", 1)[0] + "_converted.mp4"
    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", input_path,
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-an",
                output_path,
            ],
            check=True,
            capture_output=True,
        )
        return output_path
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def analyze_video(video_path: str) -> dict:
    working_path = video_path
    converted_path: Optional[str] = None

    if video_path.lower().endswith(".webm"):
        converted = convert_webm_to_mp4(video_path)
        if converted:
            working_path   = converted
            converted_path = converted

    cap = cv2.VideoCapture(working_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {working_path}")

    fps     = get_fps(cap)
    buflen  = int(fps * BUFFER_SECONDS)
    left_buf  = HandBuffer(fps=fps, max_frames=buflen)   # ← fixed: pass buflen
    right_buf = HandBuffer(fps=fps, max_frames=buflen)   # ← fixed: pass buflen

    hands_model = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame_count += 1

        h, w = frame.shape[:2]
        rgb  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands_model.process(rgb)

        if results.multi_hand_landmarks and results.multi_handedness:
            for lm, handedness in zip(
                results.multi_hand_landmarks, results.multi_handedness
            ):
                side = handedness.classification[0].label

                wrist_y  = float(np.clip(lm.landmark[0].y,            0.0, 1.0))
                finger_y = float(np.clip(lm.landmark[LANDMARK_IDX].y, 0.0, 1.0))
                rel_y_px = (finger_y - wrist_y) * h

                if side == "Left":
                    left_buf.add(rel_y_px)
                else:
                    right_buf.add(rel_y_px)

    cap.release()
    hands_model.close()

    if converted_path:
        import os
        try:
            os.unlink(converted_path)
        except OSError:
            pass

    left_result  = left_buf.analyze()
    right_result = right_buf.analyze()
    asym         = compute_asymmetry(left_result, right_result)

    freqs_left,  mags_left  = get_fft_arrays(left_buf)
    freqs_right, mags_right = get_fft_arrays(right_buf)

    print(
        f"[analyze_video] frames={frame_count} fps={fps:.1f} "
        f"left_frames={len(left_buf.y_series)} "
        f"right_frames={len(right_buf.y_series)} "
        f"left={left_result} right={right_result}"
    )

    return {
        "frames_processed": frame_count,
        "fps":              fps,
        "left":             left_result,
        "right":            right_result,
        "asymmetry":        asym,
        "left_spectrum":  {"freqs": freqs_left.tolist(),  "mags": mags_left.tolist()},
        "right_spectrum": {"freqs": freqs_right.tolist(), "mags": mags_right.tolist()},
    }


def get_fft_arrays(buf: HandBuffer):
    min_needed = max(int(buf.fps * 1.5), 20)   # ← lowered threshold
    if len(buf.y_series) < min_needed:
        return np.array([]), np.array([])
    arr = np.array(buf.y_series, dtype=float)
    arr -= np.mean(arr)
    n   = len(arr)
    win = windows.hann(n)
    spectrum = np.abs(fft(arr * win))[: n // 2]
    freqs    = fftfreq(n, d=1.0 / buf.fps)[: n // 2]
    mags     = spectrum / (n / 2)
    mask     = (freqs >= 0.5) & (freqs <= 15.0)
    return freqs[mask], mags[mask]