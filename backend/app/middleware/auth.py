# backend/app/middleware/auth.py
"""Authentication middleware for FastAPI — verifies self-issued JWTs."""

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError, ExpiredSignatureError, JWTClaimsError
import os
from typing import Optional, Dict, Any
from app.utils import logger, log_auth_event, log_error

security = HTTPBearer()

JWT_ALGORITHM = "HS256"


def verify_token(token: str) -> Dict[str, Any]:
    """Verify a self-issued JWT token and return decoded payload."""
    jwt_secret = os.getenv("JWT_SECRET")

    if not jwt_secret:
        logger.error("JWT_SECRET not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT secret not configured",
        )

    try:
        logger.debug("Verifying JWT token")

        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=[JWT_ALGORITHM],
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": False,
            },
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
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> Dict[str, Any]:
    """
    FastAPI dependency to get current authenticated user from JWT token.

    Usage:
        @app.get("/protected")
        async def protected_route(user = Depends(get_current_user)):
            return {"user_id": user["sub"]}
    """
    logger.debug("Authenticating request via get_current_user")
    token = credentials.credentials
    return verify_token(token)


async def get_current_user_id(
    user: Dict[str, Any] = Security(get_current_user),
) -> str:
    """
    Convenience dependency to extract just the user ID.

    Usage:
        @app.get("/my-data")
        async def get_my_data(user_id: str = Depends(get_current_user_id)):
            return {"user_id": user_id}
    """
    user_id = user["sub"]
    logger.debug(f"Extracted user_id: {user_id}")

    # Set the ContextVar so get_db() can apply SET LOCAL for RLS
    from app.infrastructure.db import set_current_user_id
    set_current_user_id(user_id)

    return user_id


class OptionalAuth:
    """
    Optional authentication - doesn't raise error if no token provided.
    """

    async def __call__(
        self,
        credentials: Optional[HTTPAuthorizationCredentials] = Security(
            HTTPBearer(auto_error=False)
        ),
    ) -> Optional[Dict[str, Any]]:
        if credentials is None:
            logger.debug("No credentials provided for optional auth")
            return None

        try:
            return verify_token(credentials.credentials)
        except HTTPException:
            logger.debug("Optional auth failed, returning None")
            return None
