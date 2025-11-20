# backend/app/routes/coach_connections.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List

from app.infrastructure.database import get_supabase_client
from app.middleware.auth import get_current_user_id
from app.utils import logger, log_error

router = APIRouter(prefix="/coach-connections", tags=["coach-connections"])


class ConnectionRequest(BaseModel):
    recipient_id: str


class ConnectionResponse(BaseModel):
    connection_id: str
    accept: bool


@router.get("/my-connections")
async def get_my_connections(
    user_id: str = Depends(get_current_user_id)
):
    """Get all accepted connections for the current user"""
    try:
        supabase = get_supabase_client()
        logger.info(f"Fetching connections for user {user_id}")
        
        # Query coach_connections table for accepted connections
        response = supabase.table("coach_connections").select("*").or_(
            f"requester_id.eq.{user_id},recipient_id.eq.{user_id}"
        ).eq("status", "accepted").execute()
        
        return {"connections": response.data}
        
    except Exception as e:
        logger.error(f"Error fetching connections: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/request")
async def send_connection_request(
    request: ConnectionRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Send a connection request to another coach"""
    try:
        supabase = get_supabase_client()
        logger.info(f"User {user_id} sending connection request to {request.recipient_id}")
        
        # Insert connection request
        response = supabase.table("coach_connections").insert({
            "requester_id": user_id,
            "recipient_id": request.recipient_id,
            "status": "pending"
        }).execute()
        
        return {"message": "Connection request sent", "success": True, "connection": response.data[0]}
        
    except Exception as e:
        logger.error(f"Error sending connection request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/respond")
async def respond_to_connection(
    response: ConnectionResponse,
    user_id: str = Depends(get_current_user_id)
):
    """Accept or decline a connection request"""
    try:
        supabase = get_supabase_client()
        logger.info(f"User {user_id} responding to connection {response.connection_id} | accept={response.accept}")
        
        # Update connection status
        status = "accepted" if response.accept else "declined"
        update_response = supabase.table("coach_connections").update({
            "status": status
        }).eq("id", response.connection_id).eq("recipient_id", user_id).execute()
        
        if not update_response.data:
            raise HTTPException(status_code=404, detail="Connection not found or unauthorized")
        
        return {"message": "Response recorded", "success": True, "connection": update_response.data[0]}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error responding to connection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{connection_id}")
async def remove_connection(
    connection_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Remove a connection"""
    try:
        supabase = get_supabase_client()
        logger.info(f"User {user_id} removing connection {connection_id}")
        
        # Delete connection (user must be either requester or recipient)
        delete_response = supabase.table("coach_connections").delete().eq(
            "id", connection_id
        ).or_(
            f"requester_id.eq.{user_id},recipient_id.eq.{user_id}"
        ).execute()
        
        if not delete_response.data:
            raise HTTPException(status_code=404, detail="Connection not found or unauthorized")
        
        return {"message": "Connection removed", "success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing connection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_coaches(
    email: Optional[str] = None,
    name: Optional[str] = None,
    user_id: str = Depends(get_current_user_id)
):
    """Search for coaches by email or name"""
    try:
        supabase = get_supabase_client()
        logger.info(f"User {user_id} searching coaches | email={email} | name={name}")
        
        # Search in auth.users for coaches (assuming coaches have a role or metadata)
        # This is a simplified version - adjust based on your auth setup
        query = supabase.table("profiles").select("*")
        
        if email:
            query = query.ilike("email", f"%{email}%")
        if name:
            query = query.or_(f"first_name.ilike.%{name}%,last_name.ilike.%{name}%")
        
        # Exclude current user
        query = query.neq("id", user_id)
        
        response = query.execute()
        
        return {"coaches": response.data}
        
    except Exception as e:
        logger.error(f"Error searching coaches: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
