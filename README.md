# ⚽ Football AI Analysis

AI-powered football match analysis — upload a video and get player tracking, team detection, speed & distance stats, and ball possession percentages.

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![YOLOv8](https://img.shields.io/badge/YOLOv8-ultralytics-00FFFF)
![OpenCV](https://img.shields.io/badge/OpenCV-4.x-5C3EE8?logo=opencv)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)

---

## How It Works

The pipeline processes each video frame through **6 sequential computer vision modules**:

| Step | Module | Technology | What It Does |
|------|--------|-----------|------|
| 1 | **Object Detection** | YOLOv8x | Detects players, referees, and the ball with bounding boxes |
| 2 | **Multi-Object Tracking** | ByteTrack / supervision | Assigns persistent IDs across frames — players keep the same number |
| 3 | **Camera Compensation** | Optical Flow / OpenCV | Measures camera panning and subtracts it from player positions |
| 4 | **Perspective Transform** | Homography / NumPy | Maps pixel coordinates → real-world metres on the pitch |
| 5 | **Team Detection** | K-Means / scikit-learn | Clusters shirt colors to auto-assign players into two teams |
| 6 | **Speed & Possession** | NumPy | Computes speed (km/h), distance (m), and ball possession per team |

## Output

After processing, you get:

- **Annotated Video** — bounding boxes, player IDs, team colors, speed overlays, and a possession HUD burned into every frame
- **Ball Possession %** — exact split between both teams based on ball proximity
- **Per-Player Stats** — max speed (km/h) and total distance covered (metres) for every tracked player

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Detection | YOLOv8x (fine-tuned for football) |
| Tracking | ByteTrack via `supervision` |
| Vision | OpenCV 4.x |
| ML | scikit-learn (K-Means clustering) |
| Math | NumPy |
| Backend | FastAPI + Uvicorn |
| Frontend | Vanilla HTML/CSS/JS (SpaceX-inspired design) |

## Quick Start

### 1. Install dependencies

```bash
pip install ultralytics supervision opencv-python numpy scikit-learn fastapi uvicorn python-multipart
```

### 2. Download the YOLO model

Place `best.pt` (fine-tuned football model) in the `models/` directory.

### 3. Run the backend

```bash
cd "Football Analysis Github"
uvicorn api:app --reload
```

The API runs on `http://127.0.0.1:8000`.

### 4. Open the frontend

Open `frontend/index.html` in your browser, or serve it:

```bash
cd frontend
python -m http.server 8080
```

Then go to `http://localhost:8080`.

### 5. Analyse a video

1. Upload an MP4/AVI/MOV file in the Demo section
2. Make sure the API URL is set to `http://127.0.0.1:8000`
3. Click **Run Analysis**
4. Watch the progress overlay with real-time % and ETA
5. Download the annotated output video when done

## Project Structure

```
├── api.py                  # FastAPI backend (upload, SSE progress, results)
├── main.py                 # Standalone CLI analysis script
├── frontend/
│   ├── index.html          # Single-page app
│   ├── css/style.css       # SpaceX-inspired design system
│   └── js/main.js          # Cursor effects, carousel, SSE progress
├── trackers/               # YOLO + ByteTrack wrapper
├── team_assigner/          # K-Means shirt-color clustering
├── player_ball_assigner/   # Ball-to-player proximity logic
├── camera_movement_estimator/  # Lucas-Kanade optical flow
├── view_transformer/       # Pixel → metre homography
├── speed_and_distance_estimator/  # Frame-to-frame velocity
├── utils/                  # Drawing helpers, bbox utilities
└── models/                 # YOLO weights (not tracked — download separately)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/analyze` | Upload video, returns `{ job_id }` |
| `GET` | `/progress/{job_id}` | SSE stream with `pct`, `step`, `eta_seconds` |
| `GET` | `/result/{job_id}` | Download the annotated output video |
| `GET` | `/stats/{job_id}` | Get JSON stats (possession, player data) |
| `GET` | `/health` | Health check |

## Credits

- **YOLO**: [Ultralytics](https://github.com/ultralytics/ultralytics)
- **Tracking**: [supervision](https://github.com/roboflow/supervision)
- **UI Inspiration**: [SpaceX Pirate](https://github.com/unitedstatesofamerica2305-eng/Spacexpirate)

---

*Built by Denys*
