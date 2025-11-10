# backend/app/middleware/auth.py
"""
Authentication middleware for FastAPI using Supabase JWT verification
"""

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError, ExpiredSignatureError, JWTClaimsError
import os
from typing import Optional, Dict, Any
import requests
from functools import lru_cache
from app.utils import logger, log_auth_event, log_error

security = HTTPBearer()

# Cache JWKS for 1 hour to avoid repeated requests
@lru_cache(maxsize=1)
def get_supabase_jwks() -> Dict[str, Any]:
    """Fetch Supabase JWKS (JSON Web Key Set) for JWT verification"""
    supabase_url = os.getenv("SUPABASE_URL")
    if not supabase_url:
        logger.error("SUPABASE_URL environment variable not configured")
        raise ValueError("SUPABASE_URL not configured")
    
    # Supabase exposes JWKS at /.well-known/jwks.json
    jwks_url = f"{supabase_url}/.well-known/jwks.json"
    
    try:
        logger.debug(f"Fetching JWKS from {jwks_url}")
        response = requests.get(jwks_url, timeout=5)
        response.raise_for_status()
        logger.info("Successfully fetched JWKS from Supabase")
        return response.json()
    except requests.RequestException as e:
        log_error(e, context="fetch_jwks", jwks_url=jwks_url)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch JWKS from Supabase: {str(e)}"
        )


def verify_supabase_token(token: str) -> Dict[str, Any]:
    """
    Verify Supabase JWT token and return decoded payload
    
    Args:
        token: JWT token from Authorization header
        
    Returns:
        Decoded token payload with user information
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    jwt_secret = os.getenv("SUPABASE_JWT_SECRET")
    
    if not jwt_secret:
        logger.error("SUPABASE_JWT_SECRET environment variable not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT secret not configured"
        )
    
    try:
        logger.debug("Verifying JWT token")
        # Decode and verify the JWT token
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": True,
            },
            audience="authenticated"
        )
        
        user_id = payload.get("sub", "unknown")
        user_email = payload.get("email", "unknown")
        log_auth_event("token_verify", user_id=user_id, success=True, email=user_email)
        
        return payload
        
    except ExpiredSignatureError as e:
        log_auth_event("token_verify", success=False, reason="expired")
        log_error(e, context="verify_jwt", reason="Token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTClaimsError as e:
        log_auth_event("token_verify", success=False, reason="invalid_claims")
        log_error(e, context="verify_jwt", reason="Invalid claims")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token claims: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        log_auth_event("token_verify", success=False, reason="invalid_token")
        log_error(e, context="verify_jwt", reason="JWT error")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> Dict[str, Any]:
    """
    FastAPI dependency to get current authenticated user from JWT token
    
    Usage:
        @app.get("/protected")
        async def protected_route(user = Depends(get_current_user)):
            return {"user_id": user["sub"]}
    
    Returns:
        User payload from JWT token including:
        - sub: User ID
        - email: User email
        - role: User role
        - aud: Audience
        - exp: Expiration time
    """
    logger.debug("Authenticating request via get_current_user")
    token = credentials.credentials
    return verify_supabase_token(token)


async def get_current_user_id(
    user: Dict[str, Any] = Security(get_current_user)
) -> str:
    """
    Convenience dependency to extract just the user ID
    
    Usage:
        @app.get("/my-data")
        async def get_my_data(user_id: str = Depends(get_current_user_id)):
            return {"user_id": user_id}
    """
    user_id = user["sub"]
    logger.debug(f"Extracted user_id: {user_id}")
    return user_id


class OptionalAuth:
    """
    Optional authentication - doesn't raise error if no token provided
    Useful for public endpoints that behave differently for authenticated users
    
    Usage:
        @app.get("/public")
        async def public_route(user = Depends(OptionalAuth())):
            if user:
                return {"message": f"Hello {user['email']}"}
            return {"message": "Hello guest"}
    """
    
    async def __call__(
        self,
        credentials: Optional[HTTPAuthorizationCredentials] = Security(
            HTTPBearer(auto_error=False)
        )
    ) -> Optional[Dict[str, Any]]:
        if credentials is None:
            logger.debug("No credentials provided for optional auth")
            return None
        
        try:
            return verify_supabase_token(credentials.credentials)
        except HTTPException:
            logger.debug("Optional auth failed, returning None")
            return None
