# 🚀 VoiceWise - Quick Start Guide

Get your VoiceWise project up and running in minutes!

## 🎯 Tech Stack

**Frontend:** React 19 + Vite + Tailwind CSS + Supabase JS  
**Backend:** FastAPI + SQLAlchemy + Supabase (PostgreSQL)  
**Package Managers:** npm (frontend) + pip (backend)

## Prerequisites

- ✅ **Python 3.9.6** (you have it!)
- ✅ **Node.js & npm** (you have it!)
- 🔑 **Supabase Account** (sign up at [supabase.com](https://supabase.com))

## ⚙️ Manual Setup

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

## 🔐 Configure Supabase

### 1. Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in project details and wait for setup to complete

### 2. Get Your Credentials

**API Settings:**
- Go to Project Settings > API
- Copy your **Project URL** and **anon/public key**

**Database Settings:**
- Go to Project Settings > Database
- Copy your **Connection String** (use Transaction pooler for better performance)

### 3. Update Environment Files

**Backend `.env`:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-region.pooler.supabase.com:5432/postgres

# Add your AI API keys
BLAND_AI_API_KEY=your_bland_ai_key
GROQ_API_KEY=your_groq_key
```

**Frontend `.env`:**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:8000
```

## 🗄️ Database Setup

Run Alembic migrations to create your database tables:

```bash
cd backend
source venv/bin/activate
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

## 🏃‍♂️ Run the Application

### Option 1: Two Terminals

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Access Your Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## 🎨 What's Included

### Backend (FastAPI + Supabase)
- ✅ FastAPI framework
- ✅ SQLAlchemy ORM
- ✅ Supabase integration
- ✅ Alembic migrations
- ✅ Pydantic validation
- ✅ AI integrations (Groq, Whisper)

### Frontend (React + Vite + Tailwind CSS)
- ✅ React 19
- ✅ Vite for blazing-fast development
- ✅ Tailwind CSS utility-first styling
- ✅ Supabase JS client
- ✅ Axios for HTTP requests
- ✅ React Router for navigation
- ✅ Modern, responsive UI with custom VoiceWise theme

## 🐛 Troubleshooting

**Virtual environment not activating?**
```bash
# Make sure you're in the backend directory
cd /Users/pranjalbhatt/Desktop/Hackathon/voicewise/backend
source venv/bin/activate
```

**Port already in use?**
```bash
# Find and kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Find and kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

**Module not found errors?**
```bash
# Backend: Reinstall dependencies
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Frontend: Reinstall dependencies
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Database connection errors?**
- Verify your `DATABASE_URL` in `.env`
- Check if your Supabase project is active
- Ensure you're using the correct connection string (pooler vs direct)

## 📖 Documentation

- **Main README:** `README.md` - Complete project documentation
- **Frontend Guide:** `frontend/README.md` - Tailwind CSS examples and React components
- **Backend Guide:** `backend/README.md` - API structure and database setup
- [Supabase Docs](https://supabase.com/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Docs](https://react.dev/)
- [Vite Docs](https://vite.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

## 💡 Tips

- **Supabase Dashboard:** View and edit your data at supabase.com/dashboard
- **API Docs:** Test endpoints interactively at http://localhost:8000/docs
- **Hot Reload:** Both frontend and backend have hot reload enabled
- **VS Code Extension:** Install "Tailwind CSS IntelliSense" for autocomplete

---

**Ready to build? Start the servers and open http://localhost:5173!** 🚀

---

Need help? Check the main [README.md](./README.md) for more detailed information!
