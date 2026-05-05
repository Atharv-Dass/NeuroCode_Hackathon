import sys
import numpy as np
import matplotlib.pyplot as plt

from processing import analyze_video


def _format_result(label, res):
    if res is None:
        return f"{label}: no tremor detected"

    return (
        f"{label}: {res['freq_hz']:.2f} Hz, "
        f"{res['amplitude_px']:.2f} px, "
        f"{res['label']}"
    )


def _percent_change(before, after):
    if before == 0:
        return np.nan
    return 100.0 * (after - before) / before


def compare_videos(path_before: str, path_after: str):
    print(f"[INFO] Analyzing BEFORE video: {path_before}")
    res_before = analyze_video(path_before)
    print(f"[INFO] Analyzing AFTER video:  {path_after}")
    res_after  = analyze_video(path_after)

    lb, rb = res_before["left"],  res_before["right"]
    la, ra = res_after["left"],   res_after["right"]

    print("\n=== NUMERIC SUMMARY ===")
    print("BEFORE:")
    print("  " + _format_result("Left ", lb))
    print("  " + _format_result("Right", rb))
    print("\nAFTER:")
    print("  " + _format_result("Left ", la))
    print("  " + _format_result("Right", ra))

    if lb is not None and la is not None:
        d_amp_L = _percent_change(lb["amplitude_px"], la["amplitude_px"])
        d_freq_L = _percent_change(lb["freq_hz"], la["freq_hz"])
        print(
            f"\nLeft hand change after medication: "
            f"ΔAmp = {la['amplitude_px'] - lb['amplitude_px']:+.2f} px "
            f"({d_amp_L:+.1f}%), "
            f"ΔFreq = {la['freq_hz'] - lb['freq_hz']:+.2f} Hz "
            f"({d_freq_L:+.1f}%)"
        )

    if rb is not None and ra is not None:
        d_amp_R = _percent_change(rb["amplitude_px"], ra["amplitude_px"])
        d_freq_R = _percent_change(rb["freq_hz"], ra["freq_hz"])
        print(
            f"Right hand change after medication: "
            f"ΔAmp = {ra['amplitude_px'] - rb['amplitude_px']:+.2f} px "
            f"({d_amp_R:+.1f}%), "
            f"ΔFreq = {ra['freq_hz'] - rb['freq_hz']:+.2f} Hz "
            f"({d_freq_R:+.1f}%)"
        )

    # --- Graph comparison: overlay FFT spectra ---
    ls_b = res_before["left_spectrum"]
    rs_b = res_before["right_spectrum"]
    ls_a = res_after["left_spectrum"]
    rs_a = res_after["right_spectrum"]

    f_lb = np.array(ls_b["freqs"], dtype=float)
    m_lb = np.array(ls_b["mags"], dtype=float)
    f_la = np.array(ls_a["freqs"], dtype=float)
    m_la = np.array(ls_a["mags"], dtype=float)

    f_rb = np.array(rs_b["freqs"], dtype=float)
    m_rb = np.array(rs_b["mags"], dtype=float)
    f_ra = np.array(rs_a["freqs"], dtype=float)
    m_ra = np.array(rs_a["mags"], dtype=float)

    plt.figure(figsize=(10, 5))

    # Left hand
    plt.subplot(1, 2, 1)
    if f_lb.size > 0:
        plt.plot(f_lb, m_lb, label="Before", color="tab:blue")
    if f_la.size > 0:
        plt.plot(f_la, m_la, label="After",  color="tab:orange")
    plt.title("Left Hand FFT (0.5–15 Hz)")
    plt.xlabel("Frequency [Hz]")
    plt.ylabel("Amplitude [px]")
    plt.legend()
    plt.grid(alpha=0.3)

    # Right hand
    plt.subplot(1, 2, 2)
    if f_rb.size > 0:
        plt.plot(f_rb, m_rb, label="Before", color="tab:blue")
    if f_ra.size > 0:
        plt.plot(f_ra, m_ra, label="After",  color="tab:orange")
    plt.title("Right Hand FFT (0.5–15 Hz)")
    plt.xlabel("Frequency [Hz]")
    plt.ylabel("Amplitude [px]")
    plt.legend()
    plt.grid(alpha=0.3)

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: py -3.11 compare_medication.py <before_video> <after_video>")
        sys.exit(1)

    compare_videos(sys.argv[1], sys.argv[2])