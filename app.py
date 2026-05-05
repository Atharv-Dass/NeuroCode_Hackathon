from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import Optional
from pathlib import Path
import shutil
import uuid
import json
import cv2
import mediapipe as mp
from collections import deque
from scipy.fft import fft, fftfreq
from scipy.signal import windows
import numpy as np

from processing import analyze_video, convert_webm_to_mp4


app = FastAPI(title="OBT Quantifier API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

SESSIONS_FILE = Path("sessions.json")

mp_hands_module   = mp.solutions.hands
mp_drawing        = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles


# ── Session persistence ───────────────────────────────────────────────────────

def _load_sessions() -> list[dict]:
    if SESSIONS_FILE.exists():
        try:
            return json.loads(SESSIONS_FILE.read_text())
        except Exception:
            return []
    return []

def _save_sessions(sessions: list[dict]):
    SESSIONS_FILE.write_text(json.dumps(sessions, indent=2))

SESSIONS: list[dict] = _load_sessions()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_response(result: dict) -> dict:
    left  = result.get("left")  or {"freq_hz": 0.0, "amplitude_px": 0.0, "label": "No tremor"}
    right = result.get("right") or {"freq_hz": 0.0, "amplitude_px": 0.0, "label": "No tremor"}
    dominant = left if left["amplitude_px"] >= right["amplitude_px"] else right

    left_spec = result.get("left_spectrum") or {}
    freqs = left_spec.get("freqs", [])
    mags  = left_spec.get("mags",  [])

    spectrogram_data = [
        {"frequency": float(f), "amplitude": float(m)}
        for f, m in zip(freqs, mags)
    ]

    max_amp    = dominant["amplitude_px"]
    confidence = min(99, int(70 + min(max_amp, 5.0) * 6)) if max_amp > 0 else 50

    return {
        "frequency":       float(dominant["freq_hz"]),
        "amplitude":       float(dominant["amplitude_px"]),
        "confidence":      confidence,
        "spectrogramData": spectrogram_data,
        "leftHand": {
            "frequency": float(left["freq_hz"]),
            "amplitude": float(left["amplitude_px"]),
            "label":     left["label"],
        },
        "rightHand": {
            "frequency": float(right["freq_hz"]),
            "amplitude": float(right["amplitude_px"]),
            "label":     right["label"],
        },
        "asymmetry":       result.get("asymmetry"),
        "framesProcessed": result.get("frames_processed", 0),
        "fps":             result.get("fps", 0.0),
    }


def _save_upload(file: UploadFile) -> tuple[str, str]:
    suffix     = Path(file.filename or "upload.mp4").suffix or ".mp4"
    saved_name = f"{uuid.uuid4().hex}{suffix}"
    save_path  = UPLOAD_DIR / saved_name
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return str(save_path), saved_name


def _open_cap_with_fallback(video_path: str) -> tuple[cv2.VideoCapture, Optional[str]]:
    converted_path = None
    if video_path.lower().endswith(".webm"):
        converted = convert_webm_to_mp4(video_path)
        if converted:
            converted_path = converted
            cap = cv2.VideoCapture(converted)
            if cap.isOpened():
                return cap, converted_path
            cap.release()
    cap = cv2.VideoCapture(video_path)
    return cap, converted_path


# ── Annotated MJPEG stream ────────────────────────────────────────────────────

def _generate_annotated_frames(video_path: str):
    cap, converted_path = _open_cap_with_fallback(video_path)
    if not cap.isOpened():
        return

    fps          = cap.get(cv2.CAP_PROP_FPS) or 30.0
    if fps <= 0 or fps > 120:
        fps = 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    buf_size     = int(fps * 4)

    left_buf  = deque(maxlen=buf_size)
    right_buf = deque(maxlen=buf_size)

    display = {
        "L_freq": 0.0, "L_amp": 0.0, "R_freq": 0.0, "R_amp": 0.0,
        "L_label": "–", "R_label": "–",
    }
    update_every = max(1, int(fps * 0.5))

    hands_model = mp_hands_module.Hands(
        static_image_mode=False,
        max_num_hands=2,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    def _rolling_fft(buf):
        if len(buf) < int(fps * 2):
            return 0.0, 0.0, "Buffering..."
        arr = np.array(buf, dtype=float)
        arr -= arr.mean()
        if arr.max() - arr.min() < 1.0:
            return 0.0, 0.0, "No tremor"
        n    = len(arr)
        win  = windows.hann(n)
        spec = np.abs(fft(arr * win))[:n // 2]
        freqs = fftfreq(n, d=1.0 / fps)[:n // 2]
        mask  = (freqs >= 3.0) & (freqs <= 12.0)
        if not mask.any():
            return 0.0, 0.0, "–"
        band = spec.copy()
        band[~mask] = 0
        idx = int(np.argmax(band))
        pf  = float(freqs[idx])
        pa  = float(band[idx]) / (n / 2)
        if pa < 0.15:
            lbl = "No tremor"
        elif 3.0 <= pf <= 7.0:
            lbl = "PD Range"
        elif 7.0 < pf <= 12.0:
            lbl = "ET Range"
        else:
            lbl = f"{pf:.1f} Hz"
        return round(pf, 1), round(pa, 2), lbl

    def _draw_hud(frame, h, w, frame_idx):
        cv2.rectangle(frame, (10, 10), (260, 115), (15, 15, 15), -1)
        cv2.rectangle(frame, (10, 10), (260, 115), (60, 60, 60), 1)
        cv2.putText(frame, "LEFT HAND", (20, 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (120, 200, 120), 1)
        cv2.putText(frame, f"{display['L_freq']:.1f}  Hz",
                    (20, 70), cv2.FONT_HERSHEY_DUPLEX, 1.2, (80, 255, 120), 2)
        cv2.putText(frame, f"Amp {display['L_amp']:.2f}  {display['L_label']}",
                    (20, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)

        cv2.rectangle(frame, (w - 260, 10), (w - 10, 115), (15, 15, 15), -1)
        cv2.rectangle(frame, (w - 260, 10), (w - 10, 115), (60, 60, 60), 1)
        cv2.putText(frame, "RIGHT HAND", (w - 250, 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (120, 160, 255), 1)
        cv2.putText(frame, f"{display['R_freq']:.1f}  Hz",
                    (w - 250, 70), cv2.FONT_HERSHEY_DUPLEX, 1.2, (80, 140, 255), 2)
        cv2.putText(frame, f"Amp {display['R_amp']:.2f}  {display['R_label']}",
                    (w - 250, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)

        progress = frame_idx / total_frames
        bar_w    = int(w * progress)
        cv2.rectangle(frame, (0, h - 8), (w, h), (20, 20, 20), -1)
        cv2.rectangle(frame, (0, h - 8), (bar_w, h), (0, 120, 200), -1)
        cv2.putText(frame, f"{int(progress * 100)}%",
                    (w // 2 - 18, h - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)

    frame_idx = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_idx += 1
            h, w = frame.shape[:2]
            rgb  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands_model.process(rgb)

            if results.multi_hand_landmarks and results.multi_handedness:
                for lm, handedness in zip(
                    results.multi_hand_landmarks, results.multi_handedness
                ):
                    side  = handedness.classification[0].label
                    color = (0, 200, 100) if side == "Left" else (255, 140, 0)

                    mp_drawing.draw_landmarks(
                        frame, lm, mp_hands_module.HAND_CONNECTIONS,
                        mp_drawing_styles.get_default_hand_landmarks_style(),
                        mp_drawing_styles.get_default_hand_connections_style(),
                    )

                    tip = lm.landmark[8]
                    tx, ty = int(tip.x * w), int(tip.y * h)
                    cv2.circle(frame, (tx, ty), 10, color, -1)
                    cv2.circle(frame, (tx, ty), 12, (255, 255, 255), 2)

                    wrist_y = float(lm.landmark[0].y)
                    tip_y   = float(tip.y)
                    rel_px  = (tip_y - wrist_y) * h

                    if side == "Left":
                        left_buf.append(rel_px)
                    else:
                        right_buf.append(rel_px)

            if frame_idx % update_every == 0:
                lf, la, ll = _rolling_fft(left_buf)
                rf, ra, rl = _rolling_fft(right_buf)
                display.update({
                    "L_freq": lf, "L_amp": la, "L_label": ll,
                    "R_freq": rf, "R_amp": ra, "R_label": rl,
                })

            _draw_hud(frame, h, w, frame_idx)

            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + buf.tobytes() + b"\r\n"
            )
    finally:
        cap.release()
        hands_model.close()
        if converted_path:
            import os
            try:
                os.unlink(converted_path)
            except OSError:
                pass


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Analysis endpoints ────────────────────────────────────────────────────────

@app.post("/api/analyze-video")
async def analyze_video_endpoint(
    video: UploadFile = File(...),
    patientId: str = Form(...),
):
    try:
        video_path, saved_name = _save_upload(video)
        result   = analyze_video(video_path)
        response = _build_response(result)
        response["patientId"] = patientId
        response["method"]    = "upload"
        response["filename"]  = video.filename
        response["savedName"] = saved_name
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze-live")
async def analyze_live_endpoint(
    video: UploadFile = File(...),
    patientId: str = Form(...),
    duration: Optional[str] = Form(None),
    method: Optional[str]   = Form("live-camera"),
):
    try:
        video_path, saved_name = _save_upload(video)

        cap_test = cv2.VideoCapture(video_path)
        print(
            f"[analyze-live] raw file: frames={cap_test.get(cv2.CAP_PROP_FRAME_COUNT):.0f} "
            f"fps={cap_test.get(cv2.CAP_PROP_FPS):.1f} "
            f"suffix={Path(video_path).suffix}"
        )
        cap_test.release()

        result   = analyze_video(video_path)
        response = _build_response(result)
        response["patientId"] = patientId
        response["method"]    = method
        response["duration"]  = duration
        response["filename"]  = video.filename
        response["savedName"] = saved_name
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── MJPEG Stream ──────────────────────────────────────────────────────────────

@app.get("/api/stream/{saved_name}")
async def stream_video(saved_name: str):
    video_path = UPLOAD_DIR / saved_name
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    return StreamingResponse(
        _generate_annotated_frames(str(video_path)),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ── Sessions ──────────────────────────────────────────────────────────────────

@app.post("/api/sessions")
async def save_session(session: dict):
    SESSIONS.append(session)
    _save_sessions(SESSIONS)
    return {"success": True, "session": session}


@app.get("/api/sessions")
async def get_sessions():
    return SESSIONS


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    for session in SESSIONS:
        if session.get("id") == session_id:
            return session
    raise HTTPException(status_code=404, detail="Session not found")


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    global SESSIONS
    original_len = len(SESSIONS)
    SESSIONS = [s for s in SESSIONS if s.get("id") != session_id]
    if len(SESSIONS) == original_len:
        raise HTTPException(status_code=404, detail="Session not found")
    _save_sessions(SESSIONS)
    return {"success": True}


# ── Video Info ────────────────────────────────────────────────────────────────

@app.get("/api/video-info/{saved_name}")
def video_info(saved_name: str):
    path = UPLOAD_DIR / saved_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Not found")
    cap      = cv2.VideoCapture(str(path))
    fps      = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frames   = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    width    = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height   = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    duration = round(frames / fps, 1) if fps > 0 else 0
    return {
        "fps":        round(fps, 1),
        "duration":   duration,
        "width":      width,
        "height":     height,
        "resolution": f"{width}x{height}",
    }