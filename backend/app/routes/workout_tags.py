# app/routes/workout_tags.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
from supabase import create_client, Client

router = APIRouter()


def get_supabase_client() -> Client:
    """Get Supabase client instance"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables")
    
    return create_client(supabase_url, supabase_key)


class CreateTagRequest(BaseModel):
    name: str
    color: str


class UpdateTagRequest(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class TagResponse(BaseModel):
    id: str
    coach_id: str
    name: str
    color: str
    created_at: datetime
    updated_at: datetime


class WorkoutTagAssociation(BaseModel):
    workout_id: str
    tag_id: str


@router.get("/coaches/{coach_id}/tags", response_model=List[TagResponse])
async def get_coach_tags(coach_id: str):
    """Get all tags for a coach"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("workout_tags") \
            .select("*") \
            .eq("coach_id", coach_id) \
            .order("name") \
            .execute()
        
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/coaches/{coach_id}/tags", response_model=TagResponse)
async def create_tag(coach_id: str, tag: CreateTagRequest):
    """Create a new tag"""
    try:
        supabase = get_supabase_client()
        # Check if tag name already exists for this coach
        existing = supabase.table("workout_tags") \
            .select("id") \
            .eq("coach_id", coach_id) \
            .eq("name", tag.name) \
            .execute()
        
        if existing.data:
            raise HTTPException(status_code=400, detail="Tag with this name already exists")
        
        response = supabase.table("workout_tags").insert({
            "coach_id": coach_id,
            "name": tag.name,
            "color": tag.color
        }).execute()
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tags/{tag_id}", response_model=TagResponse)
async def update_tag(tag_id: str, tag: UpdateTagRequest):
    """Update a tag"""
    try:
        supabase = get_supabase_client()
        update_data = {}
        if tag.name is not None:
            update_data["name"] = tag.name
        if tag.color is not None:
            update_data["color"] = tag.color
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        response = supabase.table("workout_tags") \
            .update(update_data) \
            .eq("id", tag_id) \
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tags/{tag_id}")
async def delete_tag(tag_id: str):
    """Delete a tag"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("workout_tags") \
            .delete() \
            .eq("id", tag_id) \
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        return {"message": "Tag deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workouts/{workout_id}/tags/{tag_id}")
async def add_tag_to_workout(workout_id: str, tag_id: str):
    """Add a tag to a workout"""
    try:
        supabase = get_supabase_client()
        # Check if association already exists
        existing = supabase.table("workout_template_tags") \
            .select("id") \
            .eq("workout_id", workout_id) \
            .eq("tag_id", tag_id) \
            .execute()
        
        if existing.data:
            return {"message": "Tag already associated with workout"}
        
        response = supabase.table("workout_template_tags").insert({
            "workout_id": workout_id,
            "tag_id": tag_id
        }).execute()
        
        return {"message": "Tag added to workout successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/workouts/{workout_id}/tags/{tag_id}")
async def remove_tag_from_workout(workout_id: str, tag_id: str):
    """Remove a tag from a workout"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("workout_template_tags") \
            .delete() \
            .eq("workout_id", workout_id) \
            .eq("tag_id", tag_id) \
            .execute()
        
        return {"message": "Tag removed from workout successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workouts/{workout_id}/tags", response_model=List[TagResponse])
async def get_workout_tags(workout_id: str):
    """Get all tags for a workout"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("workout_template_tags") \
            .select("workout_tags(*)") \
            .eq("workout_id", workout_id) \
            .execute()
        
        tags = [item["workout_tags"] for item in response.data if item.get("workout_tags")]
        return tags
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
