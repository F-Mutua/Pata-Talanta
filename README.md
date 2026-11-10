# Pata Talanta

A grassroots football talent intelligence platform designed to support data-driven scouting by transforming football match footage and player performance data into structured insights.

**Look closer. Discover talent.**

## Project vision

Pata Talanta aims to help scouts identify and evaluate emerging football talent through accessible player performance data and video-based analysis.

The platform combines football match footage, player performance statistics and structured scouting assessments to make grassroots talent more visible.

It is designed to support human scouting decisions rather than replace them.

## What the prototype does today

**For players**

- Sign up, log in, reset a forgotten password, and give consent on a one-time welcome screen.
- Player dashboard with a statistics board: contributions chart, totals and heatmaps.
- Profile with a visibility switch: players are hidden from scouts until they turn on `discoverable`.
- Club history.
- Match logging in one step, including optional per-match stats (goals, assists, shots, passes, tackles, interceptions). Matches are saved through the FastAPI backend.
- Performance centre: season totals, recent trend, activity heatmap and match-by-match records.
- Match video upload with a "tap yourself" analysis flow that produces distance, top speed, sprints, touches and a heatmap.
- Notifications, and scout contact requests that the player can accept or decline.

**For scouts**

- Scout dashboard with featured rows of ranked player cards and an "All players" tab with filters (age, county, position, matches played, has video).
- Player profile view with stats, heatmaps and a contact request.
- Scout verification screen (see [Open decisions](#open-decisions)).

**Backend API**

- `POST /matches`, `GET /matches`: save and retrieve a player's matches with participation and performance stats in one transaction.
- `POST /assessments`, `GET /assessments`, `GET/PATCH/DELETE /assessments/{id}`: structured scout assessments (technical, tactical and decision-making ratings, strengths, development areas). The API is ready, but there is no frontend for it yet.
- Every endpoint checks the user's Supabase access token.

## Technology stack

| Component | Technology |
|---|---|
| Frontend framework | Next.js 16 (App Router, Cache Components) |
| Frontend language | TypeScript, React 19 |
| Styling | Tailwind CSS 4 |
| Backend API | Python and FastAPI |
| Database | Supabase (PostgreSQL) with Row Level Security |
| Database integration | Supabase client and Psycopg |
| Authentication | Supabase Auth |
| File storage | Supabase Storage (match videos) |
| Video detection | Ultralytics YOLO |
| Object tracking | ByteTrack |
| Video processing | Python and OpenCV |
| Video processing environment | Google Colab GPU, exposed through ngrok |
| Frontend deployment | Planned: Vercel |
| Backend deployment | Planned: VPS or cloud hosting |

## Repository structure

```text
Pata-Talanta/
│
├── frontend/                      Next.js web app
│   ├── src/
│   │   ├── app/
│   │   │   ├── auth/callback/     Email confirmation
│   │   │   ├── login/  signup/  forgot-password/  reset-password/
│   │   │   ├── welcome/           Consent screen for new players
│   │   │   ├── dashboard/         Player area
│   │   │   │   ├── clubs/  matches/  performance/
│   │   │   │   ├── profile/  requests/
│   │   │   │   └── videos/[id]/   Video analysis flow
│   │   │   └── scout/             Scout area
│   │   │       ├── players/[id]/  requests/
│   │   │       └── ScoutDashboardClient.tsx
│   │   ├── components/            PlayerBoard, ScoutGate, Heatmap, charts…
│   │   ├── lib/                   Types, stats, video API client, uploads
│   │   └── utils/supabase/        Browser and server Supabase clients
│   ├── package.json
│   └── proxy.ts                   Session refresh on each request
│
├── backend/                       FastAPI service
│   ├── main.py                    Routes and token verification
│   ├── schemas.py                 Request validation (Pydantic)
│   ├── match_service.py           Match + stats persistence
│   ├── assessment_service.py      Scout assessments
│   ├── config.py  database.py
│   ├── .env.example
│   └── requirements.txt
│
├── docs/
│   ├── scout-role-access.sql      Scout role trigger and access policies
│   ├── frontend-schema.sql        Match videos, storage bucket, heatmaps
│   ├── seed-demo-data.sql         30 example players and a demo scout
│   ├── seed-my-account.sql        Fills one account with example stats
│   └── video-api.md               Contract the video service must follow
│
├── pipeline/                      Video processing (to be added)
├── .gitignore
└── README.md
```

## Local development setup

### Prerequisites

- Python 3.10 or newer
- Node.js 20 or newer, and npm
- Git
- A Supabase project
- VS Code (recommended)

### 1. Clone the repository

```powershell
git clone https://github.com/F-Mutua/Pata-Talanta.git
cd Pata-Talanta
```

### 2. Backend setup

Create and activate a virtual environment at the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
python -m pip install -r backend/requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and fill in your values:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
DATABASE_URL=postgresql://username:password@host:5432/postgres
```

`DATABASE_URL` is the PostgreSQL connection string from Supabase (Project Settings → Database).

Start the FastAPI server **from the repository root**. The code imports modules as `backend.…`, so it will not start from inside `backend/`:

```powershell
python -m uvicorn backend.main:app --reload
```

- API: http://127.0.0.1:8000
- Interactive documentation: http://127.0.0.1:8000/docs

The backend only accepts browser requests from `http://localhost:3000`. Add any other frontend address to `allow_origins` in `backend/main.py`.

### 3. Frontend setup

Open a second terminal at the repository root:

```powershell
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

# FastAPI backend (defaults to http://127.0.0.1:8000 if not set)
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

# Video analysis service. Leave empty to use demo mode with sample results.
NEXT_PUBLIC_VIDEO_API_URL=
```

Start the development server:

```powershell
npm run dev
```

Open the application at http://localhost:3000.

Other useful commands:

```powershell
npm run lint     # ESLint
npm run build    # Production build (also type-checks)
```

### 4. Supabase database

Run the SQL scripts in the Supabase SQL Editor, in this order:

1. The core tables and the `pata-talanta-scout-access.sql` policies. **This script is not in the repository yet.** Ask the team for it.
2. `docs/scout-role-access.sql`: stores the role chosen at signup and adds scout access policies.
3. `docs/frontend-schema.sql`: match videos, the video storage bucket and heatmaps.
4. Optional demo data:
   - `docs/seed-demo-data.sql`: 30 fictional players and a demo scout.
   - `docs/seed-my-account.sql`: a season of example stats for one account (change the email at the top first).

All scripts are safe to run more than once.

### 5. Video analysis service

The web app talks to the video service using the contract in [`docs/video-api.md`](docs/video-api.md). Without `NEXT_PUBLIC_VIDEO_API_URL`, the app runs in demo mode: results come from built-in samples and are labelled as such, so a demo never waits on Colab.

### Security

- Never commit `.env`, `.env.local` or any secret or service-role key. They are ignored by Git.
- Only the publishable key belongs in frontend code.
- Access to player data is enforced by Row Level Security in Supabase, not only by the UI.

## Current development status

### Completed

- [x] Repository structure, FastAPI backend and Next.js frontend
- [x] Supabase authentication: signup, login, email confirmation, password reset
- [x] Role-aware login and signup (player or scout)
- [x] Consent screen for new players
- [x] Player dashboard, profile, visibility setting and club history
- [x] Match logging through the backend, with per-match statistics
- [x] Performance centre and heatmaps
- [x] Video upload and "tap yourself" analysis flow (demo mode)
- [x] Scout dashboard with player ranking, filters and featured rows
- [x] Player-to-scout contact requests and notifications
- [x] Backend APIs for matches and scout assessments
- [x] Demo seed data

### In progress

- [ ] Connect the live video pipeline (YOLO + ByteTrack on Colab)
- [ ] Frontend for scout assessments
- [ ] Agree the scout verification approach (see below)
- [ ] Add the core schema SQL to `docs/`

### Planned

- [ ] BCF reviewer workflow for scout applications
- [ ] Automated tests
- [ ] Deployment (Vercel and backend hosting) and end-to-end testing

## Open decisions

**Scout verification.** The two parts of the code currently disagree:

- The frontend (`ScoutGate`) asks new scouts to apply for BCF verification and keeps them on a "being reviewed" screen until approved.
- `docs/scout-role-access.sql` lets anyone who signs up as a scout read discoverable players' data without review.

If that script is run, an unapproved scout could get past the verification screen by querying the database directly. The backend's `/assessments` endpoint also expects approved scouts. The team needs to choose one approach and update both parts to match.

## Development workflow

Development takes place on feature branches. The current development branch is:

```text
feature/prototype-build
```

Before you start work, get your teammates' latest changes:

```powershell
git checkout feature/prototype-build
git pull origin feature/prototype-build
```

To save and upload your changes:

```powershell
git add -A
git commit -m "Describe your changes"
git push origin feature/prototype-build
```

If the push is rejected because the branch has new commits, run `git pull` first, resolve any conflicts, check that `npm run build` still passes, then push again.

Completed work is merged into `main` through pull requests after review.

## Project philosophy

Pata Talanta is being developed as a sports talent intelligence engine, not simply a digital player registration platform.

Its goal is to combine measurable performance data with structured human scouting assessments to help uncover grassroots football talent that might otherwise remain overlooked.
