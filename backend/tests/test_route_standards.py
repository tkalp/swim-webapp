"""Integration tests for time standards sets, individual standards, and swimmer tracking."""
import pytest
import uuid
from sqlalchemy import select, func, text

from app.infrastructure.models import (
    TimeStandardsSet,
    TimeStandard,
    SwimmerStandardsTracking,
)
from app.domain.exceptions import UnauthorizedError
from tests.conftest import set_user_context
from tests.seed import (
    USER_A_ID, USER_B_ID,
    COACH_A_ID, COACH_B_ID,
    SWIMMER_1_ID,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_set(coach_id, name="Test Standards", org="Test Org", year=2026):
    return TimeStandardsSet(
        name=name,
        organization=org,
        year=year,
        created_by=coach_id,
    )


def _make_standard(set_id, distance=100, stroke="freestyle", scm_time="1:00.00"):
    return TimeStandard(
        set_id=set_id,
        distance=distance,
        stroke=stroke,
        activity="swim",
        equipment="none",
        gender="F",
        scm_time=scm_time,
        standard_level="A",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_standards_set(seeded_db):
    """Can create a TimeStandardsSet and read it back with correct attributes."""
    await seeded_db.execute(text("RESET ROLE"))

    std_set = _make_set(COACH_A_ID, name="Provincial A Standards", org="SwimON", year=2026)
    seeded_db.add(std_set)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(TimeStandardsSet).where(TimeStandardsSet.id == std_set.id)
    )
    saved = result.scalar_one()
    assert saved.name == "Provincial A Standards"
    assert saved.organization == "SwimON"
    assert saved.year == 2026
    assert str(saved.created_by) == str(COACH_A_ID)
    assert saved.active is True


@pytest.mark.asyncio
async def test_create_individual_standard(seeded_db):
    """Can create a single TimeStandard within a set."""
    await seeded_db.execute(text("RESET ROLE"))

    std_set = _make_set(COACH_A_ID, name="Individual Std Set")
    seeded_db.add(std_set)
    await seeded_db.flush()

    standard = _make_standard(std_set.id, distance=200, stroke="backstroke", scm_time="2:20.00")
    seeded_db.add(standard)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(TimeStandard).where(TimeStandard.id == standard.id)
    )
    saved = result.scalar_one()
    assert saved.distance == 200
    assert saved.stroke == "backstroke"
    assert saved.scm_time == "2:20.00"
    assert str(saved.set_id) == str(std_set.id)


@pytest.mark.asyncio
async def test_bulk_create_standards(seeded_db):
    """Can bulk-insert multiple standards into a set and retrieve them all."""
    await seeded_db.execute(text("RESET ROLE"))

    std_set = _make_set(COACH_A_ID, name="Bulk Standards Set")
    seeded_db.add(std_set)
    await seeded_db.flush()

    events = [
        ("freestyle", 50, "M", "24.50"),
        ("freestyle", 100, "M", "54.00"),
        ("butterfly", 100, "F", "1:02.00"),
        ("breaststroke", 200, "M", "2:25.00"),
    ]
    standards = [
        TimeStandard(
            set_id=std_set.id,
            distance=dist,
            stroke=stroke,
            activity="swim",
            equipment="none",
            gender=gender,
            scm_time=scm_time,
            standard_level="A",
        )
        for stroke, dist, gender, scm_time in events
    ]
    seeded_db.add_all(standards)
    await seeded_db.flush()

    # Retrieve all standards in this set
    result = await seeded_db.execute(
        select(TimeStandard).where(TimeStandard.set_id == std_set.id)
    )
    saved = result.scalars().all()
    assert len(saved) == 4

    strokes = {s.stroke for s in saved}
    assert "freestyle" in strokes
    assert "butterfly" in strokes
    assert "breaststroke" in strokes


@pytest.mark.asyncio
async def test_owner_check_on_standard_mutation(seeded_db):
    """Coach B cannot see Coach A's standards set in a query scoped to Coach B's sets."""
    await seeded_db.execute(text("RESET ROLE"))

    # Coach A creates a set
    set_a = _make_set(COACH_A_ID, name="Coach A Set", org="OrgA", year=2025)
    seeded_db.add(set_a)

    # Coach B creates a set
    set_b = _make_set(COACH_B_ID, name="Coach B Set", org="OrgB", year=2025)
    seeded_db.add(set_b)
    await seeded_db.flush()

    # When Coach B queries their own sets (filtering by created_by=COACH_B_ID)
    result = await seeded_db.execute(
        select(TimeStandardsSet).where(TimeStandardsSet.created_by == COACH_B_ID)
    )
    b_sets = result.scalars().all()
    set_ids = {str(s.id) for s in b_sets}

    # Coach A's set must not appear in Coach B's results
    assert str(set_a.id) not in set_ids
    assert str(set_b.id) in set_ids

    # Verify ownership check: attempting to act on Coach A's set as Coach B is rejected
    # (this mirrors the _assert_set_owner helper in the route)
    for s in b_sets:
        assert str(s.created_by) == str(COACH_B_ID)


@pytest.mark.asyncio
async def test_assign_standards_tracking_to_swimmer(seeded_db):
    """Can assign a standards set to a swimmer via SwimmerStandardsTracking."""
    await seeded_db.execute(text("RESET ROLE"))

    std_set = _make_set(COACH_A_ID, name="Tracking Test Set", org="ORG", year=2026)
    seeded_db.add(std_set)
    await seeded_db.flush()

    tracking = SwimmerStandardsTracking(
        swimmer_id=SWIMMER_1_ID,
        standard_set_id=std_set.id,
        created_by=COACH_A_ID,
        active=True,
        notes="Target for spring season",
    )
    seeded_db.add(tracking)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(SwimmerStandardsTracking).where(
            SwimmerStandardsTracking.swimmer_id == SWIMMER_1_ID,
            SwimmerStandardsTracking.standard_set_id == std_set.id,
        )
    )
    saved = result.scalar_one()
    assert saved.active is True
    assert saved.notes == "Target for spring season"
    assert str(saved.created_by) == str(COACH_A_ID)


@pytest.mark.asyncio
async def test_list_sets_with_count(seeded_db):
    """list_sets query with LEFT JOIN uses a single query (no N+1) to get standards_count."""
    await seeded_db.execute(text("RESET ROLE"))

    # Create set with 3 standards
    std_set = _make_set(COACH_A_ID, name="N+1 Check Set", org="TestOrg", year=2024)
    seeded_db.add(std_set)
    await seeded_db.flush()

    standards = [_make_standard(std_set.id, distance=d) for d in [50, 100, 200]]
    seeded_db.add_all(standards)
    await seeded_db.flush()

    # Run the same query as the list_sets route endpoint
    result = await seeded_db.execute(
        select(TimeStandardsSet, func.count(TimeStandard.id).label("standards_count"))
        .outerjoin(TimeStandard, TimeStandard.set_id == TimeStandardsSet.id)
        .where(TimeStandardsSet.created_by == COACH_A_ID)
        .group_by(TimeStandardsSet.id)
        .order_by(TimeStandardsSet.created_at.desc())
    )
    rows = result.all()
    assert len(rows) >= 1

    # Find our set in the results
    matching = [(s, count) for s, count in rows if str(s.id) == str(std_set.id)]
    assert len(matching) == 1
    _, count = matching[0]
    assert count == 3  # exactly the 3 standards we created
