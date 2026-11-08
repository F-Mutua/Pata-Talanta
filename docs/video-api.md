# Video service API (what the web app expects)

For the Video AI lane. The web app calls these endpoints from the browser.
Set the base URL in `frontend/.env.local`:

```env
NEXT_PUBLIC_VIDEO_API_URL=https://<your-tunnel>.ngrok-free.app
```

If the variable is empty, the app runs in **demo mode** with built-in sample
results, clearly labelled, so the demo never waits on Colab.

## Requirements

- **CORS:** allow the web app's origin (`http://localhost:3000` and the Vercel
  URL), or `*` for the prototype. In FastAPI:

  ```python
  from fastapi.middleware.cors import CORSMiddleware
  app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
  ```

- **ngrok:** the app sends `ngrok-skip-browser-warning: true` on every request
  so ngrok's warning page doesn't replace the JSON.

## 1. Start a job

`POST /jobs`

```json
{ "video_url": "<signed Supabase URL, valid 2 hours>", "video_id": "<match_videos.id>" }
```

Response:

```json
{ "job_id": "abc123" }
```

Download the video from `video_url`, then run detection and tracking.

## 2. Poll a job

`GET /jobs/{job_id}`. The app polls every 3 seconds.

```json
{
  "status": "queued | detecting | awaiting_selection | analysing | done | failed",
  "progress": 0.4,
  "message": "Tracking players… frame 900/2400",
  "frame": {
    "image_url": "https://… or data:image/jpeg;base64,…",
    "width": 1920,
    "height": 1080,
    "candidates": [
      { "track_id": 7, "box": [812, 430, 868, 590] },
      { "track_id": 12, "box": [1104, 402, 1150, 548] }
    ]
  },
  "result": null
}
```

- `progress`, `message`: optional, shown while working.
- `frame`: required when `status` is `awaiting_selection`. `box` is
  `[x1, y1, x2, y2]` in pixels of that image. The app scales the boxes to the
  screen.
- `result`: required when `status` is `done`:

```json
{
  "distance_m": 1840,
  "top_speed_kmh": 26.4,
  "sprints": 9,
  "touches": 31,
  "heatmap": [[0, 1, 2], [1, 3, 4]],
  "annotated_video_url": "https://…/annotated.mp4",
  "duration_s": 300
}
```

- `heatmap`: rows × cols of numbers ≥ 0 (any scale; the app normalises).
  Columns run along the pitch, goal to goal, with column 0 at the player's
  own goal. Rows run touchline to touchline. 8 × 12 works well.
- `annotated_video_url`: optional, but must be playable by a browser
  (H.264 MP4).

## 3. Select the player

`POST /jobs/{job_id}/select`

```json
{ "track_id": 7 }
```

Any 2xx response. The job then moves to `analysing` and later to `done`.

## Errors

Return `"status": "failed"` with a `message` the player can read, for
example "The pitch corners could not be found". HTTP errors are shown as
"The video service is not reachable".
