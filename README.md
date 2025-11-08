# VoiceWise

AI-powered voice feedback platform for gyms. VoiceWise schedules automated Bland AI calls, stores transcripts in Supabase, and uses Groq-hosted LLMs plus sentence-transformer embeddings to deliver actionable insights inside a React dashboard.

---

## At a Glance

- **Frontend:** React 19 + Vite + Tailwind CSS, hits the REST API via Axios, Supabase client for auth/storage helpers.
- **Backend:** FastAPI + SQLAlchemy with Alembic migrations, orchestrates Bland AI calls, Groq analysis, embeddings, and insight aggregation.
- **Database:** Supabase PostgreSQL with `pgvector` for semantic search, exposed locally through Docker or remote project credentials.
- **AI Integrations:** Bland AI for outbound calls, Groq `llama-3.3-70b-versatile` for summarisation, `all-MiniLM-L6-v2` embeddings for similarity search.

Key entry points:

- `frontend/src/components/Dashboard.jsx` – sentiment, churn, revenue and pain-point visualisations.
- `frontend/src/components/CallsList.jsx` – call list, filters, insights side panel.
- `backend/app/api/calls.py` – public REST routes for initiation, search, analytics, segments.
- `backend/app/services/` – orchestration services (`call_service`, `insight_service`, `rag_service`, etc.).
- `backend/app/prompts/` – structured prompt templates supplying Groq with call-analysis instructions.

---

## Repository Structure

```
VoiceWise/
├── README.md                # You are here
├── QUICKSTART.md            # Command-oriented cheat sheet
├── docker-compose.yml       # Local orchestration for DB, API, frontend
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routers (calls, webhooks)
│   │   ├── core/            # Settings, database session wiring
│   │   ├── models/          # SQLAlchemy models mapped to Supabase
│   │   ├── services/        # Business logic + AI integrations
│   │   ├── prompts/         # LLM prompt templates
│   │   └── schemas/         # Pydantic request/response models
│   ├── Dockerfile
│   ├── requirements.txt
│   └── alembic/             # Database migrations & env config
└── frontend/
    ├── src/
    │   ├── api/             # Axios wrapper + call API surface
    │   ├── components/      # Dashboard UI
    │   └── lib/             # Supabase client bootstrap
    ├── Dockerfile
    └── vite.config.js
```

Additional docs:

- `AUDIO_FEATURE.md` – detailed design for audio features and live call analysis.
- `TAILWIND.md` / `TAILWIND_SETUP_COMPLETE.md` – styling guidelines and setup checklist.

---

## Architecture Overview

```
┌──────────────┐      REST      ┌───────────────┐      SQL + Vector     ┌──────────────┐
│ React + Vite │ ─────────────▶ │ FastAPI (API) │ ─────────────────────▶ │ Supabase PG  │
└──────────────┘                │  Services     │                       │ + pgvector   │
                                └───────────────┘                       └──────────────┘
                                         │
                                         │ background jobs / webhooks
                                         ▼
                         ┌───────────────────────────────┐
                         │ Bland AI (outbound voice)     │
                         │ Groq LLM (insight extraction) │
                         │ Sentence Transformers         │
                         └───────────────────────────────┘
```

### Backend Highlights

- Bootstrapped in `app/main.py` with permissive CORS for dev; `startup_event` logs environment state.
- `call_service.py`:
  - Initiates outbound Bland AI calls and stores initial call records.
  - Replays transcripts into the analysis pipeline on completion.
- `insight_service.py`:
  - Persists LLM-extracted insights and snapshots for dashboards.
  - Aggregates churn and revenue risk segments.
- `rag_service.py` / `search_service.py`:
  - Manage embedding enrichment and hybrid search (metadata filters + vector similarity).
- `webhooks.py`:
  - Receives Bland AI events, updates call status, triggers post-processing.
- Alembic migrations configure the schema (`calls`, `insights`, embeddings, indexes, optional revenue signals).

### Frontend Highlights

- `Dashboard.jsx` wires together trend charts, churn segments, revenue insights, and anomaly surfaces via the REST API.
- `TrendCharts.jsx` and `LiveCalls.jsx` consume aggregated endpoints for time-series visualisations.
- `InitiateCalls.jsx` gates the call initiation form and optional custom instructions payload.
- Global API client (`src/api/api.js`) injects an `ngrok-skip-browser-warning` header for tunnelling scenarios.
- Supabase client bootstrap lives in `src/lib/supabase.js` and reuses `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`.

---

## Working with the Codebase

### Prerequisites

- Python ≥ 3.9 (project standard is 3.9.6)
- Node.js ≥ 18 (matching the Vite scaffold)
- Docker Desktop (optional, for Compose workflow)
- Supabase project (for remote DB) or local PostgreSQL via Docker
- API keys for Bland AI and Groq

### Environment Variables

Create a root `.env` (see `.env.example`) for Compose and tooling. Per-service `.env` files are loaded separately by Vite and FastAPI.

| Target              | Required Keys                                                                                                        |
|---------------------|-----------------------------------------------------------------------------------------------------------------------|
| Root (`.env`)       | `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`, `GROQ_API_KEY`, `BLAND_AI_API_KEY`, optional overrides listed below |
| Backend (`.env`)    | Add `DATABASE_URL`, `SUPABASE_*`, AI keys, optional `BLAND_AI_WEBHOOK_URL`, `CORS_ORIGINS`, `GYM_*`, `WHISPER_MODEL`     |
| Frontend (`.env`)   | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`                                                         |

> Tip: when running via Docker Compose, backend uses `DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres`. Outside Docker, point it to your Supabase (or local) database.

### Manual Local Setup

1. **Clone & install dependencies**
   ```bash
   git clone <repo>
   cd VoiceWise
   ```

2. **Environment files**
   ```bash
   cp .env.example .env             # root (Compose + shared values)
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
   Fill in API keys and database URIs.

3. **Backend**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

4. **Frontend (new terminal)**
   ```bash
   cd VoiceWise/frontend
   npm install
   npm run dev -- --host --port 5173
   ```

5. **Access**
   - Frontend: http://localhost:5173
   - API docs: http://localhost:8000/docs

### Docker Compose Workflow

1. Ensure Docker Desktop is running.
2. Populate `.env` with Supabase credentials and API keys.
3. Build + launch:
   ```bash
   docker compose down            # optional: clean up previous stack
   docker compose up --build      # rebuild images and start services
   ```
4. Services:
   - `voicewise-db` (PostgreSQL with pgvector) → exposed on `localhost:5433`
   - `voicewise-backend` (FastAPI) → `http://localhost:8000`
   - `voicewise-frontend` (Nginx serving Vite build) → `http://localhost`
5. Tear down (preserve db volume):
   ```bash
   docker compose down
   ```

> Alembic migrations run manually. After the stack is up, exec into `voicewise-backend` or run `docker compose exec backend alembic upgrade head`.

### Useful Scripts

- `backend/process_calls_for_insights.py` – reprocess historical calls, refresh embeddings/insights.
- `backend/generate_dummy_calls.py` – seed synthetic call logs (requires valid `DATABASE_URL`).
- `backend/backfill_embeddings.py` / `backfill_embeddings_batch.py` – fix or batch-generate embeddings.

---

## Testing & Quality

- Automated tests are not yet defined. Before shipping significant changes, add pytest suites under `backend/tests/` (create directory) and exercise component-level logic.
- Linting:
  - Backend: rely on FastAPI style conventions and `black`/`ruff` (not configured yet).
  - Frontend: Vite uses ESLint config at `frontend/eslint.config.js` (run `npm run lint`).

---

## Monitoring, Logging & Observability

- FastAPI currently logs to stdout; `app/main.py` prints environment and health info at startup.
- Health checks:
  - Backend: `/health` endpoint (used in Docker healthcheck).
  - Frontend: simple Nginx `wget` health probe inside Compose.
- Recommended next steps:
  - Enable structured logging for webhook payloads (`backend/logs/` already captures Bland AI payloads).
  - Add Sentry (or similar) for exception tracing.

---

## Product Background (Appendix)

VoiceWise targets small to enterprise gym chains that need scalable member feedback. Automated voice calls achieve higher engagement than forms, while Groq-powered summarisation surfaces:

- Sentiment trends, churn risk, and revenue opportunities.
- Pain points per member segment.
- Quotes that the sales team can act on immediately.

Recommended phased roadmap:

- **Short term:** Email notifications, multi-gym dashboard, CSV/PDF exports.
- **Medium term:** Real-time monitoring, predictive analytics, integrations with gym management platforms.
- **Long term:** Multi-language calls, emotion/tone detection, automated retention workflows.

---

## Support & Further Reading

- Quick ref commands: `QUICKSTART.md`
- Styling system: `frontend/TAILWIND.md`
- Live audio design notes: `AUDIO_FEATURE.md`
- Supabase docs: https://supabase.com/docs
- FastAPI docs: https://fastapi.tiangolo.com/
- Bland AI: https://www.bland.ai/
- Groq: https://groq.com/

For issues, open tickets or ping the engineering channel. Happy hacking!
