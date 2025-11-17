# backend/app/routes/coach_connections.py
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
import os
from supabase import create_client, Client

from app.utils import logger, log_error

router = APIRouter(prefix="/coach-connections", tags=["coach-connections"])


def get_supabase_client() -> Client:
    """Get Supabase client instance"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables")
    
    return create_client(supabase_url, supabase_key)


class ConnectionRequest(BaseModel):
    recipient_id: str


class ConnectionResponse(BaseModel):
    connection_id: str
    accept: bool


@router.get("/my-connections")
async def get_my_connections(
    authorization: str = Header(None)
):
    """Get all accepted connections for the current user"""
    try:
        supabase = get_supabase_client()
        
        # Extract user ID from authorization header
        # This is a simplified version - in production, properly verify the JWT
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
        # For now, we'll need to extract the user ID from the token
        # In a real implementation, you'd verify and decode the JWT
        # For simplicity, we'll assume the frontend passes the user_id
        
        logger.info(f"Fetching connections for user")
        
        # This endpoint should be called from frontend with proper user context
        # For now, return empty list - frontend should use Supabase client directly
        return {"connections": []}
        
    except Exception as e:
        log_error(logger, e, {"endpoint": "get_my_connections"})
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/request")
async def send_connection_request(
    request: ConnectionRequest,
    authorization: str = Header(None)
):
    """Send a connection request to another coach"""
    try:
        supabase = get_supabase_client()
        
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
        logger.info(f"Sending connection request to {request.recipient_id}")
        
        # Frontend should use Supabase client directly for this
        # This is just a placeholder endpoint
        
        return {"message": "Connection request sent", "success": True}
        
    except Exception as e:
        log_error(logger, e, {"endpoint": "send_connection_request", "recipient_id": request.recipient_id})
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/respond")
async def respond_to_connection(
    response: ConnectionResponse,
    authorization: str = Header(None)
):
    """Accept or decline a connection request"""
    try:
        supabase = get_supabase_client()
        
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
        logger.info(f"Responding to connection {response.connection_id} | accept={response.accept}")
        
        # Frontend should use Supabase client directly for this
        # This is just a placeholder endpoint
        
        return {"message": "Response recorded", "success": True}
        
    except Exception as e:
        log_error(logger, e, {"endpoint": "respond_to_connection", "connection_id": response.connection_id})
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{connection_id}")
async def remove_connection(
    connection_id: str,
    authorization: str = Header(None)
):
    """Remove a connection"""
    try:
        supabase = get_supabase_client()
        
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
        logger.info(f"Removing connection {connection_id}")
        
        # Frontend should use Supabase client directly for this
        # This is just a placeholder endpoint
        
        return {"message": "Connection removed", "success": True}
        
    except Exception as e:
        log_error(logger, e, {"endpoint": "remove_connection", "connection_id": connection_id})
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_coaches(
    email: Optional[str] = None,
    name: Optional[str] = None,
    authorization: str = Header(None)
):
    """Search for coaches by email or name"""
    try:
        supabase = get_supabase_client()
        
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
        logger.info(f"Searching coaches | email={email} | name={name}")
        
        # Frontend should use Supabase client directly for this
        # This is just a placeholder endpoint
        
        return {"coaches": []}
        
    except Exception as e:
        log_error(logger, e, {"endpoint": "search_coaches", "email": email, "name": name})
        raise HTTPException(status_code=500, detail=str(e))
