"""Calendar events API routes — replaces frontend direct Supabase calls."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import get_db
from app.infrastructure.models import CalendarEvent
from app.middleware.auth import get_current_user_id
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError

router = APIRouter(prefix="/calendar-events", tags=["calendar-events"])


# ── Request Models ────────────────────────────────────────

class CalendarEventCreate(BaseModel):
    squad_id: str
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    event_type: Optional[str] = None


class CalendarEventUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    event_type: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────

def _row_to_dict(row) -> dict:
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if hasattr(val, 'hex'):
            val = str(val)
        d[col.name] = val
    return d


# ── Endpoints ─────────────────────────────────────────────

@router.get("")
async def list_calendar_events(
    squad_id: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List calendar events with optional squad and date filtering."""
    if squad_id:
        await get_coach_membership(db, user_id, squad_id)

    stmt = select(CalendarEvent)

    conditions = []
    if squad_id:
        conditions.append(CalendarEvent.squad_id == squad_id)
    if from_date:
        conditions.append(CalendarEvent.start_date >= datetime.fromisoformat(from_date.replace("Z", "+00:00")))
    if to_date:
        conditions.append(CalendarEvent.end_date <= datetime.fromisoformat(to_date.replace("Z", "+00:00")))

    if conditions:
        stmt = stmt.where(and_(*conditions))

    result = await db.execute(stmt)
    events = result.scalars().all()
    return [_row_to_dict(e) for e in events]


@router.get("/{event_id}")
async def get_calendar_event(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a single calendar event."""
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    await get_coach_membership(db, user_id, str(event.squad_id))
    return _row_to_dict(event)


@router.post("")
async def create_calendar_event(
    body: CalendarEventCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a calendar event."""
    await get_coach_membership(db, user_id, body.squad_id)

    event = CalendarEvent(
        squad_id=body.squad_id,
        name=body.name,
        start_date=body.start_date,
        end_date=body.end_date,
        event_type=body.event_type,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return _row_to_dict(event)


@router.put("/{event_id}")
async def update_calendar_event(
    event_id: str,
    body: CalendarEventUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a calendar event."""
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found")

    await get_coach_membership(db, user_id, str(event.squad_id))

    if body.name is not None:
        event.name = body.name
    if body.start_date is not None:
        event.start_date = body.start_date
    if body.end_date is not None:
        event.end_date = body.end_date
    if body.event_type is not None:
        event.event_type = body.event_type

    await db.commit()
    await db.refresh(event)
    return _row_to_dict(event)


@router.delete("/{event_id}")
async def delete_calendar_event(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a calendar event."""
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found")

    await get_coach_membership(db, user_id, str(event.squad_id))

    await db.delete(event)
    await db.commit()
    return {"success": True}
