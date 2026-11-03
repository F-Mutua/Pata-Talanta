
# Pata Talanta

A grassroots football talent intelligence platform designed to support data-driven scouting by transforming football match footage and player performance data into structured insights.

**Look closer. Discover talent.**

## Project vision

Pata Talanta aims to help scouts identify and evaluate emerging football talent through accessible player performance data and video-based analysis.

The platform combines football match footage, player performance statistics and structured scouting assessments to make grassroots talent more visible.

It is designed to support human scouting decisions rather than replace them.

## Technology stack

| Component | Technology |
|---|---|
| Frontend framework | Next.js 16 |
| Frontend language | TypeScript |
| Styling | Tailwind CSS |
| Backend API | Python and FastAPI |
| Database | Supabase (PostgreSQL) |
| Database integration | Supabase client and Psycopg |
| Authentication | Supabase Auth |
| Video detection | Ultralytics YOLO |
| Object tracking | ByteTrack |
| Video processing | Python and OpenCV |
| Video processing environment | Google Colab GPU |
| Frontend deployment | Planned: Vercel |
| Backend deployment | Planned: VPS or cloud hosting |

## Repository structure

```text
Pata-Talanta/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── auth/
│   │   │   │   └── callback/
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── utils/
│   │       └── supabase/
│   │           ├── client.ts
│   │           ├── middleware.ts
│   │           └── server.ts
│   ├── .env.local
│   ├── package.json
│   └── proxy.ts
│
├── backend/
│   ├── main.py
│   └── requirements.txt
│
├── pipeline/
│
├── docs/
│
├── .gitignore
└── README.md
```

Note: `.env.local` is a local configuration file and is excluded from Git. It should not be committed.

## Current development status

### Completed

- [x] Initial repository structure
- [x] FastAPI backend scaffold
- [x] Local Python virtual environment
- [x] Backend dependencies installed
- [x] Backend API tested locally
- [x] Next.js frontend scaffold
- [x] Initial landing page
- [x] Supabase project setup
- [x] Supabase client and server configuration
- [x] Supabase authentication integration
- [x] User signup and login pages
- [x] Email confirmation callback
- [x] Automatic player profile creation on signup
- [x] Initial Row Level Security configuration for profiles
- [x] GitHub feature branch established

### In progress

- [ ] Player dashboard and profile functionality
- [ ] Complete authentication and session testing
- [ ] Database schema expansion
- [ ] Backend and database integration

### Planned

- [ ] Match logging
- [ ] Video upload and processing
- [ ] Player tracking and performance metrics
- [ ] Heatmap generation
- [ ] Scout dashboard
- [ ] Player discovery and filtering
- [ ] Player-to-scout contact workflow
- [ ] Notifications
- [ ] Deployment and end-to-end testing

## Local development setup

### Prerequisites

- Python
- Node.js and npm
- Git
- VS Code

### 1. Clone the repository

```powershell
git clone https://github.com/F-Mutua/Pata-Talanta.git
cd Pata-Talanta
```

### 2. Backend setup

Create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
python -m pip install -r backend/requirements.txt
```

Start the FastAPI server:

```powershell
python -m uvicorn backend.main:app --reload
```

The API runs at:

http://127.0.0.1:8000

Interactive API documentation:

http://127.0.0.1:8000/docs

### 3. Frontend setup

Open a second terminal at the repository root.

Navigate to the frontend:

```powershell
cd frontend
```

Install dependencies:

```powershell
npm install
```

Create a `.env.local` file inside `frontend/` with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Replace the placeholders with the appropriate values from your Supabase project.

Start the development server:

```powershell
npm run dev
```

Open the application at:

http://localhost:3000

### 4. Supabase configuration

The application uses Supabase for PostgreSQL database services and user authentication.

The current implementation includes:

- User signup and login.
- Email confirmation through an authentication callback.
- Automatic creation of player profiles.
- Initial Row Level Security configuration for the profiles table.

Additional database tables, access policies and role-management workflows will be implemented as development progresses.

Never commit `.env.local` or expose secret/service-role keys in frontend code.

## Development workflow

Development takes place on feature branches.

Current development branch:

```text
feature/prototype-build
```

To check the current branch:

```powershell
git branch --show-current
```

To save and upload changes:

```powershell
git add -A
git commit -m "Describe your changes"
git push origin feature/prototype-build
```

Completed changes can subsequently be submitted through pull requests for review before merging into `main`.

## Project philosophy

Pata Talanta is being developed as a sports talent intelligence engine, not simply a digital player registration platform.

Its goal is to combine measurable performance data with structured human scouting assessments to help uncover grassroots football talent that might otherwise remain overlooked.
