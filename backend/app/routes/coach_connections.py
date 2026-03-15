# backend/app/routes/coach_connections.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List

from sqlalchemy import select, delete, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db import get_db
from app.infrastructure.models import CoachConnection, Coach, User
from app.middleware.auth import get_current_user_id
from app.utils import logger, log_error

router = APIRouter(prefix="/coach-connections", tags=["coach-connections"])


class ConnectionRequest(BaseModel):
    recipient_id: str


class ConnectionResponse(BaseModel):
    connection_id: str
    accept: bool


async def _get_coach(db: AsyncSession, user_id: str) -> Coach:
    """Look up the Coach for a given user_id."""
    result = await db.execute(select(Coach).where(Coach.user_id == user_id))
    coach = result.scalar_one_or_none()
    if not coach:
        raise HTTPException(status_code=400, detail="Coach profile not found")
    return coach


@router.get("/my-connections")
async def get_my_connections(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all accepted connections for the current user"""
    try:
        logger.info(f"Fetching connections for user {user_id}")
        coach = await _get_coach(db, user_id)

        result = await db.execute(
            select(CoachConnection).where(
                and_(
                    or_(
                        CoachConnection.requester_id == coach.id,
                        CoachConnection.recipient_id == coach.id,
                    ),
                    CoachConnection.status == "accepted",
                )
            )
        )
        rows = result.scalars().all()

        connections = []
        for row in rows:
            connections.append({
                "id": str(row.id),
                "requester_id": str(row.requester_id),
                "recipient_id": str(row.recipient_id),
                "status": row.status,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            })

        return {"connections": connections}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching connections: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/request")
async def send_connection_request(
    request: ConnectionRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Send a connection request to another coach"""
    try:
        logger.info(f"User {user_id} sending connection request to {request.recipient_id}")
        coach = await _get_coach(db, user_id)

        # Bug #30 fix: check for an existing pending or accepted connection in either direction
        existing_result = await db.execute(
            select(CoachConnection).where(
                or_(
                    and_(
                        CoachConnection.requester_id == coach.id,
                        CoachConnection.recipient_id == request.recipient_id,
                    ),
                    and_(
                        CoachConnection.requester_id == request.recipient_id,
                        CoachConnection.recipient_id == coach.id,
                    ),
                ),
                CoachConnection.status.in_(["pending", "accepted"]),
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=409,
                detail="A pending or accepted connection already exists between these coaches",
            )

        connection = CoachConnection(
            requester_id=coach.id,
            recipient_id=request.recipient_id,
            status="pending",
        )
        db.add(connection)
        await db.flush()
        await db.commit()
        await db.refresh(connection)

        connection_data = {
            "id": str(connection.id),
            "requester_id": str(connection.requester_id),
            "recipient_id": str(connection.recipient_id),
            "status": connection.status,
            "created_at": connection.created_at.isoformat() if connection.created_at else None,
            "updated_at": connection.updated_at.isoformat() if connection.updated_at else None,
        }

        return {"message": "Connection request sent", "success": True, "connection": connection_data}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending connection request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/respond")
async def respond_to_connection(
    response: ConnectionResponse,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Accept or decline a connection request"""
    try:
        logger.info(f"User {user_id} responding to connection {response.connection_id} | accept={response.accept}")
        coach = await _get_coach(db, user_id)

        # Fetch the connection — recipient must be the current coach
        result = await db.execute(
            select(CoachConnection).where(
                and_(
                    CoachConnection.id == response.connection_id,
                    CoachConnection.recipient_id == coach.id,
                )
            )
        )
        connection = result.scalar_one_or_none()

        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found or unauthorized")

        status = "accepted" if response.accept else "declined"
        connection.status = status
        await db.commit()
        await db.refresh(connection)

        connection_data = {
            "id": str(connection.id),
            "requester_id": str(connection.requester_id),
            "recipient_id": str(connection.recipient_id),
            "status": connection.status,
            "created_at": connection.created_at.isoformat() if connection.created_at else None,
            "updated_at": connection.updated_at.isoformat() if connection.updated_at else None,
        }

        return {"message": "Response recorded", "success": True, "connection": connection_data}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error responding to connection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{connection_id}")
async def remove_connection(
    connection_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove a connection"""
    try:
        logger.info(f"User {user_id} removing connection {connection_id}")
        coach = await _get_coach(db, user_id)

        # First check the connection exists and user is authorized (either side)
        result = await db.execute(
            select(CoachConnection).where(
                and_(
                    CoachConnection.id == connection_id,
                    or_(
                        CoachConnection.requester_id == coach.id,
                        CoachConnection.recipient_id == coach.id,
                    ),
                )
            )
        )
        connection = result.scalar_one_or_none()

        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found or unauthorized")

        await db.delete(connection)
        await db.commit()

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
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Search for coaches by email or name.

    Bug #27 fix: search User.email (not Profile.email) and Coach.first_name/last_name
    (not Profile.first_name/last_name which don't exist on the Profile model).
    """
    try:
        logger.info(f"User {user_id} searching coaches | email={email} | name={name}")

        # Build a joined query across Coach + User so we can search both tables
        query = (
            select(Coach, User)
            .join(User, User.id == Coach.user_id)
            .where(User.id != user_id)
        )

        if email:
            query = query.where(User.email.ilike(f"%{email}%"))
        if name:
            query = query.where(
                or_(
                    Coach.first_name.ilike(f"%{name}%"),
                    Coach.last_name.ilike(f"%{name}%"),
                )
            )

        result = await db.execute(query)
        rows = result.all()

        coaches = []
        for coach, user in rows:
            coaches.append({
                "id": str(coach.id),
                "user_id": str(coach.user_id),
                "first_name": coach.first_name,
                "last_name": coach.last_name,
                "email": user.email,
                "created_at": coach.created_at.isoformat() if coach.created_at else None,
            })

        return {"coaches": coaches}

    except Exception as e:
        logger.error(f"Error searching coaches: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
