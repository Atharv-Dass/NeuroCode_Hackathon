import cv2
import numpy as np
import matplotlib.pyplot as plt
from scipy.fft import fft, fftfreq
from scipy.signal import windows
from collections import deque

import mediapipe as mp

from processing import (
    HandBuffer,
    compute_asymmetry,
    get_fps,
    TREMOR_LOW_HZ,
    TREMOR_HIGH_HZ,
    PD_RANGE,
    ET_RANGE,
)

# ====== CONFIG ======
WINDOW_SECONDS = 4        # length of rolling buffer
AMPLITUDE_THRESH = 0.5    # below this: "no significant tremor"
# =====================

mp_hands = mp.solutions.hands


def classify(freq_hz: float, amp_px: float) -> str:
    """Same idea as _classify, but tuned for live display."""
    if amp_px < AMPLITUDE_THRESH:
        return "No significant tremor"
    if 3.0 <= freq_hz <= 6.0:
        return "Low‑frequency tremor (3–6 Hz)"
    if 8.0 <= freq_hz <= 12.0:
        return "High‑frequency tremor (8–12 Hz)"
    return f"Tremor detected ({freq_hz:.1f} Hz)"


def fft_arrays_from_buffer(buf: HandBuffer):
    """Return (freqs, magnitudes) for plotting, limited to 0.5–15 Hz."""
    if not buf.ready():
        return np.array([]), np.array([])
    arr = np.array(buf.y_series, dtype=float)
    arr -= np.mean(arr)
    n = len(arr)
    win = windows.hann(n)
    spectrum = np.abs(fft(arr * win))[: n // 2]
    freqs = fftfreq(n, d=1.0 / buf.fps)[: n // 2]
    mags = spectrum / (n / 2)
    mask = (freqs >= 0.5) & (freqs <= 15.0)
    return freqs[mask], mags[mask]


def analyze_buffer(buf: HandBuffer):
    """Return freq, amp, label from a HandBuffer (for live use)."""
    if not buf.ready():
        return None
    arr = np.array(buf.y_series, dtype=float)
    arr -= np.mean(arr)
    n = len(arr)
    win = windows.hann(n)
    spectrum = np.abs(fft(arr * win))[: n // 2]
    freqs = fftfreq(n, d=1.0 / buf.fps)[: n // 2]
    mask = (freqs >= TREMOR_LOW_HZ) & (freqs <= TREMOR_HIGH_HZ)
    if not np.any(mask):
        return {"freq_hz": 0.0, "amplitude_px": 0.0, "label": "No tremor detected"}
    band = spectrum.copy()
    band[~mask] = 0
    peak_idx = int(np.argmax(band))
    peak_freq = float(freqs[peak_idx])
    peak_amp = float(band[peak_idx]) / (n / 2)
    return {
        "freq_hz": round(peak_freq, 2),
        "amplitude_px": round(peak_amp, 2),
        "label": classify(peak_freq, peak_amp),
    }


def main():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Could not open webcam.")
        return

    fps = get_fps(cap)
    print(f"Detected webcam FPS ≈ {fps:.1f}")
    buflen = int(fps * WINDOW_SECONDS)

    left_buf = HandBuffer(fps=fps, y_series=deque(maxlen=buflen))
    right_buf = HandBuffer(fps=fps, y_series=deque(maxlen=buflen))

    hands_model = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        min_detection_confidence=0.3,
        min_tracking_confidence=0.3,
    )

    # Matplotlib setup
    plt.ion()
    fig, (ax_l, ax_r) = plt.subplots(2, 1, figsize=(6, 6))
    line_l, = ax_l.plot([], [], color="tab:blue")
    line_r, = ax_r.plot([], [], color="tab:purple")
    ax_l.set_xlim(0, 15)
    ax_r.set_xlim(0, 15)
    ax_l.set_ylim(0, 1)
    ax_r.set_ylim(0, 1)
    ax_l.set_title("Left Hand FFT")
    ax_r.set_title("Right Hand FFT")
    ax_l.set_xlabel("Hz")
    ax_r.set_xlabel("Hz")
    ax_l.set_ylabel("Amplitude")
    ax_r.set_ylabel("Amplitude")
    fig.tight_layout()

    print("Press 'q' in the video window to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands_model.process(rgb)

        # Update buffers
        if results.multi_hand_landmarks and results.multi_handedness:
            for lm, handedness in zip(results.multi_hand_landmarks,
                                      results.multi_handedness):
                side = handedness.classification[0].label  # "Left" or "Right"
                y_px = lm.landmark[8].y * h
                if side == "Left":
                    left_buf.add(y_px)
                else:
                    right_buf.add(y_px)
                # Draw landmarks on frame
                mp.solutions.drawing_utils.draw_landmarks(
                    frame, lm, mp_hands.HAND_CONNECTIONS
                )

        # Compute metrics if ready
        left_res = analyze_buffer(left_buf)
        right_res = analyze_buffer(right_buf)
        asym = compute_asymmetry(left_res, right_res)

        # Overlay text on video
        overlay = frame.copy()
        y0 = 30
        dy = 25

        def put(text, y, color=(255, 255, 255)):
            cv2.putText(
                overlay,
                text,
                (10, y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2,
                cv2.LINE_AA,
            )

        if left_res:
            put(
                f"L: {left_res['freq_hz']} Hz | amp {left_res['amplitude_px']} px",
                y0,
                (255, 200, 0),
            )
            put(f"   {left_res['label']}", y0 + dy, (255, 200, 0))
        else:
            put("L: Not enough data yet", y0, (180, 180, 180))

        if right_res:
            put(
                f"R: {right_res['freq_hz']} Hz | amp {right_res['amplitude_px']} px",
                y0 + 2 * dy,
                (0, 200, 255),
            )
            put(f"   {right_res['label']}", y0 + 3 * dy, (0, 200, 255))
        else:
            put("R: Not enough data yet", y0 + 2 * dy, (180, 180, 180))

        if asym:
            sign = "+" if asym["value"] > 0 else ""
            put(
                f"AI: {sign}{asym['value']}  ({asym['percent']}%)  {asym['dominant']}-dominant",
                y0 + 4 * dy,
                (0, 255, 0) if abs(asym["value"]) < 0.2 else (0, 0, 255),
            )

        alpha = 0.8
        frame_disp = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)

        cv2.imshow("Live Tremor View (press q to quit)", frame_disp)

        # Update FFT plots
        f_l, m_l = fft_arrays_from_buffer(left_buf)
        f_r, m_r = fft_arrays_from_buffer(right_buf)

        if len(f_l):
            line_l.set_data(f_l, m_l)
            ax_l.set_ylim(0, max(m_l) * 1.2)
        if len(f_r):
            line_r.set_data(f_r, m_r)
            ax_r.set_ylim(0, max(m_r) * 1.2)

        fig.canvas.draw()
        fig.canvas.flush_events()

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    hands_model.close()
    cv2.destroyAllWindows()
    plt.ioff()
    plt.close(fig)


if __name__ == "__main__":
    main()