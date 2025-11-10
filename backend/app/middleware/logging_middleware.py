# app/middleware/logging_middleware.py
"""
Logging middleware for FastAPI to track all requests and responses
"""
import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.utils import logger, log_request, log_response


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all HTTP requests and responses"""
    
    async def dispatch(self, request: Request, call_next):
        # Start timer
        start_time = time.time()
        
        # Extract request details
        method = request.method
        path = request.url.path
        client_host = request.client.host if request.client else "unknown"
        
        # Log request
        log_request(
            method=method,
            path=path,
            client_ip=client_host,
            query_params=str(request.query_params) if request.query_params else None
        )
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Log response
            log_response(
                method=method,
                path=path,
                status_code=response.status_code,
                duration_ms=duration_ms
            )
            
            return response
            
        except Exception as e:
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Log error
            logger.error(
                f"REQUEST FAILED {method} {path} | "
                f"error={type(e).__name__}: {str(e)} | "
                f"duration={duration_ms:.2f}ms"
            )
            
            # Re-raise to let FastAPI handle it
            raise
