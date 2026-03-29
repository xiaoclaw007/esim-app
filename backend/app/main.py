"""FastAPI application — eSIM reseller backend.

This is the main entry point. It sets up:
- CORS (so the frontend on GitHub Pages can call our API)
- All route handlers
- Database table creation
- Background order poller
"""

import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import auth, checkout, orders, plans, users, webhooks
from app.tasks.order_poller import poll_pending_orders

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="eSIM API",
    description="Backend API for eSIM reseller — handles checkout, JoyTel integration, and QR delivery.",
    version="0.2.0",
)

# CORS — allow the frontend to call our API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",  # Local dev
        "http://localhost:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(plans.router)
app.include_router(checkout.router)
app.include_router(orders.router)
app.include_router(webhooks.router)
app.include_router(auth.router)
app.include_router(users.router)


@app.on_event("startup")
async def startup():
    """Run on app startup — create DB tables and start background tasks."""
    # Create database tables (for dev with SQLite, this is fine.
    # In production, use Alembic migrations instead.)
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")

    # Start background order poller
    asyncio.create_task(poll_pending_orders())
    logger.info("Order poller started")


@app.get("/api/health")
def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "env": settings.app_env}
