from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.database import sync_init_db, sync_check_db_connection
from app.core.health_check import startup_event, shutdown_event, health_check
from app.routers import auth, projects, tasks, analytics, websocket

# Import models so SQLAlchemy creates all tables on startup
from app.models import user, project, task  # noqa: F401

logger = logging.getLogger(__name__)


# ============================================================================
# LIFESPAN EVENTS
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    # Startup
    logger.info("╔══════════════════════════════════════════╗")
    logger.info("║     TaskSyncer Backend Starting...       ║")
    logger.info("╚══════════════════════════════════════════╝")
    
    # Initialize database
    try:
        sync_init_db()
        logger.info("✓ Database initialized")
    except Exception as e:
        logger.error(f"✗ Database initialization failed: {e}")
    
    # Check database connection
    if sync_check_db_connection():
        logger.info("✓ Database connection verified")
    else:
        logger.error("✗ Database connection failed")
    
    logger.info("✓ All services ready\n")
    
    yield
    
    # Shutdown
    logger.info("\n╔══════════════════════════════════════════╗")
    logger.info("║     TaskSyncer Backend Shutting Down...  ║")
    logger.info("╚══════════════════════════════════════════╝")


# ============================================================================
# CREATE FASTAPI APP
# ============================================================================

app = FastAPI(
    title="TaskSyncer API",
    description="Supabase-powered Collaborative Task Manager",
    version="2.0.0",
    lifespan=lifespan,
)

# ============================================================================
# MIDDLEWARE
# ============================================================================

# CORS middleware - allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # Authentication uses bearer tokens in the Authorization header, not cookies.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# HEALTH CHECK ROUTES
# ============================================================================

@app.get("/", tags=["Health"])
async def root():
    """API root endpoint."""
    return {
        "service": "TaskSyncer API",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def api_health():
    """Extended health check with database status."""
    return await health_check()


@app.get("/ready", tags=["Health"])
async def readiness_check():
    """Kubernetes readiness probe - checks if service is ready."""
    db_status = sync_check_db_connection()
    return {
        "ready": db_status,
        "database": "connected" if db_status else "disconnected",
    }


# ============================================================================
# ROUTERS
# ============================================================================

app.include_router(auth.router, prefix="/api", tags=["Authentication"])
app.include_router(projects.router, prefix="/api", tags=["Projects"])
app.include_router(tasks.router, prefix="/api", tags=["Tasks"])
app.include_router(analytics.router, prefix="/api", tags=["Analytics"])
app.include_router(websocket.router, prefix="/api", tags=["WebSocket"])


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Handle all uncaught exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return {
        "error": "Internal server error",
        "detail": str(exc),
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
