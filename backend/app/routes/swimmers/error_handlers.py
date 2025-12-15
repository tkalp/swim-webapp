"""Error handling utilities for swimmer routes."""
from fastapi import HTTPException
from app.domain.exceptions import (
    ApplicationError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
    DatabaseError
)
from app.utils import log_error


def handle_service_error(e: Exception) -> HTTPException:
    """Convert service exceptions to HTTP exceptions.
    
    Args:
        e: Exception from service layer
        
    Returns:
        HTTPException with appropriate status code and message
    """
    if isinstance(e, NotFoundError):
        return HTTPException(status_code=404, detail=e.message)
    elif isinstance(e, UnauthorizedError):
        return HTTPException(status_code=403, detail=e.message)
    elif isinstance(e, ValidationError):
        return HTTPException(status_code=422, detail=e.message)
    elif isinstance(e, DatabaseError):
        log_error(e, context="database_error")
        return HTTPException(status_code=500, detail=e.message)
    elif isinstance(e, ApplicationError):
        return HTTPException(status_code=e.status_code, detail=e.message)
    else:
        log_error(e, context="swimmers_route")
        return HTTPException(status_code=500, detail="Internal server error")
