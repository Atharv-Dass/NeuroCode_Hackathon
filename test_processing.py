#!/usr/bin/env python3
"""
Tremor pipeline test — no UI, results printed to terminal.

Usage:
    python test_processing.py <path_to_video.mp4>

Example:
    python test_processing.py videos/pd_patient_01.mp4
"""

import sys
from processing import analyze_video

DIVIDER = "-" * 52

def print_hand(side: str, result):
    if result:
        print(f"  Dominant freq  : {result['freq_hz']} Hz")
        print(f"  Amplitude      : {result['amplitude_px']} px")
        print(f"  Classification : {result['label']}")
    else:
        print("  Not detected in video")
        print("  (tip: ensure the hand is clearly visible and well-lit)")

def main():
    if len(sys.argv) < 2:
        print("Usage: python test_processing.py <video_path>")
        print("Example: python test_processing.py myvideo.mp4")
        sys.exit(1)

    video_path = sys.argv[1]
    print(f"\nAnalysing: {video_path}")
    print(DIVIDER)

    try:
        result = analyze_video(video_path)
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    print(f"Frames processed : {result['frames_processed']}")
    print(f"Detected FPS     : {result['fps']:.1f}")
    print()

    print("LEFT HAND")
    print_hand("left", result["left"])
    print()

    print("RIGHT HAND")
    print_hand("right", result["right"])
    print()

    print("ASYMMETRY INDEX")
    asym = result["asymmetry"]
    if asym:
        sign = "+" if asym["value"] > 0 else ""
        print(f"  Value          : {sign}{asym['value']}")
        print(f"  Dominant side  : {asym['dominant']}")
        print(f"  Asymmetry      : {asym['percent']}%")
        if asym["percent"] > 20:
            print("  >>> Significant asymmetry (>20%) — consistent with Parkinsonian onset")
        else:
            print("  >>> Within symmetric range (<20%)")
    else:
        print("  Cannot compute — need both hands detected")

    print()
    print(DIVIDER)
    print("Done.")

if __name__ == "__main__":
    main()
