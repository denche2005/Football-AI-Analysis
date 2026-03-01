"""
api.py — FastAPI backend for the Football Analysis pipeline.

Endpoints:
  POST /analyze          → Upload video, start background analysis, return job_id
  GET  /progress/{job}   → SSE stream of real-time progress
  GET  /result/{job}     → Download the processed output video
  GET  /stats/{job}      → Get statistics JSON for a completed job
  GET  /health           → Health check

Real-time progress is delivered via Server-Sent Events (SSE).
"""

import os
import sys
import uuid
import json
import time
import shutil
import threading
import traceback
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse


class NumpyEncoder(json.JSONEncoder):
    """Handle NumPy types that the default encoder can't serialize."""
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

# ── make sure local modules are importable ─────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))

from utils import read_video, save_video
from trackers import Tracker
from team_assigner import TeamAssigner
from player_ball_assigner import PlayerBallAssigner
from camera_movement_estimator import CameraMovementEstimator
from view_transformer import ViewTransformer
from speed_and_distance_estimator import SpeedAndDistance_Estimator

# ── directories (absolute) ─────────────────────────────────────────────────
_BASE = Path(__file__).parent.resolve()
INPUT_DIR = _BASE / "input_videos"
OUTPUT_DIR = _BASE / "output_videos"
STUBS_DIR = _BASE / "stubs"
MODELS_DIR = _BASE / "models"

INPUT_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
STUBS_DIR.mkdir(exist_ok=True)

# ── Model ──────────────────────────────────────────────────────────────────
_FINE_TUNED = MODELS_DIR / "best.pt"
MODEL_PATH = str(_FINE_TUNED) if _FINE_TUNED.exists() else "yolov8x.pt"
print(f"[FootballAI] Using model: {MODEL_PATH}")

# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(title="Football Analysis API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Job state (in-memory, per-process) ─────────────────────────────────────
# Each job has: status, progress dict, stats, error
jobs: dict[str, dict] = {}


def _update_progress(job_id: str, step: str, pct: int, detail: str = "",
                     current_frame: int = 0, total_frames: int = 0,
                     eta_seconds: float = 0):
    """Thread-safe progress update."""
    if job_id in jobs:
        jobs[job_id]["progress"] = {
            "step": step,
            "pct": pct,
            "detail": detail,
            "current_frame": current_frame,
            "total_frames": total_frames,
            "eta_seconds": round(eta_seconds, 1),
        }


# ══════════════════════════════════════════════════════════════════════════════
# Pipeline (runs in background thread)
# ══════════════════════════════════════════════════════════════════════════════

def run_pipeline(input_path: str, output_path: str, job_id: str):
    """Full analysis pipeline with real-time progress updates."""
    try:
        # 1. Read video ────────────────────────────────────────────────
        _update_progress(job_id, "reading", 2, "Reading video frames…")
        frames = read_video(input_path)
        if not frames:
            raise ValueError("Could not read any frames from the video.")
        total = len(frames)

        fps_cap = cv2.VideoCapture(input_path)
        fps = fps_cap.get(cv2.CAP_PROP_FPS) or 24.0
        fps_cap.release()

        _update_progress(job_id, "reading", 5, f"Read {total} frames", total_frames=total)

        # 2. Track objects (YOLO — slowest step) ──────────────────────
        _update_progress(job_id, "tracking", 6, "Initializing YOLO model…", total_frames=total)
        tracker = Tracker(MODEL_PATH)

        t_start = time.time()
        tracks = tracker.get_object_tracks(
            frames, read_from_stub=False,
            stub_path=str(STUBS_DIR / f"{job_id}_tracks.pkl")
        )
        t_track = time.time() - t_start
        _update_progress(job_id, "tracking", 40,
                         f"Tracked {total} frames in {t_track:.0f}s",
                         current_frame=total, total_frames=total)

        tracker.add_position_to_tracks(tracks)

        # 3. Camera movement ──────────────────────────────────────────
        _update_progress(job_id, "camera", 42, "Estimating camera movement…",
                         total_frames=total)
        cam_estimator = CameraMovementEstimator(frames[0])
        cam_movement = cam_estimator.get_camera_movement(
            frames, read_from_stub=False,
            stub_path=str(STUBS_DIR / f"{job_id}_camera.pkl")
        )
        cam_estimator.add_adjust_positions_to_tracks(tracks, cam_movement)
        _update_progress(job_id, "camera", 50, "Camera movement estimated")

        # 4. Perspective transform ────────────────────────────────────
        _update_progress(job_id, "perspective", 52, "Applying perspective transform…")
        view_transformer = ViewTransformer()
        view_transformer.add_transformed_position_to_tracks(tracks)
        _update_progress(job_id, "perspective", 55, "Perspective transform applied")

        # 5. Interpolate ball ─────────────────────────────────────────
        _update_progress(job_id, "interpolation", 57, "Interpolating ball positions…")
        tracks["ball"] = tracker.interpolate_ball_positions(tracks["ball"])

        # 6. Speed & Distance ─────────────────────────────────────────
        _update_progress(job_id, "speed", 60, "Calculating speed & distance…")
        speed_estimator = SpeedAndDistance_Estimator()
        speed_estimator.add_speed_and_distance_to_tracks(tracks)
        _update_progress(job_id, "speed", 65, "Speed & distance calculated")

        # 7. Team assignment ──────────────────────────────────────────
        _update_progress(job_id, "teams", 67, "Detecting team colors…")
        team_assigner = TeamAssigner()
        team_assigner.assign_team_color(frames[0], tracks["players"][0])
        for frame_num, player_track in enumerate(tracks["players"]):
            for player_id, track in player_track.items():
                team = team_assigner.get_player_team(
                    frames[frame_num], track["bbox"], player_id
                )
                tracks["players"][frame_num][player_id]["team"] = team
                tracks["players"][frame_num][player_id]["team_color"] = (
                    team_assigner.team_colors[team].tolist()
                )
        _update_progress(job_id, "teams", 73, "Teams assigned")

        # 8. Ball possession ──────────────────────────────────────────
        _update_progress(job_id, "possession", 75, "Calculating ball possession…")
        ball_assigner = PlayerBallAssigner()
        team_ball_control = []
        for frame_num, player_track in enumerate(tracks["players"]):
            ball_bbox = tracks["ball"][frame_num].get(1, {}).get("bbox")
            if ball_bbox:
                assigned = ball_assigner.assign_ball_to_player(player_track, ball_bbox)
                if assigned != -1:
                    tracks["players"][frame_num][assigned]["has_ball"] = True
                    team_ball_control.append(tracks["players"][frame_num][assigned]["team"])
                else:
                    team_ball_control.append(team_ball_control[-1] if team_ball_control else 1)
            else:
                team_ball_control.append(team_ball_control[-1] if team_ball_control else 1)
        team_ball_control = np.array(team_ball_control)
        _update_progress(job_id, "possession", 78, "Possession calculated")

        # 9. Draw annotations ─────────────────────────────────────────
        _update_progress(job_id, "drawing", 80, "Drawing annotations on frames…",
                         total_frames=total)
        output_frames = tracker.draw_annotations(frames, tracks, team_ball_control)
        output_frames = cam_estimator.draw_camera_movement(output_frames, cam_movement)
        speed_estimator.draw_speed_and_distance(output_frames, tracks)
        _update_progress(job_id, "drawing", 92, "Annotations drawn")

        # 10. Save output ─────────────────────────────────────────────
        _update_progress(job_id, "saving", 94, "Encoding output video…")
        save_video(output_frames, output_path)
        _update_progress(job_id, "saving", 98, "Video saved")

        # ── Collect statistics ───────────────────────────────────────
        stats = _collect_stats(tracks, team_ball_control, team_assigner)

        _update_progress(job_id, "done", 100, "Analysis complete!")
        jobs[job_id]["stats"] = stats
        jobs[job_id]["status"] = "done"

    except Exception as e:
        traceback.print_exc()
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
        _update_progress(job_id, "error", 0, str(e))

    finally:
        # Clean up input file
        if os.path.exists(input_path):
            os.remove(input_path)


def _collect_stats(tracks, team_ball_control, team_assigner):
    n = len(team_ball_control)
    team1_pct = float(np.sum(team_ball_control == 1) / n * 100) if n else 0
    team2_pct = float(np.sum(team_ball_control == 2) / n * 100) if n else 0

    def to_hex(arr):
        try:
            r, g, b = int(arr[0]), int(arr[1]), int(arr[2])
            return f"#{r:02X}{g:02X}{b:02X}"
        except Exception:
            return "#FFFFFF"

    team_colors = {
        "team1": to_hex(team_assigner.team_colors.get(1, [200, 50, 50])),
        "team2": to_hex(team_assigner.team_colors.get(2, [50, 50, 200])),
    }

    player_stats = {}
    for frame_tracks in tracks["players"]:
        for pid, info in frame_tracks.items():
            if pid not in player_stats:
                player_stats[pid] = {"max_speed": 0.0, "total_distance": 0.0, "team": info.get("team", 0)}
            spd = info.get("speed", 0.0) or 0.0
            dist = info.get("distance", 0.0) or 0.0
            player_stats[pid]["max_speed"] = max(player_stats[pid]["max_speed"], spd)
            player_stats[pid]["total_distance"] = max(player_stats[pid]["total_distance"], dist)

    return {
        "possession": {"team1": round(team1_pct, 1), "team2": round(team2_pct, 1)},
        "team_colors": team_colors,
        "players": {
            str(pid): {
                "team": data["team"],
                "max_speed_kmh": round(data["max_speed"], 1),
                "distance_m": round(data["total_distance"], 1),
            }
            for pid, data in player_stats.items()
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_PATH}


@app.post("/analyze")
async def analyze(video: UploadFile = File(...)):
    """Upload a video → starts background analysis → returns job_id immediately."""
    allowed = {"video/mp4", "video/avi", "video/quicktime", "video/x-msvideo"}
    if video.content_type not in allowed:
        raise HTTPException(400, f"Unsupported: {video.content_type}. Use MP4/AVI/MOV.")

    job_id = str(uuid.uuid4())[:8]
    suffix = Path(video.filename).suffix or ".mp4"
    input_path = str(INPUT_DIR / f"{job_id}_input{suffix}")
    output_path = str(OUTPUT_DIR / f"{job_id}_output.avi")

    with open(input_path, "wb") as f:
        shutil.copyfileobj(video.file, f)

    # Initialize job state
    jobs[job_id] = {
        "status": "running",
        "progress": {"step": "queued", "pct": 0, "detail": "Starting…"},
        "stats": None,
        "error": None,
    }

    # Start pipeline in background thread
    thread = threading.Thread(target=run_pipeline, args=(input_path, output_path, job_id), daemon=True)
    thread.start()

    return JSONResponse({"job_id": job_id, "message": "Analysis started. Stream progress via /progress/{job_id}"})


@app.get("/progress/{job_id}")
async def progress_stream(job_id: str):
    """SSE endpoint — streams real-time progress events."""
    if job_id not in jobs:
        raise HTTPException(404, f"Unknown job: {job_id}")

    async def event_generator():
        last_pct = -1
        while True:
            job = jobs.get(job_id)
            if not job:
                break

            prog = job["progress"]
            current_pct = prog.get("pct", 0)

            # Only send when something changed
            if current_pct != last_pct:
                data = json.dumps(prog, cls=NumpyEncoder)
                yield f"data: {data}\n\n"
                last_pct = current_pct

            # If done or error, send final event and close
            if job["status"] in ("done", "error"):
                if job["status"] == "done":
                    final = {
                        "step": "done",
                        "pct": 100,
                        "detail": "Analysis complete!",
                        "stats": job["stats"],
                        "download_url": f"/result/{job_id}",
                    }
                else:
                    final = {"step": "error", "pct": 0, "detail": job.get("error", "Unknown error")}
                yield f"data: {json.dumps(final, cls=NumpyEncoder)}\n\n"
                break

            import asyncio
            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/stats/{job_id}")
def get_stats(job_id: str):
    """Get stats for a completed job."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    if job["status"] != "done":
        raise HTTPException(400, f"Job status: {job['status']}")
    return JSONResponse({"job_id": job_id, "stats": job["stats"], "download_url": f"/result/{job_id}"})


@app.get("/result/{job_id}")
def download_result(job_id: str):
    """Download the annotated output video."""
    output_path = OUTPUT_DIR / f"{job_id}_output.avi"
    if not output_path.exists():
        raise HTTPException(404, f"No result found for job {job_id}")
    return FileResponse(str(output_path), media_type="video/x-msvideo",
                        filename=f"football_analysis_{job_id}.avi")
