"""Swimmers routes module - modularized structure.

This package contains all swimmer-related API routes, organized by concern:
- core: Basic CRUD operations for swimmers
- performance: Best times, splits, and FINA points
- predictions: Improvement predictions and analytics
- sync: External data synchronization management
"""
from fastapi import APIRouter

from . import core, performance, predictions, sync

# Create main router
router = APIRouter(prefix="/swimmers", tags=["swimmers"])

# Include sub-routers
router.include_router(core.router)
router.include_router(performance.router)
router.include_router(predictions.router)
router.include_router(sync.router)

__all__ = ["router"]
