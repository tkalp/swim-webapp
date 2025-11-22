"""
SwimRankings.net API routes
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List

from app.infrastructure.database import get_supabase_client
from app.models.swimrankings import (
    SwimRankingsSearchResult,
    LinkSwimmerRequest,
    LinkSwimmerResponse,
    SwimmerExternalLink
)
from app.services.swimrankings_service import SwimRankingsScraper
from app.middleware.auth import get_current_user_id
from app.utils import logger, log_error
from app.utils.fina_calculator import calculate_fina_points, time_string_to_seconds


router = APIRouter(prefix="/swimrankings", tags=["swimrankings"])


@router.get("/search", response_model=List[SwimRankingsSearchResult])
async def search_swimmers(
    firstname: str,
    lastname: str
):
    """
    Search for swimmers on SwimRankings.net
    
    Args:
        firstname: Swimmer's first name
        lastname: Swimmer's last name
    
    Returns:
        List of matching swimmers
    """
    logger.info(f"API search request: {firstname} {lastname}")
    
    try:
        scraper = SwimRankingsScraper()
        results = await scraper.search_swimmer(firstname, lastname)
        
        # Convert to Pydantic models
        swimmers = []
        for result in results:
            swimmers.append(SwimRankingsSearchResult(
                athlete_id=result['athlete_id'],
                name=result['name'],
                birth_year=result.get('birth_year'),
                gender=result.get('gender'),
                nation=result.get('nation'),
                club=result.get('club'),
                last_result=result.get('last_result', ''),
                url=result['url']
            ))
        
        logger.info(f"Returning {len(swimmers)} search results")
        return swimmers
        
    except Exception as e:
        log_error(e, context="search_swimmers", firstname=firstname, lastname=lastname)
        raise HTTPException(status_code=500, detail="Failed to search SwimRankings")


@router.post("/link", response_model=LinkSwimmerResponse)
async def link_swimmer(
    request: LinkSwimmerRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Link a swimmer to their SwimRankings profile
    
    Args:
        request: Link request with swimmer_id and SwimRankings data
        user_id: Authenticated user ID
    
    Returns:
        Created link
    """
    supabase = get_supabase_client()
    logger.info(f"Linking swimmer {request.swimmer_id} to SwimRankings athlete {request.swimrankings_athlete_id}")
    
    try:
        # Verify swimmer exists and get squad_id
        swimmer_check = supabase.table('swimmers').select('id, squad_id').eq('id', request.swimmer_id).execute()
        
        if not swimmer_check.data:
            logger.warning(f"Swimmer {request.swimmer_id} not found")
            raise HTTPException(status_code=404, detail="Swimmer not found")
        
        swimmer = swimmer_check.data[0]
        squad_id = swimmer.get('squad_id')
        
        if not squad_id:
            logger.warning(f"Swimmer {request.swimmer_id} has no squad")
            raise HTTPException(status_code=400, detail="Swimmer must belong to a squad")
        
        # Verify user is a coach of this swimmer's squad
        coach_check = supabase.table('coach_squads').select('id, can_manage_swimmers').eq(
            'squad_id', squad_id
        ).eq('coach_id', user_id).execute()
        
        if not coach_check.data:
            logger.warning(f"User {user_id} is not a coach of squad {squad_id}")
            raise HTTPException(status_code=403, detail="Not authorized to manage this swimmer")
        
        # Check if link already exists
        existing_link = supabase.table('swimmer_external_links').select('*').eq(
            'swimmer_id', request.swimmer_id
        ).eq('platform', 'swimrankings').execute()
        
        if existing_link.data:
            logger.info(f"Link already exists for swimmer {request.swimmer_id}")
            raise HTTPException(status_code=400, detail="Swimmer already linked to SwimRankings")
        
        # Build SwimRankings URL
        swimrankings_url = f"https://www.swimrankings.net/index.php?page=athleteDetail&athleteId={request.swimrankings_athlete_id}"
        
        # Create link
        link_data = {
            'swimmer_id': request.swimmer_id,
            'platform': 'swimrankings',
            'external_id': request.swimrankings_athlete_id,
            'external_url': swimrankings_url,
            'external_name': request.swimrankings_name,
            'birth_year': request.birth_year,
            'nation_code': request.nation_code,
            'club_name': request.club_name,
            'gender': request.gender,
            'verified': request.verified,
            'auto_import_enabled': False,
            'created_by': user_id
        }
        
        result = supabase.table('swimmer_external_links').insert(link_data).execute()
        
        if not result.data:
            logger.error("Failed to create swimmer link")
            raise HTTPException(status_code=500, detail="Failed to create link")
        
        created_link = result.data[0]
        logger.info(f"Successfully linked swimmer {request.swimmer_id} to SwimRankings")
        
        # Type assertion for dictionary
        link_dict: dict = created_link  # type: ignore
        
        return LinkSwimmerResponse(
            success=True,
            message="Swimmer successfully linked to SwimRankings",
            link=SwimmerExternalLink(
                id=link_dict['id'],
                swimmer_id=link_dict['swimmer_id'],
                platform=link_dict['platform'],
                external_id=link_dict['external_id'],
                external_url=link_dict.get('external_url'),
                external_name=link_dict.get('external_name'),
                birth_year=link_dict.get('birth_year'),
                nation_code=link_dict.get('nation_code'),
                club_name=link_dict.get('club_name'),
                gender=link_dict.get('gender'),
                verified=link_dict.get('verified', False),
                auto_import_enabled=link_dict.get('auto_import_enabled', True),
                last_sync_at=link_dict.get('last_sync_at'),
                last_result_date=link_dict.get('last_result_date'),
                created_at=link_dict['created_at'],
                updated_at=link_dict['updated_at'],
                created_by=link_dict.get('created_by')
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, context="link_swimmer", swimmer_id=request.swimmer_id, athlete_id=request.swimrankings_athlete_id)
        raise HTTPException(status_code=500, detail="Failed to link swimmer")


@router.get("/swimmer/{swimmer_id}/links", response_model=List[SwimmerExternalLink])
async def get_swimmer_links(
    swimmer_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get all external platform links for a swimmer
    
    Args:
        swimmer_id: Swimmer ID
        user_id: Authenticated user ID
    
    Returns:
        List of external links
    """
    logger.info(f"Get links for swimmer {swimmer_id}")
    
    try:
        supabase = get_supabase_client()
        # Verify swimmer exists and get squad_id
        swimmer_check = supabase.table('swimmers').select('id, squad_id').eq('id', swimmer_id).execute()
        
        if not swimmer_check.data:
            raise HTTPException(status_code=404, detail="Swimmer not found")
        
        swimmer = swimmer_check.data[0]
        squad_id = swimmer.get('squad_id')
        
        if not squad_id:
            raise HTTPException(status_code=400, detail="Swimmer must belong to a squad")
        
        # Verify user is a coach of this swimmer's squad
        coach_check = supabase.table('coach_squads').select('id').eq(
            'squad_id', squad_id
        ).eq('coach_id', user_id).execute()
        
        if not coach_check.data:
            raise HTTPException(status_code=403, detail="Not authorized to view this swimmer")
        
        # Get links
        links_result = supabase.table('swimmer_external_links').select('*').eq('swimmer_id', swimmer_id).execute()
        
        links = [SwimmerExternalLink(**link) for link in links_result.data]
        logger.info(f"Found {len(links)} links for swimmer {swimmer_id}")
        
        return links
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, context="get_swimmer_links", swimmer_id=swimmer_id)
        raise HTTPException(status_code=500, detail="Failed to get swimmer links")


@router.delete("/link/{link_id}")
async def delete_link(
    link_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Delete an external platform link
    
    Args:
        link_id: Link ID
        user_id: Authenticated user ID
    
    Returns:
        Success message
    """
    logger.info(f"Delete link {link_id}")
    
    try:
        supabase = get_supabase_client()
        # Get link and swimmer's squad_id
        link_result = supabase.table('swimmer_external_links').select('*, swimmers!inner(squad_id)').eq('id', link_id).execute()
        
        if not link_result.data:
            raise HTTPException(status_code=404, detail="Link not found")
        
        link = link_result.data[0]
        squad_id = link['swimmers']['squad_id']
        
        if not squad_id:
            raise HTTPException(status_code=400, detail="Swimmer must belong to a squad")
        
        # Verify user is a coach of the swimmer's squad with manage_swimmers permission
        coach_check = supabase.table('coach_squads').select('id, can_manage_swimmers').eq(
            'squad_id', squad_id
        ).eq('coach_id', user_id).execute()
        
        if not coach_check.data:
            raise HTTPException(status_code=403, detail="Not authorized to delete this link")
        
        # Delete link
        supabase.table('swimmer_external_links').delete().eq('id', link_id).execute()
        
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
    course: str = "LCM"
):
    """
    Get FINA points for an external athlete from SwimRankings
    
    Args:
        athlete_id: SwimRankings athlete ID
        gender: Athlete gender (M or F)
        course: Course type (LCM or SCM)
    
    Returns:
        Best times with FINA points grouped by stroke
    """
    logger.info(f"Getting FINA points for athlete {athlete_id} ({gender}, {course})")
    
    # Validate inputs
    if gender.upper() not in ['M', 'F', 'MALE', 'FEMALE']:
        raise HTTPException(status_code=400, detail="Gender must be M/F or Male/Female")
    
    if course.upper() not in ['LCM', 'SCM']:
        raise HTTPException(status_code=400, detail="Course must be LCM or SCM")
    
    # Normalize gender
    gender_normalized = 'male' if gender.upper() in ['M', 'MALE'] else 'female'
    course_normalized = course.upper()
    
    try:
        scraper = SwimRankingsScraper()
        best_times = await scraper.get_athlete_best_times(athlete_id)
        
        if not best_times:
            logger.warning(f"No best times found for athlete {athlete_id}")
            return {
                "athlete_id": athlete_id,
                "gender": gender_normalized,
                "course": course_normalized,
                "by_stroke": {},
                "all_results": []
            }
        
        # Filter by course and exclude relay lap times
        filtered_times = [
            t for t in best_times 
            if t['course'] == course_normalized and not t.get('is_relay_lap', False)
        ]
        
        if not filtered_times:
            logger.info(f"No times found for {course_normalized} course")
            return {
                "athlete_id": athlete_id,
                "gender": gender_normalized,
                "course": course_normalized,
                "by_stroke": {},
                "all_results": []
            }
        
        # Calculate FINA points for each time
        results_with_fina = []
        for time_data in filtered_times:
            try:
                # Convert time to seconds
                time_seconds = time_string_to_seconds(time_data['time'])
                
                # Calculate FINA points
                fina_points = calculate_fina_points(
                    distance=time_data['distance'],
                    stroke=time_data['stroke'],
                    time_seconds=time_seconds,
                    gender=gender_normalized,
                    course=course_normalized
                )
                
                if fina_points is not None:
                    result = {
                        **time_data,
                        'time_seconds': time_seconds,
                        'fina_points': round(fina_points)
                    }
                    results_with_fina.append(result)
                    
            except Exception as e:
                logger.warning(f"Error calculating FINA points for {time_data}: {e}")
                continue
        
        # Group by stroke
        by_stroke = {}
        for result in results_with_fina:
            stroke = result['stroke']
            if stroke not in by_stroke:
                by_stroke[stroke] = []
            by_stroke[stroke].append(result)
        
        # Sort each stroke by FINA points (descending)
        for stroke in by_stroke:
            by_stroke[stroke] = sorted(by_stroke[stroke], key=lambda x: x['fina_points'], reverse=True)
        
        # Sort all results by FINA points
        all_sorted = sorted(results_with_fina, key=lambda x: x['fina_points'], reverse=True)
        
        logger.info(f"Calculated FINA points for {len(results_with_fina)} times")
        
        return {
            "athlete_id": athlete_id,
            "gender": gender_normalized,
            "course": course_normalized,
            "by_stroke": by_stroke,
            "all_results": all_sorted
        }
        
    except Exception as e:
        log_error(e, context="get_athlete_fina_points", athlete_id=athlete_id)
        raise HTTPException(status_code=500, detail="Failed to get athlete FINA points")
