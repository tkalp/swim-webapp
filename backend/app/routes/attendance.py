"""Training attendance API routes — replaces frontend direct Supabase calls."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import get_db
from app.infrastructure.models import TrainingAttendance, TrainingSession, Swimmer
from app.middleware.auth import get_current_user_id
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError

router = APIRouter(prefix="/attendance", tags=["attendance"])


# ── Request Models ────────────────────────────────────────

class AttendanceUpsert(BaseModel):
    training_session_id: str
    swimmer_id: str
    status: str
    notes: Optional[str] = None


class BulkAttendanceRecord(BaseModel):
    swimmer_id: str
    status: str
    notes: Optional[str] = None


class BulkAttendanceUpsert(BaseModel):
    session_id: str
    records: List[BulkAttendanceRecord]


class MarkRemainingAbsent(BaseModel):
    session_id: str
    squad_id: str


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

async def _get_session_squad_id(db: AsyncSession, session_id: str) -> str:
    """Look up the squad_id for a training session. Raises 404 if not found."""
    result = await db.execute(
        select(TrainingSession).where(TrainingSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Training session not found")
    return str(session.squad_id)


@router.get("/session/{session_id}")
async def list_session_attendance(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List attendance for a session, ordered by created_at desc."""
    squad_id = await _get_session_squad_id(db, session_id)
    await get_coach_membership(db, user_id, squad_id)

    result = await db.execute(
        select(TrainingAttendance)
        .where(TrainingAttendance.training_session_id == session_id)
        .order_by(TrainingAttendance.created_at.desc())
    )
    records = result.scalars().all()
    return [_row_to_dict(r) for r in records]


@router.get("/swimmer/{swimmer_id}")
async def list_swimmer_attendance(
    swimmer_id: str,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List attendance for a swimmer with optional date filtering."""
    stmt = select(TrainingAttendance).where(
        TrainingAttendance.swimmer_id == swimmer_id
    )

    if from_date:
        stmt = stmt.where(TrainingAttendance.created_at >= datetime.fromisoformat(from_date.replace("Z", "+00:00")))
    if to_date:
        stmt = stmt.where(TrainingAttendance.created_at <= datetime.fromisoformat(to_date.replace("Z", "+00:00")))

    result = await db.execute(stmt)
    records = result.scalars().all()
    return [_row_to_dict(r) for r in records]


@router.post("/upsert")
async def upsert_attendance(
    body: AttendanceUpsert,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Upsert single attendance record. Check by (session_id, swimmer_id)."""
    squad_id = await _get_session_squad_id(db, body.training_session_id)
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_manage_attendance:
        raise UnauthorizedError("Missing permission: can_manage_attendance")

    result = await db.execute(
        select(TrainingAttendance).where(
            and_(
                TrainingAttendance.training_session_id == body.training_session_id,
                TrainingAttendance.swimmer_id == body.swimmer_id,
            )
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.status = body.status
        existing.notes = body.notes
        await db.commit()
        await db.refresh(existing)
        return _row_to_dict(existing)
    else:
        record = TrainingAttendance(
            training_session_id=body.training_session_id,
            swimmer_id=body.swimmer_id,
            status=body.status,
            notes=body.notes,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return _row_to_dict(record)


@router.post("/bulk-upsert")
async def bulk_upsert_attendance(
    body: BulkAttendanceUpsert,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Bulk upsert attendance records for a session."""
    squad_id = await _get_session_squad_id(db, body.session_id)
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_manage_attendance:
        raise UnauthorizedError("Missing permission: can_manage_attendance")

    results = []
    for rec in body.records:
        existing_result = await db.execute(
            select(TrainingAttendance).where(
                and_(
                    TrainingAttendance.training_session_id == body.session_id,
                    TrainingAttendance.swimmer_id == rec.swimmer_id,
                )
            )
        )
        existing = existing_result.scalar_one_or_none()

        if existing:
            existing.status = rec.status
            existing.notes = rec.notes
            await db.flush()
            results.append(existing)
        else:
            record = TrainingAttendance(
                training_session_id=body.session_id,
                swimmer_id=rec.swimmer_id,
                status=rec.status,
                notes=rec.notes,
            )
            db.add(record)
            await db.flush()
            results.append(record)

    await db.commit()
    # Refresh all records
    for r in results:
        await db.refresh(r)
    return [_row_to_dict(r) for r in results]


@router.delete("/{attendance_id}")
async def delete_attendance(
    attendance_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete an attendance record."""
    result = await db.execute(
        select(TrainingAttendance).where(TrainingAttendance.id == attendance_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    squad_id = await _get_session_squad_id(db, str(record.training_session_id))
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_manage_attendance:
        raise UnauthorizedError("Missing permission: can_manage_attendance")

    await db.delete(record)
    await db.commit()
    return {"success": True}


@router.get("/session/{session_id}/with-swimmers")
async def attendance_with_swimmers(
    session_id: str,
    squad_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Attendance with swimmer details and summary stats."""
    await get_coach_membership(db, user_id, squad_id)

    # Get all swimmers in the squad
    swimmers_result = await db.execute(
        select(Swimmer)
        .where(Swimmer.squad_id == squad_id)
        .order_by(Swimmer.last_name)
    )
    swimmers = swimmers_result.scalars().all()

    # Get attendance records for this session
    attendance_result = await db.execute(
        select(TrainingAttendance)
        .where(TrainingAttendance.training_session_id == session_id)
    )
    attendance_records = attendance_result.scalars().all()

    # Build lookup by swimmer_id
    attendance_lookup = {}
    for rec in attendance_records:
        attendance_lookup[str(rec.swimmer_id)] = _row_to_dict(rec)

    # Build response
    swimmer_list = []
    summary = {"total": len(swimmers), "present": 0, "late": 0, "absent": 0, "not_recorded": 0}

    for s in swimmers:
        sid = str(s.id)
        att = attendance_lookup.get(sid)
        swimmer_list.append({
            "id": sid,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "attendance": att,
        })

        if att:
            status = (att.get("status") or "").lower()
            if status == "present":
                summary["present"] += 1
            elif status == "late":
                summary["late"] += 1
            elif status == "absent":
                summary["absent"] += 1
            else:
                summary["not_recorded"] += 1
        else:
            summary["not_recorded"] += 1

    return {"swimmers": swimmer_list, "summary": summary}


@router.post("/mark-remaining-absent")
async def mark_remaining_absent(
    body: MarkRemainingAbsent,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Mark all swimmers without attendance records as absent."""
    membership = await get_coach_membership(db, user_id, body.squad_id)
    if not membership.can_manage_attendance:
        raise UnauthorizedError("Missing permission: can_manage_attendance")

    # Get all swimmers in squad
    swimmers_result = await db.execute(
        select(Swimmer.id).where(Swimmer.squad_id == body.squad_id)
    )
    swimmer_ids = [str(row.id) for row in swimmers_result.scalars().all()]

    # Get swimmers who already have attendance
    existing_result = await db.execute(
        select(TrainingAttendance.swimmer_id)
        .where(TrainingAttendance.training_session_id == body.session_id)
    )
    recorded_ids = {str(row) for row in existing_result.scalars().all()}

    # Create absent records for remaining
    created = []
    for sid in swimmer_ids:
        if sid not in recorded_ids:
            record = TrainingAttendance(
                training_session_id=body.session_id,
                swimmer_id=sid,
                status="absent",
            )
            db.add(record)
            await db.flush()
            created.append(record)

    await db.commit()
    for r in created:
        await db.refresh(r)
    return [_row_to_dict(r) for r in created]
