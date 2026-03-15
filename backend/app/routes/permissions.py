"""Permissions API routes — replaces frontend direct Supabase calls for coach_squads/invitations."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import get_db
from app.infrastructure.models import (
    CoachSquad, Coach, SquadInvitation, Squad, User,
)
from app.middleware.auth import get_current_user_id
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError

router = APIRouter(prefix="/permissions", tags=["permissions"])


class InviteCoachRequest(BaseModel):
    squad_id: str
    email: str
    role: str = "assistant"
    can_manage_swimmers: bool = False


class UpdatePermissionRequest(BaseModel):
    role: Optional[str] = None
    can_manage_swimmers: Optional[bool] = None


def _row_to_dict(row) -> dict:
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if hasattr(val, 'hex'):
            val = str(val)
        d[col.name] = val
    return d


@router.get("/squad/{squad_id}/coaches")
async def get_squad_coaches(
    squad_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all coaches for a squad with their permissions."""
    await get_coach_membership(db, user_id, squad_id)

    result = await db.execute(
        select(CoachSquad, Coach)
        .join(Coach, Coach.id == CoachSquad.coach_id)
        .where(CoachSquad.squad_id == squad_id)
    )
    rows = result.all()

    output = []
    for cs, coach in rows:
        d = _row_to_dict(cs)
        d["coach"] = _row_to_dict(coach)
        output.append(d)

    return output


@router.get("/coach/{coach_id}")
async def get_coach_permissions(
    coach_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all squad permissions for a coach."""
    result = await db.execute(
        select(CoachSquad, Squad)
        .join(Squad, Squad.id == CoachSquad.squad_id)
        .where(CoachSquad.coach_id == coach_id)
    )
    rows = result.all()

    output = []
    for cs, squad in rows:
        d = _row_to_dict(cs)
        d["squad"] = _row_to_dict(squad)
        output.append(d)

    return output


@router.put("/squad-coach/{membership_id}")
async def update_permission(
    membership_id: str,
    body: UpdatePermissionRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a coach's permissions on a squad."""
    result = await db.execute(
        select(CoachSquad).where(CoachSquad.id == membership_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Membership not found")

    # Verify the current user has can_manage_squad_settings on this squad
    membership = await get_coach_membership(db, user_id, str(instance.squad_id))
    if not membership.can_manage_squad_settings:
        raise UnauthorizedError("Missing permission: can_manage_squad_settings")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(instance, field, value)

    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


@router.delete("/squad-coach/{membership_id}")
async def remove_coach_from_squad(
    membership_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove a coach from a squad."""
    result = await db.execute(
        select(CoachSquad).where(CoachSquad.id == membership_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Membership not found")

    # Verify the current user has can_manage_squad_settings on this squad
    membership = await get_coach_membership(db, user_id, str(instance.squad_id))
    if not membership.can_manage_squad_settings:
        raise UnauthorizedError("Missing permission: can_manage_squad_settings")

    await db.execute(
        delete(CoachSquad).where(CoachSquad.id == membership_id)
    )
    await db.commit()
    return {"message": "Removed"}


# ── Squad Invitations ──────────────────────────────────────

@router.get("/invitations/pending")
async def get_pending_invitations(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get pending invitations for the current user's email."""
    # Get user's coach record to find their email
    result = await db.execute(
        select(Coach).where(Coach.user_id == user_id)
    )
    coach = result.scalar_one_or_none()
    if not coach:
        return []

    # Get the user's email from the users table
    user_result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        return []

    invitations = await db.execute(
        select(SquadInvitation, Squad)
        .join(Squad, Squad.id == SquadInvitation.squad_id)
        .where(SquadInvitation.invited_email == user.email)
        .where(SquadInvitation.status == "pending")
    )

    output = []
    for inv, squad in invitations.all():
        d = _row_to_dict(inv)
        d["squad"] = _row_to_dict(squad)
        output.append(d)

    return output


@router.post("/invitations")
async def invite_coach(
    body: InviteCoachRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Invite a coach to a squad."""
    membership = await get_coach_membership(db, user_id, body.squad_id)
    if not membership.can_manage_squad_settings:
        raise UnauthorizedError("Missing permission: can_manage_squad_settings")

    invitation = SquadInvitation(
        squad_id=body.squad_id,
        invited_email=body.email.lower().strip(),
        invited_by=user_id,
        status="pending",
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    return _row_to_dict(invitation)


@router.put("/invitations/{invitation_id}/accept")
async def accept_invitation(
    invitation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Accept a squad invitation."""
    result = await db.execute(
        select(SquadInvitation).where(SquadInvitation.id == invitation_id)
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    # Verify this invitation was sent to the current user's email (Bug #28 pattern)
    user_result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = user_result.scalar_one_or_none()
    if not user or user.email.lower() != invitation.invited_email.lower():
        raise UnauthorizedError("This invitation was not sent to your email address")

    # Get coach record
    coach_result = await db.execute(
        select(Coach).where(Coach.user_id == user_id)
    )
    coach = coach_result.scalar_one_or_none()
    if not coach:
        raise HTTPException(status_code=400, detail="Coach profile not found")

    # Determine role and default permissions from the invitation
    # Bug #25 fix: read role from invitation instead of hardcoding "assistant"
    inv_role = getattr(invitation, "role", None) or "assistant"

    # Default permissions based on role
    if inv_role == "owner":
        perms = dict(
            can_manage_swimmers=True, can_manage_workouts=True,
            can_manage_results=True, can_manage_attendance=True,
            can_manage_schedules=True, can_manage_notes=True,
            can_view_analytics=True, can_manage_squad_settings=True,
        )
    elif inv_role == "admin":
        perms = dict(
            can_manage_swimmers=True, can_manage_workouts=True,
            can_manage_results=True, can_manage_attendance=True,
            can_manage_schedules=True, can_manage_notes=True,
            can_view_analytics=True, can_manage_squad_settings=False,
        )
    else:
        # assistant / member / unknown — minimal permissions
        perms = dict(
            can_manage_swimmers=False, can_manage_workouts=False,
            can_manage_results=False, can_manage_attendance=False,
            can_manage_schedules=False, can_manage_notes=False,
            can_view_analytics=False, can_manage_squad_settings=False,
        )

    # Create the squad membership
    membership = CoachSquad(
        coach_id=coach.id,
        squad_id=invitation.squad_id,
        role=inv_role,
        **perms,
    )
    db.add(membership)

    # Update invitation status
    invitation.status = "accepted"

    await db.commit()
    return {"message": "Invitation accepted"}


@router.put("/invitations/{invitation_id}/decline")
async def decline_invitation(
    invitation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Decline a squad invitation."""
    result = await db.execute(
        select(SquadInvitation).where(SquadInvitation.id == invitation_id)
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    # Bug #28 fix: verify the declining user's email matches the invitation's invited_email
    user_result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = user_result.scalar_one_or_none()
    if not user or user.email.lower() != invitation.invited_email.lower():
        raise UnauthorizedError("This invitation was not sent to your email address")

    invitation.status = "declined"
    await db.commit()
    return {"message": "Invitation declined"}
