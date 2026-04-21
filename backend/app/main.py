from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ai, audit, auth, bulk, centers, dos, search, users, stats, tests, master_tests
from app.core.config import settings
from app.db.session import Base, engine

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    description="KRSNAA MIS DOS Management Platform - Hierarchical Center Management with AI Integration",
    version="2.0.0",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(centers.router, prefix="/api")
app.include_router(dos.router, prefix="/api")
app.include_router(bulk.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(tests.router, prefix="/api")
app.include_router(master_tests.router, prefix="/api")


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": "2.0.0",
    }
