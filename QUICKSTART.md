# 🚀 VoiceWise Quick Start

Get the VoiceWise stack running locally with either manual tooling or Docker Compose.

---

## 1. Prerequisites

- Python ≥ 3.9 (project built against 3.9.6)
- Node.js ≥ 18 and npm
- Docker Desktop (optional for Compose)
- Supabase project (or local Postgres) and credentials
- Bland AI + Groq API keys

---

## 2. Environment Files

From the repository root:

```bash
cp .env.example .env                   # root (Compose + shared secrets)
cp backend/.env.example backend/.env   # FastAPI service
cp frontend/.env.example frontend/.env # Vite frontend
```

Populate the placeholders:

- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`
- `DATABASE_URL` (for non-Docker workflows)
- `GROQ_API_KEY`, `BLAND_AI_API_KEY`, optional `BLAND_AI_WEBHOOK_URL`
- `VITE_API_URL` (defaults to `http://localhost:8000` for manual runs)
- `VITE_BLAND_AI_API_KEY` (required for live call widgets)

> When running under Docker Compose the backend uses `DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres`, so you only need to provide remote credentials if you prefer Supabase.

---

## 3. Manual Setup (Two Terminals)

### Backend (Terminal 1)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate               # Windows: venv\Scripts\activate or .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head                   # creates tables/indexes
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Terminal 2)

```bash
cd frontend
npm install
npm run dev -- --host --port 5173
```

### Access

- Frontend dev server: http://localhost:5173
- Backend API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs

---

## 4. Docker Compose Workflow

1. Ensure `.env` is populated with the AI + Supabase keys.
2. Bring the stack up:

   ```bash
   docker compose down                  # optional reset
   docker compose up --build
   ```

3. Services exposed locally:
   - Frontend (nginx): http://localhost
   - FastAPI backend: http://localhost:8000
   - PostgreSQL (pgvector): localhost:5433 → `postgres/postgres`

4. Apply migrations (first run):

   ```bash
   docker compose exec backend alembic upgrade head
   ```

5. Tear down while keeping volumes:

   ```bash
   docker compose down
   ```

---

## 5. Supabase Configuration (Optional Remote DB)

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Retrieve:
   - **Project URL** & **anon/public API key** (`Project Settings → API`).
   - **Service role key** (if needed for background jobs).
   - **Connection string** (`Project Settings → Database` → use the pooled connection).
3. Update `.env` and `backend/.env` accordingly, swapping out the default Docker `DATABASE_URL`.

---

## 6. Common Commands

```bash
# Backend linting / formatting (after installing your tools of choice)
black app && ruff check app

# Frontend linting
npm run lint

# Rerun embeddings backfill
python backend/backfill_embeddings.py
```

---

## 7. Troubleshooting

- **Virtualenv issues:** Ensure you activated the environment from `backend/`.
- **Ports busy:** Use `lsof -ti:8000 | xargs kill -9` (macOS/Linux) to free the backend port, same for `5173`.
- **Module import errors:** Reinstall dependencies (`pip install -r requirements.txt` or `npm install`).
- **Database connection failures:** Double-check `DATABASE_URL` and ensure the Supabase project (or Docker service) is live.
- **CORS errors:** Confirm `CORS_ORIGINS` in `backend/.env` contains the host running your frontend.

---

## 8. Helpful Links

- Main documentation: `README.md`
- Tailwind/styling tips: `frontend/TAILWIND.md`
- Audio feature blueprint: `AUDIO_FEATURE.md`
- Supabase docs: https://supabase.com/docs
- FastAPI docs: https://fastapi.tiangolo.com/
- Vite docs: https://vite.dev/

Happy building! Once everything is running, head to http://localhost:5173 (manual) or http://localhost (Docker) to explore the dashboard. 🚀
