from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from datetime import datetime

# Create FastAPI app
app = FastAPI(
    title="VoiceWise API",
    description="AI Voice Feedback System for Gym Owners",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    print("🚀 Starting VoiceWise API...")
    print(f"📊 Environment: {settings.ENVIRONMENT}")
    init_db()
    print("✅ Database initialized")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to VoiceWise API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected"
    }


# Import routers (will be added in next phase)
# from app.api import calls, webhooks, dashboard
# app.include_router(calls.router, prefix="/api/calls", tags=["calls"])
# app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
# app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG
    )
