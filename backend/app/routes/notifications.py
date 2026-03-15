"""Notifications API routes — replaces frontend real-time Supabase subscriptions with polling."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import get_db
from app.infrastructure.models import (
    SquadInvitation, CoachConnection, Coach, Squad, User,
    NotificationReadStatus,
)
from app.middleware.auth import get_current_user_id

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _row_to_dict(row) -> dict:
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if hasattr(val, 'hex'):
            val = str(val)
        d[col.name] = val
    return d


@router.get("/count")
async def get_notification_count(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get total count of pending notifications (invitations + connection requests)."""
    # Get user email for invitation lookups
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    # Get coach record for connection lookups
    coach_result = await db.execute(select(Coach).where(Coach.user_id == user_id))
    coach = coach_result.scalar_one_or_none()

    invitation_count = 0
    connection_count = 0

    if user:
        result = await db.execute(
            select(func.count())
            .select_from(SquadInvitation)
            .where(SquadInvitation.invited_email == user.email)
            .where(SquadInvitation.status == "pending")
        )
        invitation_count = result.scalar_one()

    if coach:
        result = await db.execute(
            select(func.count())
            .select_from(CoachConnection)
            .where(CoachConnection.recipient_id == coach.id)
            .where(CoachConnection.status == "pending")
        )
        connection_count = result.scalar_one()

    return {
        "total": invitation_count + connection_count,
        "invitations": invitation_count,
        "connections": connection_count,
    }


@router.get("/all")
async def get_all_notifications(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all pending notifications with details, including read status."""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    coach_result = await db.execute(select(Coach).where(Coach.user_id == user_id))
    coach = coach_result.scalar_one_or_none()

    notifications = []

    # Pending squad invitations
    if user:
        inv_result = await db.execute(
            select(SquadInvitation, Squad)
            .join(Squad, Squad.id == SquadInvitation.squad_id)
            .where(SquadInvitation.invited_email == user.email)
            .where(SquadInvitation.status == "pending")
            .order_by(SquadInvitation.created_at.desc())
        )
        for inv, squad in inv_result.all():
            d = _row_to_dict(inv)
            d["type"] = "invitation"
            d["squad"] = _row_to_dict(squad)
            notifications.append(d)

    # Pending connection requests
    if coach:
        conn_result = await db.execute(
            select(CoachConnection, Coach)
            .join(Coach, Coach.id == CoachConnection.requester_id)
            .where(CoachConnection.recipient_id == coach.id)
            .where(CoachConnection.status == "pending")
            .order_by(CoachConnection.created_at.desc())
        )
        for conn, requester in conn_result.all():
            d = _row_to_dict(conn)
            d["type"] = "connection_request"
            d["requester"] = _row_to_dict(requester)
            notifications.append(d)

    # Fetch read statuses for current user
    if notifications:
        notification_ids = [str(n["id"]) for n in notifications]
        read_result = await db.execute(
            select(NotificationReadStatus).where(
                NotificationReadStatus.user_id == user_id,
                NotificationReadStatus.notification_id.in_(notification_ids),
            )
        )
        read_set = {r.notification_id for r in read_result.scalars().all()}
        for n in notifications:
            n["read"] = str(n["id"]) in read_set
    else:
        for n in notifications:
            n["read"] = False

    return notifications


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    notification_type: str = Query(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read (idempotent)."""
    existing = await db.execute(
        select(NotificationReadStatus).where(
            NotificationReadStatus.user_id == user_id,
            NotificationReadStatus.notification_type == notification_type,
            NotificationReadStatus.notification_id == notification_id,
        )
    )
    if not existing.scalar_one_or_none():
        db.add(NotificationReadStatus(
            user_id=user_id,
            notification_type=notification_type,
            notification_id=notification_id,
        ))
        await db.commit()
    return {"success": True}
