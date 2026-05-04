import sys
import cv2
import matplotlib.pyplot as plt

from collections import deque

import mediapipe as mp

from processing import (
    HandBuffer,
    compute_asymmetry,
    get_fps,
    get_fft_arrays,   # make sure this exists in processing.py
)

mp_hands = mp.solutions.hands

# How much history to keep per hand (seconds) – should match BUFFER_SECONDS in processing.py
WINDOW_SECONDS = 4


def put_text(overlay, text, y, color):
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


def main():
    if len(sys.argv) < 2:
        print("Usage: py -3.11 video_tremor_view.py <video_path>")
        sys.exit(1)

    video_path = sys.argv[1]
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"ERROR: Could not open video: {video_path}")
        sys.exit(1)

    fps = get_fps(cap)
    print(f"Video FPS ≈ {fps:.1f}")
    buflen = int(fps * WINDOW_SECONDS)

    # These HandBuffers use the same analyze() logic as test_processing.py
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

    for ax in (ax_l, ax_r):
        ax.set_xlim(0, 15)
        ax.set_ylim(0, 1)
        ax.set_xlabel("Frequency (Hz)")
        ax.set_ylabel("Amplitude")

    ax_l.set_title("Left Hand FFT")
    ax_r.set_title("Right Hand FFT")
    fig.tight_layout()

    print("Press 'q' in the video window to quit early.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands_model.process(rgb)

        # Update buffers exactly like analyze_video does
        if results.multi_hand_landmarks and results.multi_handedness:
            for lm, handedness in zip(results.multi_hand_landmarks,
                                      results.multi_handedness):
                side = handedness.classification[0].label  # "Left" or "Right"
                y_px = lm.landmark[8].y * h
                if side == "Left":
                    left_buf.add(y_px)
                else:
                    right_buf.add(y_px)

                mp.solutions.drawing_utils.draw_landmarks(
                    frame, lm, mp_hands.HAND_CONNECTIONS
                )

        # Use the SAME analyze() as test_processing.py
        left_res = left_buf.analyze()
        right_res = right_buf.analyze()
        asym = compute_asymmetry(left_res, right_res)

        overlay = frame.copy()
        y0 = 30
        dy = 25

        if left_res:
            put_text(
                overlay,
                f"L: {left_res['freq_hz']} Hz | amp {left_res['amplitude_px']} px",
                y0,
                (255, 200, 0),
            )
            put_text(overlay, f"   {left_res['label']}", y0 + dy, (255, 200, 0))
        else:
            put_text(overlay, "L: Not enough data yet", y0, (180, 180, 180))

        if right_res:
            put_text(
                overlay,
                f"R: {right_res['freq_hz']} Hz | amp {right_res['amplitude_px']} px",
                y0 + 2 * dy,
                (0, 200, 255),
            )
            put_text(overlay, f"   {right_res['label']}", y0 + 3 * dy, (0, 200, 255))
        else:
            put_text(overlay, "R: Not enough data yet", y0 + 2 * dy, (180, 180, 180))

        if asym:
            sign = "+" if asym["value"] > 0 else ""
            color = (0, 255, 0) if abs(asym["value"]) < 0.2 else (0, 0, 255)
            put_text(
                overlay,
                f"AI: {sign}{asym['value']} ({asym['percent']}%) {asym['dominant']}-dominant",
                y0 + 4 * dy,
                color,
            )

        alpha = 0.8
        frame_disp = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)
        cv2.imshow("Video Tremor View (press q to quit)", frame_disp)

        # FFT plots using get_fft_arrays from processing.py
        f_l, m_l = get_fft_arrays(left_buf)
        f_r, m_r = get_fft_arrays(right_buf)

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
    print("Done.")


if __name__ == "__main__":
    main()