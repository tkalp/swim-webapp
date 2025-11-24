"""
Domain models and types for worker service
"""

from dataclasses import dataclass, field
from typing import Optional, List, Literal
from datetime import datetime

# Type definitions
SyncStatus = Literal['pending', 'in_progress', 'completed', 'failed', 'cancelled']
StrokeType = Literal['free', 'back', 'breast', 'fly', 'im']
CourseType = Literal['LCM', 'SCM']


@dataclass
class RaceSplit:
    """Represents a single race split"""
    split_distance: int
    split_time: float
    cumulative_time: float
    split_order: int


@dataclass
class AttemptData:
    """Represents a single swimming attempt/result"""
    time: str
    points: int
    date: str
    location: str
    meet_name: str
    course: str
    result_id: Optional[str] = None
    meet_link: Optional[str] = None


@dataclass
class ResultWithSplits:
    """Represents an attempt with its splits and reaction time"""
    attempt: AttemptData
    reaction_time: Optional[float] = None
    splits: List[RaceSplit] = field(default_factory=list)
    has_splits_available: Optional[bool] = None  # None=unknown, True=has splits, False=unavailable


@dataclass
class WorkoutResult:
    """Represents a workout result to be inserted into database"""
    swimmer_id: str
    distance: int
    stroke: StrokeType
    time_result: str
    result_units: CourseType
    performed_on: str
    meet_name: Optional[str] = None
    meet_city: Optional[str] = None
    meet_nation: Optional[str] = None
    source: str = 'swimrankings'
    swimrankings_result_id: Optional[str] = None
    reaction_time: Optional[float] = None
    activity: str = 'swim'
    equipment: str = 'none'
    has_splits_available: Optional[bool] = None  # None=unknown, True=has splits, False=unavailable


@dataclass
class SwimmerEvent:
    """Represents a swimming event configuration"""
    name: str
    distance: int
    stroke: StrokeType
    style_id: str


@dataclass
class SyncProgress:
    """Represents synchronization progress"""
    events_processed: int = 0
    results_imported: int = 0
    results_skipped: int = 0
    errors: int = 0
    current_event: Optional[str] = None


@dataclass
class SyncResult:
    """Represents the final result of a sync operation"""
    swimmer_id: str
    external_link_id: str
    events_processed: int
    results_imported: int
    results_skipped: int
    errors: int
    success: bool
    error_message: Optional[str] = None


@dataclass
class SyncStatusUpdate:
    """Represents a sync status update for the database"""
    sync_status: SyncStatus
    last_sync_started_at: Optional[str] = None
    last_sync_completed_at: Optional[str] = None
    sync_error: Optional[str] = None
    sync_progress: Optional[int] = None
    sync_total: Optional[int] = None
    results_count: Optional[int] = None
