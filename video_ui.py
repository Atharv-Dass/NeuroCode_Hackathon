import sys
from collections import deque

import cv2
import numpy as np
import mediapipe as mp

from processing import HandBuffer, compute_asymmetry, get_fps, get_fft_arrays

# Reuse same colour palette and thresholds as live UI
_CLR = {
    "bg_panel":   (18,  18,  18),
    "border":     (60,  60,  60),
    "header":     (240, 200, 80),
    "label_left": (80,  220, 160),
    "label_right":(100, 160, 255),
    "ok":         (60,  230, 100),
    "warn":       (50,  180, 255),
    "alert":      (60,   60, 220),
    "white":      (240, 240, 240),
    "dim":        (120, 120, 120),
    "bar_left":   (80,  220, 160),
    "bar_right":  (100, 160, 255),
    "bar_bg":     (50,   50,  50),
}

_THRESH_WARN  = 4.0   # Hz
_THRESH_ALERT = 7.0   # Hz

WINDOW_SECONDS = 4.0
mp_hands = mp.solutions.hands


def _draw_rounded_rect(
    img: np.ndarray,
    x1: int, y1: int, x2: int, y2: int,
    radius: int,
    fill: tuple,
    border: tuple = None,
    border_thickness: int = 1
) -> None:
    cv2.rectangle(img, (x1 + radius, y1), (x2 - radius, y2), fill, -1)
    cv2.rectangle(img, (x1, y1 + radius), (x2, y2 - radius), fill, -1)
    for cx, cy in [(x1+radius, y1+radius), (x2-radius, y1+radius),
                   (x1+radius, y2-radius), (x2-radius, y2-radius)]:
        cv2.circle(img, (cx, cy), radius, fill, -1)
    if border:
        cv2.rectangle(img, (x1, y1), (x2, y2), border, border_thickness)


def _hz_colour(hz: float) -> tuple:
    if hz >= _THRESH_ALERT:
        return _CLR["alert"]
    if hz >= _THRESH_WARN:
        return _CLR["warn"]
    return _CLR["ok"]


def _put_text(
    img: np.ndarray, text: str, x: int, y: int,
    colour: tuple, scale: float = 0.55, thickness: int = 1
) -> None:
    cv2.putText(img, text, (x, y),
                cv2.FONT_HERSHEY_DUPLEX, scale, colour, thickness,
                cv2.LINE_AA)


def _draw_spectrum(
    img: np.ndarray,
    freqs: np.ndarray,
    mags: np.ndarray,
    x: int, y: int, w: int, h: int,
    colour: tuple
) -> None:
    if freqs.size < 2 or mags.size < 2:
        return

    f_min, f_max = float(freqs.min()), float(freqs.max())
    m_min, m_max = 0.0, float(mags.max())
    span_f = f_max - f_min if f_max > f_min else 1.0
    span_m = m_max - m_min if m_max > m_min else 1.0

    pts = []
    for f, m in zip(freqs, mags):
        px = x + int((f - f_min) / span_f * w)
        py = y + h - int((m - m_min) / span_m * h)
        py = int(np.clip(py, y, y + h))
        pts.append((px, py))

    pts_arr = np.array(pts, dtype=np.int32).reshape(-1, 1, 2)
    cv2.polylines(img, [pts_arr], False, colour, 1, cv2.LINE_AA)


def _draw_amplitude_bar(
    img: np.ndarray,
    x: int, y: int, bar_w: int, bar_h: int,
    amplitude: float, max_amp: float,
    colour: tuple
) -> None:
    fill_ratio = float(np.clip(amplitude / max(max_amp, 1.0), 0.0, 1.0))
    fill_h = int(bar_h * fill_ratio)
    cv2.rectangle(img, (x, y), (x + bar_w, y + bar_h), _CLR["bar_bg"], -1)
    if fill_h > 0:
        cv2.rectangle(
            img,
            (x, y + bar_h - fill_h),
            (x + bar_w, y + bar_h),
            colour, -1
        )
    cv2.rectangle(img, (x, y), (x + bar_w, y + bar_h), _CLR["border"], 1)


def _render_hud(
    frame: np.ndarray,
    results_left: dict,
    results_right: dict,
    spec_left: tuple,
    spec_right: tuple,
    fps: float,
    frame_count: int
) -> None:
    H, W = frame.shape[:2]
    panel_w, panel_h = 280, 210

    # Left panel
    overlay = frame.copy()
    _draw_rounded_rect(overlay, 10, 10, 10 + panel_w, 10 + panel_h,
                       10, _CLR["bg_panel"])
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

    # Right panel
    rx = W - panel_w - 10
    overlay2 = frame.copy()
    _draw_rounded_rect(overlay2, rx, 10, rx + panel_w, 10 + panel_h,
                       10, _CLR["bg_panel"])
    cv2.addWeighted(overlay2, 0.75, frame, 0.25, 0, frame)

    # LEFT content
    lhz    = results_left["peak_hz"]
    lamp   = results_left["amplitude"]
    lclr   = _CLR["label_left"]
    lhclr  = _hz_colour(lhz)
    l_label = results_left.get("label", "No tremor")

    _put_text(frame, "LEFT HAND",          20, 35,  lclr,  scale=0.6, thickness=2)
    _put_text(frame, "Peak Freq",          20, 65,  _CLR["dim"])
    _put_text(frame, f"{lhz:>6.2f} Hz",   20, 92,  lhclr, scale=0.9, thickness=2)
    _put_text(frame, "Amplitude",          20, 120, _CLR["dim"])
    _put_text(frame, f"{lamp:>7.2f} px",  20, 147, lclr,  scale=0.85, thickness=1)

    if "Parkinsonian" in l_label:
        sev_clr = _CLR["alert"]
    elif "Essential" in l_label:
        sev_clr = _CLR["warn"]
    elif "No significant" in l_label or "No tremor" in l_label:
        sev_clr = _CLR["dim"]
    else:
        sev_clr = _CLR["ok"]
    _put_text(frame, l_label, 20, 175, sev_clr, scale=0.5, thickness=1)

    _draw_amplitude_bar(frame, 235, 30, 30, 165, lamp, 5.0, lclr)

    # RIGHT content
    rhz    = results_right["peak_hz"]
    ramp   = results_right["amplitude"]
    rclr   = _CLR["label_right"]
    rhclr  = _hz_colour(rhz)
    r_label = results_right.get("label", "No tremor")

    _put_text(frame, "RIGHT HAND",             rx + 10, 35,  rclr,  scale=0.6, thickness=2)
    _put_text(frame, "Peak Freq",              rx + 10, 65,  _CLR["dim"])
    _put_text(frame, f"{rhz:>6.2f} Hz",       rx + 10, 92,  rhclr, scale=0.9, thickness=2)
    _put_text(frame, "Amplitude",              rx + 10, 120, _CLR["dim"])
    _put_text(frame, f"{ramp:>7.2f} px",      rx + 10, 147, rclr,  scale=0.85, thickness=1)

    if "Parkinsonian" in r_label:
        sev_clr = _CLR["alert"]
    elif "Essential" in r_label:
        sev_clr = _CLR["warn"]
    elif "No significant" in r_label or "No tremor" in r_label:
        sev_clr = _CLR["dim"]
    else:
        sev_clr = _CLR["ok"]
    _put_text(frame, r_label, rx + 10, 175, sev_clr, scale=0.5, thickness=1)

    _draw_amplitude_bar(frame, rx + 235, 30, 30, 165, ramp, 5.0, rclr)

    # FFT spectra
    freqs_left, mags_left   = spec_left
    freqs_right, mags_right = spec_right

    wf_y  = H - 100
    wf_h  = 70
    wf_w  = W - 40

    ov3 = frame.copy()
    cv2.rectangle(ov3, (20, wf_y - 10), (20 + wf_w, wf_y + wf_h + 10),
                  _CLR["bg_panel"], -1)
    cv2.addWeighted(ov3, 0.70, frame, 0.30, 0, frame)

    _put_text(frame, "FFT SPECTRUM (0.5–15 Hz)", 28, wf_y + 5, _CLR["dim"], scale=0.38)

    mid = 20 + wf_w // 2
    _draw_spectrum(frame, freqs_left,  mags_left,
                   20,   wf_y + 15, wf_w // 2 - 10, wf_h - 10,
                   _CLR["bar_left"])
    _draw_spectrum(frame, freqs_right, mags_right,
                   mid,  wf_y + 15, wf_w // 2 - 10, wf_h - 10,
                   _CLR["bar_right"])

    cv2.line(frame, (mid, wf_y + 10), (mid, wf_y + wf_h + 5), _CLR["border"], 1)
    _put_text(frame, "L", 25,    wf_y + 25, _CLR["bar_left"],  scale=0.38)
    _put_text(frame, "R", mid+5, wf_y + 25, _CLR["bar_right"], scale=0.38)

    title = "BILATERAL TREMOR QUANTIFIER"
    ts, _ = cv2.getTextSize(title, cv2.FONT_HERSHEY_DUPLEX, 0.55, 1)
    tx = (W - ts[0]) // 2
    _put_text(frame, title, tx, 28, _CLR["header"], scale=0.55, thickness=1)

    _put_text(frame, f"FPS: {fps:5.1f}", W - 130, H - 15, _CLR["dim"], scale=0.42)
    _put_text(frame, f"Frame: {frame_count:06d}", W - 130, H - 32,
              _CLR["dim"], scale=0.42)

    _put_text(frame, "[Q] Quit", 20, H - 15, _CLR["dim"], scale=0.38)


def run_video(video_path: str) -> None:
    print(f"[INFO] Opening video: {video_path}")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video: {video_path}")
        return

    fps_est = get_fps(cap) or 30.0
    buflen  = int(fps_est * WINDOW_SECONDS)

    left_buf  = HandBuffer(fps=fps_est, y_series=deque(maxlen=buflen))
    right_buf = HandBuffer(fps=fps_est, y_series=deque(maxlen=buflen))

    hands_model = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        min_detection_confidence=0.3,
        min_tracking_confidence=0.3,
    )

    ret, frame = cap.read()
    if not ret or frame is None:
        print("[ERROR] Empty or unreadable video.")
        cap.release()
        return
    H, W = frame.shape[:2]

    cv2.namedWindow("TremorQuant Video", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("TremorQuant Video", W, H)

    frame_count = 0
    fps = fps_est
    print("[INFO] Video tremor view running. Press Q or Esc to quit.")

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                print("[INFO] End of video.")
                break
            frame_count += 1

            h, w = frame.shape[:2]
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands_model.process(rgb)

            detected_labels = set()
            if results.multi_hand_landmarks and results.multi_handedness:
                for lm, handedness in zip(results.multi_hand_landmarks,
                                          results.multi_handedness):
                    side = handedness.classification[0].label
                    if side in detected_labels:
                        continue
                    detected_labels.add(side)

                    # Relative motion: fingertip − wrist
                    wrist_y  = float(np.clip(lm.landmark[0].y, 0.0, 1.0))
                    finger_y = float(np.clip(lm.landmark[8].y, 0.0, 1.0))
                    rel_y_px = (finger_y - wrist_y) * h

                    if side == "Left":
                        left_buf.add(rel_y_px)
                    else:
                        right_buf.add(rel_y_px)

                    mp.solutions.drawing_utils.draw_landmarks(
                        frame, lm, mp_hands.HAND_CONNECTIONS
                    )

            left_res  = left_buf.analyze()
            right_res = right_buf.analyze()
            asym      = compute_asymmetry(left_res, right_res)

            def res_to_ui(res):
                if res is None:
                    return {"peak_hz": 0.0, "amplitude": 0.0, "label": "No tremor"}
                return {
                    "peak_hz":   res["freq_hz"],
                    "amplitude": res["amplitude_px"],
                    "label":     res.get("label", "No tremor"),
                }

            ui_left  = res_to_ui(left_res)
            ui_right = res_to_ui(right_res)

            freqs_left, mags_left   = get_fft_arrays(left_buf)
            freqs_right, mags_right = get_fft_arrays(right_buf)

            _render_hud(
                frame,
                ui_left, ui_right,
                (freqs_left, mags_left),
                (freqs_right, mags_right),
                fps, frame_count
            )

            if asym:
                txt = f"AI: {asym['value']:+.3f} ({asym['percent']:.1f}%) {asym['dominant']}"
                _put_text(frame, txt, 20, 60, _CLR["white"], scale=0.45)

            cv2.imshow("TremorQuant Video", frame)

            delay = int(1000 / fps_est)
            if delay < 1:
                delay = 1
            key = cv2.waitKey(delay) & 0xFF
            if key in (ord('q'), ord('Q'), 27):
                print("[INFO] Quit key pressed.")
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()
        hands_model.close()
        print("[INFO] Video UI stopped cleanly.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: py -3.11 video_ui.py <video_path>")
        sys.exit(1)
    run_video(sys.argv[1])