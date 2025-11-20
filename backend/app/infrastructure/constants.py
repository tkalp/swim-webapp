"""Application constants - database tables, statuses, and configuration values."""
from enum import Enum


class Tables:
    """Database table names."""
    
    SWIMMERS = "swimmers"
    SWIMMER_EXTERNAL_LINKS = "swimmer_external_links"
    SQUADS = "squads"
    SQUAD_MEMBERS = "coach_squads"  # Changed: actual table for squad membership
    WORKOUT_RESULTS = "workout_result"
    RACE_SPLITS = "race_splits"
    PROFILES = "profiles"
    COACH = "coach"
    TRAINING_SESSIONS = "training_sessions"
    TRAINING_ATTENDANCE = "training_attendance"


class SyncStatus(str, Enum):
    """Synchronization status values."""
    
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class EventDistance(int, Enum):
    """Standard swimming event distances in meters."""
    
    FIFTY = 50
    HUNDRED = 100
    TWO_HUNDRED = 200
    FOUR_HUNDRED = 400
    EIGHT_HUNDRED = 800
    FIFTEEN_HUNDRED = 1500


class SwimStroke(str, Enum):
    """Swimming stroke types."""
    
    FREESTYLE = "Freestyle"
    BACKSTROKE = "Backstroke"
    BREASTSTROKE = "Breaststroke"
    BUTTERFLY = "Butterfly"
    INDIVIDUAL_MEDLEY = "Individual Medley"


class PoolLength(int, Enum):
    """Standard pool lengths in meters."""
    
    SHORT_COURSE = 25
    LONG_COURSE = 50


class TimeInterval(str, Enum):
    """Time interval options for queries."""
    
    WEEK = "week"
    MONTH = "month"
    THREE_MONTHS = "3months"
    SIX_MONTHS = "6months"
    YEAR = "year"
    ALL_TIME = "all"
