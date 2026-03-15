"""
SwimRankings.net API routes
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List
import time
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import get_db
from app.infrastructure.models import Swimmer, SwimmerExternalLink, CoachSquad
from app.models.swimrankings import (
    SwimRankingsSearchResult,
    LinkSwimmerRequest,
    LinkSwimmerResponse,
    SwimmerExternalLink as SwimmerExternalLinkSchema,
)
from app.services.swimrankings_service import SwimRankingsScraper
from app.middleware.auth import get_current_user_id
from app.utils import logger, log_error
from app.utils.fina_calculator import calculate_fina_points, time_string_to_seconds


router = APIRouter(prefix="/swimrankings", tags=["swimrankings"])

# Simple in-memory cache for search results (expires every 15 minutes).
# This cache is process-local — it is NOT shared across multiple Uvicorn
# worker processes. Each process maintains its own independent copy.
_search_cache = {}
CACHE_TTL_SECONDS = 900


def get_cached_search(firstname: str, lastname: str) -> List[dict] | None:
    cache_key = (firstname.lower().strip(), lastname.lower().strip())
    if cache_key in _search_cache:
        timestamp, results = _search_cache[cache_key]
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            logger.info(f"Cache hit for {firstname} {lastname}")
            return results
        else:
            del _search_cache[cache_key]
    return None


def cache_search_results(firstname: str, lastname: str, results: List[dict]):
    cache_key = (firstname.lower().strip(), lastname.lower().strip())
    _search_cache[cache_key] = (time.time(), results)
    logger.debug(f"Cached results for {firstname} {lastname}")


@router.get("/search", response_model=List[SwimRankingsSearchResult])
async def search_swimmers(firstname: str, lastname: str):
    """Search for swimmers on SwimRankings.net"""
    start_time = time.time()
    logger.info(f"API search request: {firstname} {lastname}")

    try:
        cached_results = get_cached_search(firstname, lastname)
        if cached_results is not None:
            swimmers = [
                SwimRankingsSearchResult(
                    athlete_id=r['athlete_id'], name=r['name'],
                    birth_year=r.get('birth_year'), gender=r.get('gender'),
                    nation=r.get('nation'), club=r.get('club'),
                    last_result=r.get('last_result', ''), url=r['url'],
                )
                for r in cached_results
            ]
            elapsed = (time.time() - start_time) * 1000
            logger.info(f"Returning {len(swimmers)} cached results in {elapsed:.2f}ms")
            return swimmers

        scraper = SwimRankingsScraper(use_curl=True)
        results = await scraper.search_swimmer(firstname, lastname)
        cache_search_results(firstname, lastname, results)

        swimmers = [
            SwimRankingsSearchResult(
                athlete_id=r['athlete_id'], name=r['name'],
                birth_year=r.get('birth_year'), gender=r.get('gender'),
                nation=r.get('nation'), club=r.get('club'),
                last_result=r.get('last_result', ''), url=r['url'],
            )
            for r in results
        ]

        elapsed = (time.time() - start_time) * 1000
        logger.info(f"Returning {len(swimmers)} search results in {elapsed:.2f}ms")
        return swimmers

    except Exception as e:
        elapsed = (time.time() - start_time) * 1000
        log_error(e, context="search_swimmers", firstname=firstname, lastname=lastname, elapsed_ms=elapsed)
        raise HTTPException(status_code=500, detail="Failed to search SwimRankings")


@router.post("/link", response_model=LinkSwimmerResponse)
async def link_swimmer(
    request: LinkSwimmerRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Link a swimmer to their SwimRankings profile"""
    logger.info(f"Linking swimmer {request.swimmer_id} to SwimRankings athlete {request.swimrankings_athlete_id}")

    try:
        # Verify swimmer exists
        result = await db.execute(
            select(Swimmer).where(Swimmer.id == request.swimmer_id)
        )
        swimmer = result.scalar_one_or_none()
        if not swimmer:
            raise HTTPException(status_code=404, detail="Swimmer not found")

        if not swimmer.squad_id:
            raise HTTPException(status_code=400, detail="Swimmer must belong to a squad")

        # Verify coach access
        coach_check = await db.execute(
            select(CoachSquad)
            .where(CoachSquad.squad_id == swimmer.squad_id)
            .where(CoachSquad.coach_id == user_id)
        )
        if not coach_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not authorized to manage this swimmer")

        # Check if link already exists
        existing = await db.execute(
            select(SwimmerExternalLink)
            .where(SwimmerExternalLink.swimmer_id == request.swimmer_id)
            .where(SwimmerExternalLink.external_source == "swimrankings")
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Swimmer already linked to SwimRankings")

        # Create link
        link = SwimmerExternalLink(
            swimmer_id=request.swimmer_id,
            external_source="swimrankings",
            external_athlete_id=request.swimrankings_athlete_id,
            external_url=f"https://www.swimrankings.net/index.php?page=athleteDetail&athleteId={request.swimrankings_athlete_id}",
            external_name=request.swimrankings_name,
            birth_year=request.birth_year,
            nation_code=request.nation_code,
            club_name=request.club_name,
            gender=request.gender,
            verified=request.verified,
            auto_import_enabled=False,
            created_by=user_id,
            sync_status="pending",
        )
        db.add(link)
        await db.commit()
        await db.refresh(link)

        logger.info(f"Successfully linked swimmer {request.swimmer_id} to SwimRankings")

        return LinkSwimmerResponse(
            success=True,
            message="Swimmer successfully linked to SwimRankings",
            link=SwimmerExternalLinkSchema(
                id=str(link.id),
                swimmer_id=str(link.swimmer_id),
                platform="swimrankings",
                external_id=link.external_athlete_id,
                external_url=f"https://www.swimrankings.net/index.php?page=athleteDetail&athleteId={link.external_athlete_id}",
                external_name=request.swimrankings_name,
                birth_year=request.birth_year,
                nation_code=request.nation_code,
                club_name=request.club_name,
                gender=request.gender,
                verified=request.verified,
                auto_import_enabled=False,
                last_sync_at=None,
                last_result_date=None,
                created_at=str(link.created_at),
                updated_at=None,
                created_by=user_id,
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        log_error(e, context="link_swimmer", swimmer_id=request.swimmer_id, athlete_id=request.swimrankings_athlete_id)
        raise HTTPException(status_code=500, detail="Failed to link swimmer")


@router.get("/swimmer/{swimmer_id}/links", response_model=List[SwimmerExternalLinkSchema])
async def get_swimmer_links(
    swimmer_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all external platform links for a swimmer"""
    logger.info(f"Get links for swimmer {swimmer_id}")

    try:
        # Verify swimmer exists
        result = await db.execute(
            select(Swimmer).where(Swimmer.id == swimmer_id)
        )
        swimmer = result.scalar_one_or_none()
        if not swimmer:
            raise HTTPException(status_code=404, detail="Swimmer not found")

        if not swimmer.squad_id:
            raise HTTPException(status_code=400, detail="Swimmer must belong to a squad")

        # Verify coach access
        coach_check = await db.execute(
            select(CoachSquad)
            .where(CoachSquad.squad_id == swimmer.squad_id)
            .where(CoachSquad.coach_id == user_id)
        )
        if not coach_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not authorized to view this swimmer")

        # Get links
        links_result = await db.execute(
            select(SwimmerExternalLink).where(SwimmerExternalLink.swimmer_id == swimmer_id)
        )
        links = links_result.scalars().all()

        logger.info(f"Found {len(links)} links for swimmer {swimmer_id}")
        return [SwimmerExternalLinkSchema(
            id=str(link.id),
            swimmer_id=str(link.swimmer_id),
            platform=link.external_source if link.external_source in ("swimrankings", "swimcloud", "usaswimming", "other") else "other",
            external_id=link.external_athlete_id or "",
            external_url=link.external_url or (f"https://www.swimrankings.net/index.php?page=athleteDetail&athleteId={link.external_athlete_id}" if link.external_athlete_id else None),
            external_name=link.external_name,
            birth_year=link.birth_year,
            nation_code=link.nation_code,
            club_name=link.club_name,
            gender=link.gender,
            verified=link.verified,
            auto_import_enabled=link.auto_import_enabled,
            created_at=str(link.created_at),
            updated_at=str(link.updated_at) if link.updated_at else None,
            created_by=str(link.created_by) if link.created_by else None,
        ) for link in links]

    except HTTPException:
        raise
    except Exception as e:
        log_error(e, context="get_swimmer_links", swimmer_id=swimmer_id)
        raise HTTPException(status_code=500, detail="Failed to get swimmer links")


@router.delete("/link/{link_id}")
async def delete_link(
    link_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete an external platform link"""
    logger.info(f"Delete link {link_id}")

    try:
        # Get link with swimmer's squad_id
        result = await db.execute(
            select(SwimmerExternalLink).where(SwimmerExternalLink.id == link_id)
        )
        link = result.scalar_one_or_none()
        if not link:
            raise HTTPException(status_code=404, detail="Link not found")

        # Get swimmer to check squad
        swimmer_result = await db.execute(
            select(Swimmer).where(Swimmer.id == link.swimmer_id)
        )
        swimmer = swimmer_result.scalar_one_or_none()
        if not swimmer or not swimmer.squad_id:
            raise HTTPException(status_code=400, detail="Swimmer must belong to a squad")

        # Verify coach access
        coach_check = await db.execute(
            select(CoachSquad)
            .where(CoachSquad.squad_id == swimmer.squad_id)
            .where(CoachSquad.coach_id == user_id)
        )
        if not coach_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not authorized to delete this link")

        await db.delete(link)
        await db.commit()

        logger.info(f"Successfully deleted link {link_id}")
        return {"success": True, "message": "Link deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        log_error(e, context="delete_link", link_id=link_id)
        raise HTTPException(status_code=500, detail="Failed to delete link")


@router.get("/athlete/{athlete_id}/fina-points")
async def get_athlete_fina_points(
    athlete_id: str,
    gender: str,
    course: str = "LCM",
):
    """Get FINA points for an external athlete from SwimRankings"""
    logger.info(f"Getting FINA points for athlete {athlete_id} ({gender}, {course})")

    if gender.upper() not in ['M', 'F', 'MALE', 'FEMALE']:
        raise HTTPException(status_code=400, detail="Gender must be M/F or Male/Female")
    if course.upper() not in ['LCM', 'SCM']:
        raise HTTPException(status_code=400, detail="Course must be LCM or SCM")

    gender_normalized = 'male' if gender.upper() in ['M', 'MALE'] else 'female'
    course_normalized = course.upper()

    try:
        scraper = SwimRankingsScraper()
        best_times = await scraper.get_athlete_best_times(athlete_id)

        if not best_times:
            return {
                "athlete_id": athlete_id, "gender": gender_normalized,
                "course": course_normalized, "by_stroke": {}, "all_results": [],
            }

        filtered_times = [
            t for t in best_times
            if t['course'] == course_normalized and not t.get('is_relay_lap', False)
        ]

        if not filtered_times:
            return {
                "athlete_id": athlete_id, "gender": gender_normalized,
                "course": course_normalized, "by_stroke": {}, "all_results": [],
            }

        results_with_fina = []
        for time_data in filtered_times:
            try:
                time_seconds = time_string_to_seconds(time_data['time'])
                fina_points = calculate_fina_points(
                    distance=time_data['distance'], stroke=time_data['stroke'],
                    time_seconds=time_seconds, gender=gender_normalized, course=course_normalized,
                )
                if fina_points is not None:
                    results_with_fina.append({
                        **time_data, 'time_seconds': time_seconds, 'fina_points': round(fina_points),
                    })
            except Exception as e:
                logger.warning(f"Error calculating FINA points for {time_data}: {e}")

        by_stroke = {}
        for result in results_with_fina:
            stroke = result['stroke']
            by_stroke.setdefault(stroke, []).append(result)

        for stroke in by_stroke:
            by_stroke[stroke] = sorted(by_stroke[stroke], key=lambda x: x['fina_points'], reverse=True)

        all_sorted = sorted(results_with_fina, key=lambda x: x['fina_points'], reverse=True)

        logger.info(f"Calculated FINA points for {len(results_with_fina)} times")
        return {
            "athlete_id": athlete_id, "gender": gender_normalized,
            "course": course_normalized, "by_stroke": by_stroke, "all_results": all_sorted,
        }

    except Exception as e:
        log_error(e, context="get_athlete_fina_points", athlete_id=athlete_id)
        raise HTTPException(status_code=500, detail="Failed to get athlete FINA points")
