"""Custom exception hierarchy for application errors."""
from typing import Optional, Dict, Any


class ApplicationError(Exception):
    """Base exception for all application errors.
    
    Attributes:
        message: Human-readable error message
        status_code: HTTP status code
        details: Additional error context
    """
    
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class NotFoundError(ApplicationError):
    """Raised when a requested resource is not found."""
    
    def __init__(self, resource: str, identifier: Any, details: Optional[Dict[str, Any]] = None):
        message = f"{resource} not found: {identifier}"
        super().__init__(message, status_code=404, details=details)


class UnauthorizedError(ApplicationError):
    """Raised when user lacks permission for an action."""
    
    def __init__(self, message: str = "Unauthorized access", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=403, details=details)


class ValidationError(ApplicationError):
    """Raised when input validation fails."""
    
    def __init__(self, message: str, field: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        details = details or {}
        if field:
            details["field"] = field
        super().__init__(message, status_code=422, details=details)


class ConflictError(ApplicationError):
    """Raised when an operation conflicts with existing data."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=409, details=details)


class DatabaseError(ApplicationError):
    """Raised when database operations fail."""
    
    def __init__(self, message: str = "Database operation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=500, details=details)


class ExternalServiceError(ApplicationError):
    """Raised when external service calls fail."""
    
    def __init__(
        self,
        service: str,
        message: str = "External service error",
        details: Optional[Dict[str, Any]] = None
    ):
        details = details or {}
        details["service"] = service
        super().__init__(message, status_code=502, details=details)
