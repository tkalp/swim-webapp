# backend/app/routes/beta.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

from app.infrastructure.database import get_supabase_client
from app.utils import logger

router = APIRouter(prefix="/beta", tags=["beta"])


class BetaSubmissionRequest(BaseModel):
    email: EmailStr
    name: str
    team_size: Optional[str] = None
    current_tools: Optional[str] = None
    pain_points: Optional[str] = None
    budget_range: Optional[str] = None


class BetaSubmissionResponse(BaseModel):
    success: bool
    message: str
    id: Optional[str] = None


@router.post("/submit", response_model=BetaSubmissionResponse)
async def submit_beta_request(request: BetaSubmissionRequest):
    """
    Submit a beta access request from the landing page.
    
    Inserts the submission into beta_waitlist table and triggers email notifications:
    1. Confirmation email to applicant
    2. Notification email to admin
    """
    try:
        supabase = get_supabase_client()
        
        # Insert into beta_waitlist table
        result = supabase.table('beta_waitlist').insert({
            'email': request.email,
            'name': request.name,
            'team_size': request.team_size,
            'current_tools': request.current_tools,
            'pain_points': request.pain_points,
            'budget_range': request.budget_range,
            'status': 'pending',
            'created_at': datetime.utcnow().isoformat()
        }).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to submit beta request")
        
        submission_id = result.data[0]['id']
        
        logger.info(
            f"Beta request submitted: {request.email} | "
            f"Team Size: {request.team_size} | "
            f"Budget: {request.budget_range}"
        )
        
        # TODO: Trigger email notifications via Supabase Edge Function
        # 1. Send confirmation email to applicant
        # 2. Send notification to admin with submission details
        
        return BetaSubmissionResponse(
            success=True,
            message="Beta request submitted successfully",
            id=submission_id
        )
        
    except Exception as e:
        logger.error(f"Error submitting beta request: {str(e)}")
        
        # Check for duplicate email (unique constraint violation)
        if "duplicate key" in str(e).lower() or "unique constraint" in str(e).lower():
            raise HTTPException(
                status_code=409,
                detail="This email has already been registered for beta access"
            )
        
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/count")
async def get_beta_count():
    """
    Get the count of beta submissions.
    Used to display "X spots remaining" on the landing page.
    """
    try:
        supabase = get_supabase_client()
        
        result = supabase.table('beta_waitlist') \
            .select('id', count='exact') \
            .execute()
        
        count = result.count if result.count is not None else 0
        
        return {
            'success': True,
            'count': count,
            'remaining': max(0, 50 - count)
        }
        
    except Exception as e:
        logger.error(f"Error getting beta count: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
