# Pata Talanta

A grassroots football talent intelligence platform designed to support data-driven scouting by transforming football match footage and player performance data into structured insights.

## Project vision

Pata Talanta aims to help scouts identify and evaluate emerging football talent through accessible player performance data and video-based analysis.

The platform supports human scouting decisions rather than replacing them.

## Technology stack

| Component | Technology |
|---|---|
| Frontend | Next.js and Tailwind CSS |
| Backend API | Python and FastAPI |
| Database | PostgreSQL |
| Database integration | Psycopg |
| Video detection | Ultralytics YOLO |
| Object tracking | ByteTrack |
| Video processing | Python and OpenCV |
| Video processing environment | Google Colab GPU |
| Deployment | Vercel and backend hosting |

## Repository structure

- `frontend/` – Web application for players and scouts.
- `backend/` – API and database integration.
- `pipeline/` – Video detection, tracking and performance analysis.
- `docs/` – Technical documentation and project notes.

## Current development status

- [x] Initial repository structure
- [x] FastAPI backend scaffold
- [x] Local Python virtual environment
- [x] Backend dependencies installed
- [x] Backend API tested locally
- [ ] Database integration
- [ ] Frontend implementation
- [ ] Video processing pipeline
- [ ] Player and scout dashboards

## Running the backend locally

Activate the Python virtual environment:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
python -m pip install -r backend/requirements.txt
```

Start the API:

```powershell
python -m uvicorn backend.main:app --reload
```

Access the API at:

http://127.0.0.1:8000

Access interactive API documentation at:

http://127.0.0.1:8000/docs

## Development

Development takes place on feature branches. Completed changes are submitted through pull requests for review before merging into `main`.
