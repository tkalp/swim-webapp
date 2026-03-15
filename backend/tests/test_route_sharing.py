"""Integration tests for workout visibility updates and clone/discover flows."""
import pytest
import uuid
from sqlalchemy import select, text

from app.infrastructure.models import (
    WorkoutTemplate,
    WorkoutTag,
    WorkoutTemplateTag,
)
from tests.conftest import set_user_context
from tests.seed import (
    USER_A_ID, USER_B_ID,
    COACH_A_ID, COACH_B_ID,
)


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_visibility(seeded_db):
    """Owner can change workout visibility from private to public."""
    await seeded_db.execute(text("RESET ROLE"))

    workout = WorkoutTemplate(
        name="Visibility Test Workout",
        create_by_coach=COACH_A_ID,
        visibility="private",
    )
    seeded_db.add(workout)
    await seeded_db.flush()
    workout_id = workout.id

    # Update as owner (Coach A / User A context with RLS)
    await set_user_context(seeded_db, str(USER_A_ID))

    update_result = await seeded_db.execute(
        select(WorkoutTemplate).where(WorkoutTemplate.id == workout_id)
    )
    fetched = update_result.scalar_one()
    fetched.visibility = "public"
    await seeded_db.flush()

    # Verify persisted
    await seeded_db.execute(text("RESET ROLE"))
    check_result = await seeded_db.execute(
        select(WorkoutTemplate).where(WorkoutTemplate.id == workout_id)
    )
    final = check_result.scalar_one()
    assert final.visibility == "public"


@pytest.mark.asyncio
async def test_discover_returns_public_workouts(seeded_db):
    """Query for public workouts by another coach returns correct results."""
    await seeded_db.execute(text("RESET ROLE"))

    # Coach A has a public workout and a private workout
    public_w = WorkoutTemplate(
        name="Coach A Public",
        create_by_coach=COACH_A_ID,
        visibility="public",
        effectiveness_rating=4.5,
        rating_count=10,
        clone_count=5,
        times_used=20,
    )
    private_w = WorkoutTemplate(
        name="Coach A Private",
        create_by_coach=COACH_A_ID,
        visibility="private",
    )
    seeded_db.add_all([public_w, private_w])
    await seeded_db.flush()
    public_id, private_id = public_w.id, private_w.id

    # Discover query as Coach B: public workouts NOT created by Coach B
    from sqlalchemy import and_
    result = await seeded_db.execute(
        select(WorkoutTemplate).where(
            and_(
                WorkoutTemplate.visibility == "public",
                WorkoutTemplate.create_by_coach != COACH_B_ID,
            )
        )
    )
    found = result.scalars().all()
    found_ids = {str(w.id) for w in found}

    # Public workout from Coach A should appear
    assert str(public_id) in found_ids
    # Private workout must NOT appear
    assert str(private_id) not in found_ids


@pytest.mark.asyncio
async def test_clone_creates_private_copy(seeded_db):
    """Cloning a public workout creates a new private workout for the cloner with tags copied."""
    await seeded_db.execute(text("RESET ROLE"))

    # Coach A creates a public workout with a tag
    original = WorkoutTemplate(
        name="Public Workout To Clone",
        create_by_coach=COACH_A_ID,
        visibility="public",
        effectiveness_rating=3.8,
        rating_count=5,
        clone_count=2,
        times_used=10,
    )
    seeded_db.add(original)

    tag = WorkoutTag(coach_id=COACH_A_ID, name="Aerobic", color="#aabbcc")
    seeded_db.add(tag)
    await seeded_db.flush()

    orig_assoc = WorkoutTemplateTag(workout_id=original.id, tag_id=tag.id)
    seeded_db.add(orig_assoc)
    await seeded_db.flush()

    original_id = original.id
    original_clone_count = original.clone_count

    # Coach B clones the workout (mirrors the clone_workout endpoint logic)
    cloned = WorkoutTemplate(
        name="Public Workout To Clone (Copy)",
        description=original.description,
        raw_description=original.raw_description,
        total_meters=original.total_meters,
        estimated_time_minutes=original.estimated_time_minutes,
        estimated_calories=original.estimated_calories,
        effort_level=original.effort_level,
        json_description=original.json_description,
        create_by_coach=COACH_B_ID,
        visibility="private",
        cloned_from_id=original_id,
        original_creator_id=COACH_A_ID,
        effectiveness_rating=None,
        rating_count=0,
        times_used=0,
        clone_count=0,
    )
    seeded_db.add(cloned)
    await seeded_db.flush()

    # Copy tag associations
    tags_result = await seeded_db.execute(
        select(WorkoutTemplateTag).where(WorkoutTemplateTag.workout_id == original_id)
    )
    for tag_assoc in tags_result.scalars().all():
        seeded_db.add(WorkoutTemplateTag(workout_id=cloned.id, tag_id=tag_assoc.tag_id))

    # Increment original clone count
    original.clone_count = original_clone_count + 1
    await seeded_db.flush()

    # Assertions on the cloned workout
    assert str(cloned.create_by_coach) == str(COACH_B_ID)
    assert cloned.visibility == "private"
    assert str(cloned.cloned_from_id) == str(original_id)
    assert cloned.rating_count == 0
    assert cloned.clone_count == 0

    # Verify tags were copied
    cloned_tags_result = await seeded_db.execute(
        select(WorkoutTemplateTag).where(WorkoutTemplateTag.workout_id == cloned.id)
    )
    cloned_tags = cloned_tags_result.scalars().all()
    assert len(cloned_tags) == 1
    assert str(cloned_tags[0].tag_id) == str(tag.id)

    # Verify original clone count incremented
    orig_result = await seeded_db.execute(
        select(WorkoutTemplate).where(WorkoutTemplate.id == original_id)
    )
    orig_saved = orig_result.scalar_one()
    assert orig_saved.clone_count == original_clone_count + 1
