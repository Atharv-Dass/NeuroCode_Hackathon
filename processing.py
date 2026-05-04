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
LANDMARK_IDX   = 8   # index fingertip

mp_hands = mp.solutions.hands


@dataclass
class HandBuffer:
    fps: float
    y_series: deque = field(default_factory=lambda: deque(maxlen=120))

    def add(self, y_pixel: float):
        self.y_series.append(y_pixel)

    def ready(self) -> bool:
        return len(self.y_series) >= int(self.fps * 2)

    def analyze(self) -> Optional[dict]:
        if not self.ready():
            return None

        arr = np.array(self.y_series, dtype=float)
        arr -= np.mean(arr)

        n = len(arr)
        win = windows.hann(n)
        spectrum = np.abs(fft(arr * win))[: n // 2]
        freqs = fftfreq(n, d=1.0 / self.fps)[: n // 2]

        mask = (freqs >= TREMOR_LOW_HZ) & (freqs <= TREMOR_HIGH_HZ)
        if not np.any(mask):
            return {"freq_hz": 0.0, "amplitude_px": 0.0, "label": "No tremor detected"}

        band = spectrum.copy()
        band[~mask] = 0
        peak_idx = int(np.argmax(band))
        peak_freq = float(freqs[peak_idx])
        peak_amp = float(band[peak_idx]) / (n / 2)

        return {
            "freq_hz":      round(peak_freq, 2),
            "amplitude_px": round(peak_amp,  2),
            "label":        _classify(peak_freq, peak_amp),
        }


def _classify(freq_hz: float, amp_px: float) -> str:
    if amp_px < 0.2:
        return "No significant tremor"
    if PD_RANGE[0] <= freq_hz <= PD_RANGE[1]:
        return "Parkinsonian Range (3–7 Hz)"
    if ET_RANGE[0] < freq_hz <= ET_RANGE[1]:
        return "Essential Tremor Range (7–12 Hz)"
    return f"Tremor detected ({freq_hz:.1f} Hz)"


def compute_asymmetry(left: Optional[dict], right: Optional[dict]) -> Optional[dict]:
    if left is None or right is None:
        return None
    L, R = left["amplitude_px"], right["amplitude_px"]
    eps = 1e-6
    ai = (L - R) / (L + R + eps)
    return {
        "value":    round(ai, 3),
        "percent":  round(abs(ai) * 100, 1),
        "dominant": ("Left" if ai > 0 else "Right") if abs(ai) > 0.05 else "Symmetric",
    }


def get_fps(cap: cv2.VideoCapture, default: float = 30.0) -> float:
    fps = cap.get(cv2.CAP_PROP_FPS)
    return fps if fps and fps > 0 else default


def analyze_video(video_path: str) -> dict:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    fps = get_fps(cap)
    buflen = int(fps * BUFFER_SECONDS)
    left_buf  = HandBuffer(fps=fps, y_series=deque(maxlen=buflen))
    right_buf = HandBuffer(fps=fps, y_series=deque(maxlen=buflen))

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
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands_model.process(rgb)

        if results.multi_hand_landmarks and results.multi_handedness:
            for lm, handedness in zip(results.multi_hand_landmarks,
                                      results.multi_handedness):
                side = handedness.classification[0].label  # "Left" or "Right"
                y_px = lm.landmark[LANDMARK_IDX].y * h
                if side == "Left":
                    left_buf.add(y_px)
                else:
                    right_buf.add(y_px)

    cap.release()
    hands_model.close()

    left_result  = left_buf.analyze()
    right_result = right_buf.analyze()
    asym         = compute_asymmetry(left_result, right_result)

    return {
        "frames_processed": frame_count,
        "fps": fps,
        "left": left_result,
        "right": right_result,
        "asymmetry": asym,
    }

from scipy.fft import fft, fftfreq
from scipy.signal import windows
import numpy as np

def get_fft_arrays(buf: HandBuffer):
    """
    Return (freqs, magnitudes) for plotting, using the same
    detrend + Hann window + normalization as analyze().
    """
    if not buf.ready():
        return np.array([]), np.array([])
    arr = np.array(buf.y_series, dtype=float)
    arr -= np.mean(arr)
    n = len(arr)
    win = windows.hann(n)
    spectrum = np.abs(fft(arr * win))[: n // 2]
    freqs = fftfreq(n, d=1.0 / buf.fps)[: n // 2]
    mags = spectrum / (n / 2)
    # Restrict to a useful band for display
    mask = (freqs >= 0.5) & (freqs <= 15.0)
    return freqs[mask], mags[mask]