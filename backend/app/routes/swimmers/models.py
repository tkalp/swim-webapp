"""Pydantic models for swimmer routes."""
from pydantic import BaseModel
from typing import Optional


class SwimmerData(BaseModel):
    """Data for creating a swimmer."""
    first_name: str
    last_name: str
    sex: Optional[str] = None
    date_of_birth: Optional[str] = None
    squad_id: str


class ExternalLinkData(BaseModel):
    """Data for external platform link."""
    platform: str
    external_id: str
    external_url: Optional[str] = None
    external_name: Optional[str] = None
    birth_year: Optional[int] = None
    nation_code: Optional[str] = None
    club_name: Optional[str] = None
    gender: Optional[str] = None


class CreateSwimmerWithLinkRequest(BaseModel):
    """Request to create swimmer with external link."""
    swimmer: SwimmerData
    external_link: ExternalLinkData
    auto_sync: bool = True


class CreateSwimmerWithLinkResponse(BaseModel):
    """Response after creating swimmer with external link."""
    swimmer_id: str
    external_link_id: str
    sync_started: bool
    message: str
