"""
Type definitions for SwimRankings integration
"""

from datetime import datetime
from typing import Optional, Literal, List
from pydantic import BaseModel, Field


# Platform types
PlatformType = Literal['swimrankings', 'swimcloud', 'usaswimming', 'other']
GenderType = Literal['M', 'F']


class SwimRankingsSearchResult(BaseModel):
    """SwimRankings search result"""
    athlete_id: str
    name: str
    birth_year: Optional[str] = None
    gender: Optional[str] = None
    nation: Optional[str] = None
    club: Optional[str] = None
    last_result: Optional[str] = None
    url: str


class SwimmerExternalLinkBase(BaseModel):
    """Base model for swimmer external link"""
    platform: PlatformType
    external_id: str
    external_url: Optional[str] = None
    external_name: Optional[str] = None
    birth_year: Optional[int] = None
    nation_code: Optional[str] = None
    club_name: Optional[str] = None
    gender: Optional[GenderType] = None
    verified: bool = False
    auto_import_enabled: bool = True


class SwimmerExternalLinkCreate(SwimmerExternalLinkBase):
    """Create swimmer external link"""
    swimmer_id: str
    created_by: Optional[str] = None


class SwimmerExternalLinkUpdate(BaseModel):
    """Update swimmer external link"""
    verified: Optional[bool] = None
    auto_import_enabled: Optional[bool] = None
    last_sync_at: Optional[datetime] = None
    last_result_date: Optional[datetime] = None


class SwimmerExternalLink(SwimmerExternalLinkBase):
    """Full swimmer external link"""
    id: str
    swimmer_id: str
    last_sync_at: Optional[datetime] = None
    last_result_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


class LinkSwimmerRequest(BaseModel):
    """Request to link a swimmer to external platform"""
    swimmer_id: str
    swimrankings_athlete_id: str
    swimrankings_name: str
    birth_year: Optional[int] = None
    nation_code: Optional[str] = None
    club_name: Optional[str] = None
    gender: Optional[GenderType] = None
    verified: bool = Field(default=False, description="Coach confirms this is correct")


class LinkSwimmerResponse(BaseModel):
    """Response after linking swimmer"""
    success: bool
    message: str
    link: Optional[SwimmerExternalLink] = None


class ImportResultsRequest(BaseModel):
    """Request to import results from SwimRankings"""
    swimmer_id: str
    season: Optional[int] = Field(default=None, description="Season year (e.g., 2024). If None, imports all-time best times")
    include_splits: bool = Field(default=True, description="Whether to fetch and import split times")


class ImportedResult(BaseModel):
    """Single imported result"""
    distance: int
    stroke: str
    time_seconds: float
    course: str  # LCM, SCM, SCY
    meet_name: str
    meet_date: str
    meet_city: Optional[str]
    meet_nation: Optional[str]
    points: Optional[int]
    splits_count: int = 0


class ImportResultsResponse(BaseModel):
    """Response after importing results"""
    success: bool
    message: str
    imported_count: int = 0
    skipped_count: int = 0
    error_count: int = 0
    results: List[ImportedResult] = []


class EventAttempt(BaseModel):
    """Single attempt/result for an event"""
    time: str
    points: int
    date: str
    location: str
    meet_name: str
    course: str  # "Long Course (50m)" or "Short Course (25m)"
    result_id: Optional[str] = None
    meet_link: Optional[str] = None


class RaceSplit(BaseModel):
    """Single split from a race"""
    split_distance: int
    split_time: float  # seconds
    cumulative_time: float  # seconds
    split_order: int


class EventResult(BaseModel):
    """Complete result with splits"""
    attempt: EventAttempt
    reaction_time: Optional[float] = None
    splits: List[RaceSplit] = []


class FetchEventAttemptsRequest(BaseModel):
    """Request to fetch all attempts for a specific event"""
    swimmer_id: str
    event_name: str = Field(
        description="Event name (e.g., '200m Freestyle', '100m Butterfly')"
    )
    limit: Optional[int] = Field(
        default=None,
        description="Maximum number of results to fetch (None = all)"
    )
    skip_no_splits: bool = Field(
        default=False,
        description="If true, only include results that have splits"
    )


class FetchEventAttemptsResponse(BaseModel):
    """Response with event attempts"""
    success: bool
    message: str
    event_name: str
    style_id: str
    total_results: int
    results: List[EventResult] = []
