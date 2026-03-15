"""Workout-tag endpoints -- CRUD for tags and tag-template associations."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from sqlalchemy import select, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db import get_db
from app.infrastructure.models import WorkoutTag, WorkoutTemplateTag
from app.middleware.auth import get_current_user_id

router = APIRouter()


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


def _tag_to_dict(tag: WorkoutTag) -> dict:
    """Convert a WorkoutTag ORM instance to a dict for TagResponse."""
    return {
        "id": str(tag.id),
        "coach_id": str(tag.coach_id),
        "name": tag.name,
        "color": tag.color or "",
        "created_at": tag.created_at,
        "updated_at": tag.updated_at,
    }


@router.get("/coaches/{coach_id}/tags", response_model=List[TagResponse])
async def get_coach_tags(
    coach_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all tags for a coach"""
    try:
        result = await db.execute(
            select(WorkoutTag)
            .where(WorkoutTag.coach_id == coach_id)
            .order_by(WorkoutTag.name)
        )
        rows = result.scalars().all()
        return [_tag_to_dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/coaches/{coach_id}/tags", response_model=TagResponse)
async def create_tag(
    coach_id: str,
    tag: CreateTagRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new tag"""
    try:
        # Check if tag name already exists for this coach
        existing = await db.execute(
            select(WorkoutTag.id).where(
                and_(
                    WorkoutTag.coach_id == coach_id,
                    WorkoutTag.name == tag.name,
                )
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="Tag with this name already exists")

        new_tag = WorkoutTag(
            coach_id=coach_id,
            name=tag.name,
            color=tag.color,
        )
        db.add(new_tag)
        await db.flush()
        await db.commit()
        await db.refresh(new_tag)

        return _tag_to_dict(new_tag)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tags/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: str,
    tag: UpdateTagRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a tag"""
    try:
        result = await db.execute(
            select(WorkoutTag).where(WorkoutTag.id == tag_id)
        )
        existing_tag = result.scalar_one_or_none()

        if not existing_tag:
            raise HTTPException(status_code=404, detail="Tag not found")

        if tag.name is None and tag.color is None:
            raise HTTPException(status_code=400, detail="No fields to update")

        if tag.name is not None:
            existing_tag.name = tag.name
        if tag.color is not None:
            existing_tag.color = tag.color

        await db.commit()
        await db.refresh(existing_tag)

        return _tag_to_dict(existing_tag)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tags/{tag_id}")
async def delete_tag(
    tag_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a tag"""
    try:
        result = await db.execute(
            select(WorkoutTag).where(WorkoutTag.id == tag_id)
        )
        existing_tag = result.scalar_one_or_none()

        if not existing_tag:
            raise HTTPException(status_code=404, detail="Tag not found")

        await db.delete(existing_tag)
        await db.commit()

        return {"message": "Tag deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workouts/{workout_id}/tags/{tag_id}")
async def add_tag_to_workout(
    workout_id: str,
    tag_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Add a tag to a workout"""
    try:
        # Check if association already exists
        existing = await db.execute(
            select(WorkoutTemplateTag.id).where(
                and_(
                    WorkoutTemplateTag.workout_id == workout_id,
                    WorkoutTemplateTag.tag_id == tag_id,
                )
            )
        )
        if existing.scalar_one_or_none() is not None:
            return {"message": "Tag already associated with workout"}

        assoc = WorkoutTemplateTag(
            workout_id=workout_id,
            tag_id=tag_id,
        )
        db.add(assoc)
        await db.flush()
        await db.commit()

        return {"message": "Tag added to workout successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/workouts/{workout_id}/tags/{tag_id}")
async def remove_tag_from_workout(
    workout_id: str,
    tag_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove a tag from a workout"""
    try:
        await db.execute(
            delete(WorkoutTemplateTag).where(
                and_(
                    WorkoutTemplateTag.workout_id == workout_id,
                    WorkoutTemplateTag.tag_id == tag_id,
                )
            )
        )
        await db.commit()

        return {"message": "Tag removed from workout successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workouts/{workout_id}/tags", response_model=List[TagResponse])
async def get_workout_tags(
    workout_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all tags for a workout"""
    try:
        result = await db.execute(
            select(WorkoutTag)
            .join(WorkoutTemplateTag, WorkoutTemplateTag.tag_id == WorkoutTag.id)
            .where(WorkoutTemplateTag.workout_id == workout_id)
        )
        tags = result.scalars().all()

        return [_tag_to_dict(tag) for tag in tags]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
