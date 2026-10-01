# AI Resume Analyzer

Upload a resume (PDF or DOCX), get an ATS score out of 100 and specific suggestions from an LLM.
Stack: **React (Vite) + Node.js/Express + MongoDB + Google Gemini API (free tier)** (MERN + AI).

## How the score works

| Part | Weight | What it checks |
|---|---|---|
| Rule-based checks | 40% | Email, phone, LinkedIn/GitHub, Experience/Education/Skills/Projects sections, length (300-900 words), action-verb bullets, quantified results, job-description keyword match |
| LLM review | 60% | Overall quality and ATS readiness, plus strengths, weaknesses, fixes, missing keywords, rewritten bullets |

If the API key is missing or the LLM call fails, the app still works and uses the rule-based score alone.

## Project structure

```
resume-analyzer/
├── backend/
│   ├── server.js            Express app and error handling
│   ├── config/db.js         MongoDB connection (Mongoose)
│   ├── models/Analysis.js   Analysis schema
│   ├── routes/analysis.js   API endpoints, file upload (Multer)
│   ├── utils/parser.js      PDF (unpdf) and DOCX (mammoth) to text
│   └── utils/analyzer.js    Rule checks, LLM call, final score
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── api.js           Axios calls
│       ├── components/      UploadForm, ScoreRing, ResultView, History
│       └── styles.css
└── docker-compose.yml       Local MongoDB
```

## API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/analyze` | Form-data: `resume` (file), `jobDescription` (optional text) |
| GET | `/api/analyses` | Last 50 analyses |
| GET | `/api/analyses/:id` | One analysis |
| DELETE | `/api/analyses/:id` | Delete an analysis |
| GET | `/api/health` | Health check |

## Setup

**Requirements:** Node.js 18 or newer, MongoDB Community Server, and a free Gemini API key from aistudio.google.com (no card needed).

### 1. Start MongoDB
Pick one:
- MongoDB Community Server installed locally as a Windows service (runs on port 27017)
- Docker: `docker compose up -d` from the project root
- MongoDB Atlas free cluster: put its connection string in `MONGO_URI`

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
# open .env and set GEMINI_API_KEY
npm run dev
```
Runs on http://localhost:5000

### 3. Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. Vite forwards `/api` requests to the backend.

## Environment variables (backend/.env)

| Variable | Default | Purpose |
|---|---|---|
| PORT | 5000 | Backend port |
| MONGO_URI | mongodb://localhost:27017/resume_analyzer | Database |
| CLIENT_URL | http://localhost:5173 | Allowed CORS origin |
| GEMINI_API_KEY | (none) | LLM access (free from Google AI Studio) |
| LLM_MODEL | gemini-flash-latest | Model used for review |

## Troubleshooting

- **"Can't reach the server"**: the backend isn't running, or isn't on port 5000.
- **"MongoDB connection failed"**: MongoDB isn't running, or `MONGO_URI` is wrong.
- **"AI review was unavailable"**: check `GEMINI_API_KEY` in `.env` and the backend console. A `429` or `RESOURCE_EXHAUSTED` error means you hit the free-tier rate limit; wait a minute and try again.
- **Model not found error**: set `LLM_MODEL` in `.env` to a current Flash model name listed in Google AI Studio.
- **"Could not read enough text"**: the PDF is a scanned image. Export it again as a text-based PDF.
