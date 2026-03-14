"""SQLAlchemy ORM models for all database tables."""
import uuid
from datetime import datetime, date, time
from typing import Optional, List
from sqlalchemy import (
    String, Integer, Float, Boolean, Text, DateTime, Date, Time,
    ForeignKey, UniqueConstraint, Index, Interval, Numeric, JSON,
    func, text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, INTERVAL
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db import Base


def new_uuid():
    return uuid.uuid4()


# ──────────────────────────────────────────────
# Auth / Users
# ──────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    email_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    coach: Mapped[Optional["Coach"]] = relationship(back_populates="user", uselist=False)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship()


# ──────────────────────────────────────────────
# Coach
# ──────────────────────────────────────────────

class Coach(Base):
    __tablename__ = "coach"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(50), default="coach")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="coach")
    squad_memberships: Mapped[List["CoachSquad"]] = relationship(back_populates="coach")
    workout_templates: Mapped[List["WorkoutTemplate"]] = relationship(back_populates="coach", foreign_keys="[WorkoutTemplate.create_by_coach]")
    workout_tags: Mapped[List["WorkoutTag"]] = relationship(back_populates="coach")


# ──────────────────────────────────────────────
# Squads
# ──────────────────────────────────────────────

class Squad(Base):
    __tablename__ = "squads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[Optional[str]] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)
    coach_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("coach.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    swimmers: Mapped[List["Swimmer"]] = relationship(back_populates="squad")
    coach_memberships: Mapped[List["CoachSquad"]] = relationship(back_populates="squad")
    training_schedules: Mapped[List["TrainingSchedule"]] = relationship(back_populates="squad")
    training_sessions: Mapped[List["TrainingSession"]] = relationship(back_populates="squad")
    calendar_events: Mapped[List["CalendarEvent"]] = relationship(back_populates="squad")


class CoachSquad(Base):
    __tablename__ = "coach_squads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    coach_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("coach.id", ondelete="CASCADE"), nullable=False)
    squad_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("squads.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="owner")
    can_manage_swimmers: Mapped[bool] = mapped_column(Boolean, default=True)
    can_manage_workouts: Mapped[bool] = mapped_column(Boolean, default=False)
    can_manage_results: Mapped[bool] = mapped_column(Boolean, default=False)
    can_manage_attendance: Mapped[bool] = mapped_column(Boolean, default=False)
    can_manage_schedules: Mapped[bool] = mapped_column(Boolean, default=False)
    can_manage_notes: Mapped[bool] = mapped_column(Boolean, default=False)
    can_view_analytics: Mapped[bool] = mapped_column(Boolean, default=False)
    can_manage_squad_settings: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    coach: Mapped["Coach"] = relationship(back_populates="squad_memberships")
    squad: Mapped["Squad"] = relationship(back_populates="coach_memberships")


# ──────────────────────────────────────────────
# Swimmers
# ──────────────────────────────────────────────

class Swimmer(Base):
    __tablename__ = "swimmers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    squad_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("squads.id", ondelete="SET NULL"))
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    sex: Mapped[Optional[str]] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    squad: Mapped[Optional["Squad"]] = relationship(back_populates="swimmers")
    external_links: Mapped[List["SwimmerExternalLink"]] = relationship(back_populates="swimmer")
    workout_results: Mapped[List["WorkoutResult"]] = relationship(back_populates="swimmer")
    attendance_records: Mapped[List["TrainingAttendance"]] = relationship(back_populates="swimmer")
    standards_tracking: Mapped[List["SwimmerStandardsTracking"]] = relationship(back_populates="swimmer")


class SwimmerExternalLink(Base):
    __tablename__ = "swimmer_external_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    swimmer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("swimmers.id", ondelete="CASCADE"), nullable=False)
    external_athlete_id: Mapped[Optional[str]] = mapped_column(String(100))
    external_source: Mapped[Optional[str]] = mapped_column(String(50))
    external_url: Mapped[Optional[str]] = mapped_column(Text)
    external_name: Mapped[Optional[str]] = mapped_column(String(200))
    birth_year: Mapped[Optional[int]] = mapped_column(Integer)
    nation_code: Mapped[Optional[str]] = mapped_column(String(10))
    club_name: Mapped[Optional[str]] = mapped_column(String(200))
    gender: Mapped[Optional[str]] = mapped_column(String(10))
    verified: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    auto_import_enabled: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    sync_status: Mapped[Optional[str]] = mapped_column(String(20), default="pending")
    sync_progress: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    sync_total_events: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    sync_error_message: Mapped[Optional[str]] = mapped_column(Text)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_sync_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_sync_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_result_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    results_count: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    events_checked: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    swimmer: Mapped["Swimmer"] = relationship(back_populates="external_links")


# ──────────────────────────────────────────────
# Workout Results & Race Splits
# ──────────────────────────────────────────────

class WorkoutResult(Base):
    __tablename__ = "workout_result"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    swimmer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("swimmers.id", ondelete="CASCADE"), nullable=False)
    time_result: Mapped[Optional[str]] = mapped_column(String(50))
    stroke: Mapped[Optional[str]] = mapped_column(String(50))
    distance: Mapped[Optional[int]] = mapped_column(Integer)
    activity: Mapped[Optional[str]] = mapped_column(String(50))
    equipment: Mapped[Optional[str]] = mapped_column(String(100))
    meet_name: Mapped[Optional[str]] = mapped_column(String(300))
    meet_city: Mapped[Optional[str]] = mapped_column(String(200))
    meet_nation: Mapped[Optional[str]] = mapped_column(String(100))
    meet_points: Mapped[Optional[int]] = mapped_column(Integer)
    result_units: Mapped[Optional[str]] = mapped_column(String(10))
    performed_on: Mapped[Optional[date]] = mapped_column(Date)
    source: Mapped[Optional[str]] = mapped_column(String(50), default="manual")
    reaction_time: Mapped[Optional[float]] = mapped_column(Numeric(6, 3))
    swimrankings_result_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    has_splits_available: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    swimmer: Mapped["Swimmer"] = relationship(back_populates="workout_results")
    race_splits: Mapped[List["RaceSplit"]] = relationship(back_populates="workout_result", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_workout_result_swimmer_stroke_distance", "swimmer_id", "stroke", "distance"),
        Index("idx_workout_result_performed_on", "performed_on"),
        Index("idx_workout_result_source", "source"),
        Index("idx_workout_result_meet", "meet_name"),
    )


class RaceSplit(Base):
    __tablename__ = "race_splits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workout_result_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workout_result.id", ondelete="CASCADE"), nullable=False)
    split_distance: Mapped[int] = mapped_column(Integer, nullable=False)
    split_time: Mapped[Optional[str]] = mapped_column(String(50))
    cumulative_time: Mapped[Optional[str]] = mapped_column(String(50))
    reaction_time: Mapped[Optional[float]] = mapped_column(Numeric(6, 3))
    split_order: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    workout_result: Mapped["WorkoutResult"] = relationship(back_populates="race_splits")

    __table_args__ = (
        Index("idx_race_splits_workout_result", "workout_result_id"),
        Index("idx_race_splits_distance", "split_distance"),
    )


# ──────────────────────────────────────────────
# Training Schedules & Sessions
# ──────────────────────────────────────────────

class TrainingSchedule(Base):
    __tablename__ = "training_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    squad_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("squads.id", ondelete="CASCADE"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[Optional[time]] = mapped_column(Time)
    end_time: Mapped[Optional[time]] = mapped_column(Time)
    training_type: Mapped[Optional[str]] = mapped_column(String(50))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    squad: Mapped["Squad"] = relationship(back_populates="training_schedules")


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    squad_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("squads.id", ondelete="CASCADE"), nullable=False)
    workout_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("workout_template.id", ondelete="SET NULL"))
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    training_type: Mapped[Optional[str]] = mapped_column(String(50))
    is_virtual: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    squad: Mapped["Squad"] = relationship(back_populates="training_sessions")
    workout_template: Mapped[Optional["WorkoutTemplate"]] = relationship()
    attendance_records: Mapped[List["TrainingAttendance"]] = relationship(back_populates="training_session")
    pre_practice_notes: Mapped[List["TrainingSessionPrePracticeNote"]] = relationship(back_populates="training_session")
    post_practice_notes: Mapped[List["TrainingSessionPostPracticeNote"]] = relationship(back_populates="training_session")
    feedback: Mapped[List["WorkoutSessionFeedback"]] = relationship(back_populates="training_session")


class TrainingAttendance(Base):
    __tablename__ = "training_attendance"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    training_session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False)
    swimmer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("swimmers.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[Optional[str]] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    training_session: Mapped["TrainingSession"] = relationship(back_populates="attendance_records")
    swimmer: Mapped["Swimmer"] = relationship(back_populates="attendance_records")


class TrainingSessionPrePracticeNote(Base):
    __tablename__ = "training_session_pre_practice_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    training_session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False)
    coach_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("coach.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    training_session: Mapped["TrainingSession"] = relationship(back_populates="pre_practice_notes")


class TrainingSessionPostPracticeNote(Base):
    __tablename__ = "training_session_post_practice_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    training_session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False)
    coach_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("coach.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    training_session: Mapped["TrainingSession"] = relationship(back_populates="post_practice_notes")


# ──────────────────────────────────────────────
# Workout Templates, Tags, Feedback
# ──────────────────────────────────────────────

class WorkoutTemplate(Base):
    __tablename__ = "workout_template"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text)
    raw_description: Mapped[Optional[str]] = mapped_column(Text)
    total_meters: Mapped[Optional[int]] = mapped_column(Integer)
    estimated_time_minutes: Mapped[Optional[float]] = mapped_column(Float)
    estimated_calories: Mapped[Optional[int]] = mapped_column(Integer)
    effort_level: Mapped[Optional[int]] = mapped_column(Integer)
    json_description: Mapped[Optional[dict]] = mapped_column(JSONB)
    create_by_coach: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("coach.id"))
    visibility: Mapped[str] = mapped_column(String(20), default="private")
    effectiveness_rating: Mapped[Optional[float]] = mapped_column(Float)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    times_used: Mapped[int] = mapped_column(Integer, default=0)
    usage_count: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    clone_count: Mapped[int] = mapped_column(Integer, default=0)
    cloned_from_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("workout_template.id", ondelete="SET NULL"))
    original_creator_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("coach.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    coach: Mapped[Optional["Coach"]] = relationship(back_populates="workout_templates", foreign_keys=[create_by_coach])
    tag_associations: Mapped[List["WorkoutTemplateTag"]] = relationship(back_populates="workout_template", cascade="all, delete-orphan")


class WorkoutTag(Base):
    __tablename__ = "workout_tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    coach_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("coach.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    coach: Mapped["Coach"] = relationship(back_populates="workout_tags")
    template_associations: Mapped[List["WorkoutTemplateTag"]] = relationship(back_populates="tag")


class WorkoutTemplateTag(Base):
    __tablename__ = "workout_template_tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workout_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workout_template.id", ondelete="CASCADE"), nullable=False)
    tag_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workout_tags.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    workout_template: Mapped["WorkoutTemplate"] = relationship(back_populates="tag_associations")
    tag: Mapped["WorkoutTag"] = relationship(back_populates="template_associations")


class WorkoutSessionFeedback(Base):
    __tablename__ = "workout_session_feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    training_session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False)
    workout_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("workout_template.id", ondelete="SET NULL"))
    coach_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("coach.id"))
    rating: Mapped[Optional[int]] = mapped_column(Integer)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    training_session: Mapped["TrainingSession"] = relationship(back_populates="feedback")


# ──────────────────────────────────────────────
# Calendar Events
# ──────────────────────────────────────────────

class CalendarEvent(Base):
    __tablename__ = "calendar_event"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    squad_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("squads.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(300))
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    event_type: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    squad: Mapped["Squad"] = relationship(back_populates="calendar_events")


# ──────────────────────────────────────────────
# Coach Connections
# ──────────────────────────────────────────────

class CoachConnection(Base):
    __tablename__ = "coach_connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    requester_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("coach.id", ondelete="CASCADE"), nullable=False)
    recipient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("coach.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ──────────────────────────────────────────────
# Squad Invitations
# ──────────────────────────────────────────────

class SquadInvitation(Base):
    __tablename__ = "squad_invitations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    squad_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("squads.id", ondelete="CASCADE"), nullable=False)
    invited_email: Mapped[str] = mapped_column(String(320), nullable=False)
    invited_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("coach.id"))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ──────────────────────────────────────────────
# Time Standards
# ──────────────────────────────────────────────

class TimeStandardsSet(Base):
    __tablename__ = "time_standards_sets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    organization: Mapped[Optional[str]] = mapped_column(String(200))
    year: Mapped[Optional[int]] = mapped_column(Integer)
    description: Mapped[Optional[str]] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("coach.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    standards: Mapped[List["TimeStandard"]] = relationship(back_populates="standards_set", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization", "year", "created_by", name="uq_time_standards_sets_org_year_coach"),
        Index("idx_time_standards_sets_organization", "organization"),
        Index("idx_time_standards_sets_active", "active"),
        Index("idx_time_standards_sets_created_by", "created_by"),
    )


class TimeStandard(Base):
    __tablename__ = "time_standards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    set_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("time_standards_sets.id", ondelete="CASCADE"), nullable=False)
    distance: Mapped[int] = mapped_column(Integer, nullable=False)
    stroke: Mapped[str] = mapped_column(String(20), nullable=False)
    activity: Mapped[str] = mapped_column(String(20), default="swim")
    equipment: Mapped[str] = mapped_column(String(20), default="none")
    age_group_min: Mapped[Optional[int]] = mapped_column(Integer)
    age_group_max: Mapped[Optional[int]] = mapped_column(Integer)
    gender: Mapped[Optional[str]] = mapped_column(String(5))
    scm_time: Mapped[Optional[str]] = mapped_column(String(50))
    lcm_time: Mapped[Optional[str]] = mapped_column(String(50))
    standard_level: Mapped[Optional[str]] = mapped_column(String(10))
    points: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    standards_set: Mapped["TimeStandardsSet"] = relationship(back_populates="standards")

    __table_args__ = (
        Index("idx_time_standards_event_lookup", "set_id", "distance", "stroke", "activity", "equipment"),
        Index("idx_time_standards_age_group", "age_group_min", "age_group_max"),
        Index("idx_time_standards_gender", "gender"),
        Index("idx_time_standards_level", "standard_level"),
    )


class SwimmerStandardsTracking(Base):
    __tablename__ = "swimmer_standards_tracking"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    swimmer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("swimmers.id", ondelete="CASCADE"), nullable=False)
    standard_set_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("time_standards_sets.id", ondelete="CASCADE"), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("coach.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    swimmer: Mapped["Swimmer"] = relationship(back_populates="standards_tracking")

    __table_args__ = (
        UniqueConstraint("swimmer_id", "standard_set_id", name="uq_swimmer_standards_tracking"),
        Index("idx_swimmer_standards_swimmer_id", "swimmer_id"),
        Index("idx_swimmer_standards_active", "active"),
    )


# ──────────────────────────────────────────────
# Beta Waitlist
# ──────────────────────────────────────────────

class BetaWaitlist(Base):
    __tablename__ = "beta_waitlist"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(200))
    team_size: Mapped[Optional[str]] = mapped_column(String(50))
    current_tools: Mapped[Optional[str]] = mapped_column(Text)
    pain_points: Mapped[Optional[str]] = mapped_column(Text)
    budget_range: Mapped[Optional[str]] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_beta_waitlist_email", "email"),
        Index("idx_beta_waitlist_status", "status"),
        Index("idx_beta_waitlist_created_at", "created_at"),
    )


# ──────────────────────────────────────────────
# Admin Bulk Sync
# ──────────────────────────────────────────────

class BulkSyncJob(Base):
    __tablename__ = "bulk_sync_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    triggered_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    total_swimmers: Mapped[int] = mapped_column(Integer, default=0)
    swimmers_processed: Mapped[int] = mapped_column(Integer, default=0)
    swimmers_succeeded: Mapped[int] = mapped_column(Integer, default=0)
    swimmers_failed: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    failures: Mapped[List["BulkSyncFailure"]] = relationship(back_populates="job", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_bulk_sync_jobs_status", "status"),
        Index("idx_bulk_sync_jobs_triggered_by", "triggered_by"),
    )


class BulkSyncFailure(Base):
    __tablename__ = "bulk_sync_failures"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    bulk_sync_job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bulk_sync_jobs.id", ondelete="CASCADE"), nullable=False)
    swimmer_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("swimmers.id"))
    external_link_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("swimmer_external_links.id"))
    swimmer_name: Mapped[Optional[str]] = mapped_column(String(200))
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    failed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job: Mapped["BulkSyncJob"] = relationship(back_populates="failures")

    __table_args__ = (
        Index("idx_bulk_sync_failures_job", "bulk_sync_job_id"),
    )


# ──────────────────────────────────────────────
# Profiles (minimal — may be deprecated)
# ──────────────────────────────────────────────

class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
