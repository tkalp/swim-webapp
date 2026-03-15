"""Integration tests for pre- and post-practice notes CRUD."""
import pytest
from sqlalchemy import select, text
from app.infrastructure.models import (
    TrainingSessionPrePracticeNote,
    TrainingSessionPostPracticeNote,
)
from tests.seed import COACH_A_ID, COACH_B_ID, SESSION_1_ID, SESSION_2_ID


@pytest.mark.asyncio
async def test_create_pre_practice_note_with_structured_fields(seeded_db):
    """Pre-practice note persists all structured fields correctly."""
    await seeded_db.execute(text("RESET ROLE"))

    note = TrainingSessionPrePracticeNote(
        training_session_id=SESSION_1_ID,
        coach_id=COACH_A_ID,
        notes="General notes",
        announcements="Team meeting at 5pm",
        reminders="Bring goggles",
        focus="Flip turns",
        equipment_needed="Pull buoys",
    )
    seeded_db.add(note)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(TrainingSessionPrePracticeNote).where(
            TrainingSessionPrePracticeNote.training_session_id == SESSION_1_ID
        )
    )
    saved = result.scalar_one()
    assert saved.notes == "General notes"
    assert saved.announcements == "Team meeting at 5pm"
    assert saved.reminders == "Bring goggles"
    assert saved.focus == "Flip turns"
    assert saved.equipment_needed == "Pull buoys"
    assert saved.coach_id == COACH_A_ID


@pytest.mark.asyncio
async def test_create_post_practice_note_with_ratings(seeded_db):
    """Post-practice note persists rating fields and text feedback correctly."""
    await seeded_db.execute(text("RESET ROLE"))

    note = TrainingSessionPostPracticeNote(
        training_session_id=SESSION_1_ID,
        coach_id=COACH_A_ID,
        notes="Great session",
        overall_rating=4,
        effort_level=5,
        technique_quality=3,
        positivity=4,
        what_went_well="Fast turns",
        areas_for_improvement="Breathing technique",
        next_session_focus="Underwater kicks",
        individual_highlights="Alice hit a PB",
    )
    seeded_db.add(note)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(TrainingSessionPostPracticeNote).where(
            TrainingSessionPostPracticeNote.training_session_id == SESSION_1_ID
        )
    )
    saved = result.scalar_one()
    assert saved.overall_rating == 4
    assert saved.effort_level == 5
    assert saved.technique_quality == 3
    assert saved.positivity == 4
    assert saved.what_went_well == "Fast turns"
    assert saved.areas_for_improvement == "Breathing technique"
    assert saved.next_session_focus == "Underwater kicks"
    assert saved.individual_highlights == "Alice hit a PB"


@pytest.mark.asyncio
async def test_pre_practice_note_optional_fields_nullable(seeded_db):
    """Pre-practice note can be created with only required fields; optional fields are null."""
    await seeded_db.execute(text("RESET ROLE"))

    note = TrainingSessionPrePracticeNote(
        training_session_id=SESSION_2_ID,
        coach_id=COACH_B_ID,
        notes="Brief note only",
    )
    seeded_db.add(note)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(TrainingSessionPrePracticeNote).where(
            TrainingSessionPrePracticeNote.training_session_id == SESSION_2_ID
        )
    )
    saved = result.scalar_one()
    assert saved.notes == "Brief note only"
    assert saved.announcements is None
    assert saved.focus is None
    assert saved.equipment_needed is None


@pytest.mark.asyncio
async def test_post_practice_note_optional_ratings_nullable(seeded_db):
    """Post-practice note can be created without rating fields."""
    await seeded_db.execute(text("RESET ROLE"))

    note = TrainingSessionPostPracticeNote(
        training_session_id=SESSION_2_ID,
        coach_id=COACH_B_ID,
        notes="Short debrief",
    )
    seeded_db.add(note)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(TrainingSessionPostPracticeNote).where(
            TrainingSessionPostPracticeNote.training_session_id == SESSION_2_ID
        )
    )
    saved = result.scalar_one()
    assert saved.notes == "Short debrief"
    assert saved.overall_rating is None
    assert saved.effort_level is None
    assert saved.what_went_well is None


@pytest.mark.asyncio
async def test_multiple_coaches_can_add_notes_to_same_session(seeded_db):
    """Different coaches can each submit a pre-practice note for the same session."""
    await seeded_db.execute(text("RESET ROLE"))

    note_a = TrainingSessionPrePracticeNote(
        training_session_id=SESSION_1_ID,
        coach_id=COACH_A_ID,
        notes="Coach A's plan",
        focus="Endurance",
    )
    note_b = TrainingSessionPrePracticeNote(
        training_session_id=SESSION_1_ID,
        coach_id=COACH_B_ID,
        notes="Coach B's plan",
        focus="Speed",
    )
    seeded_db.add_all([note_a, note_b])
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(TrainingSessionPrePracticeNote).where(
            TrainingSessionPrePracticeNote.training_session_id == SESSION_1_ID
        )
    )
    notes = result.scalars().all()
    assert len(notes) == 2
    focuses = {n.focus for n in notes}
    assert "Endurance" in focuses
    assert "Speed" in focuses
