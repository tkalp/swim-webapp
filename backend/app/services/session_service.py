# backend/app/services/session_service.py
from datetime import datetime
from typing import Optional, Dict, Any
from app.infrastructure.database import get_supabase_client
from app.utils import logger


def materialize_session(
    squad_id: str,
    start_date: str,
    end_date: str,
    training_type: str,
    workout_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Materialize a virtual session into the database.
    
    Converts a virtual session (calculated from schedule) into a real database record.
    Uses upsert to handle cases where session already exists.
    
    Args:
        squad_id: ID of the squad
        start_date: Session start datetime (ISO format)
        end_date: Session end datetime (ISO format)
        training_type: Type of training session ('Swim' or 'Dryland')
        workout_id: Optional workout ID to assign
    
    Returns:
        Created/updated session record
        
    Raises:
        Exception: If materialization fails
    """
    try:
        supabase = get_supabase_client()
        
        session_data = {
            'squad_id': squad_id,
            'start_date': start_date,
            'end_date': end_date,
            'training_type': training_type,
            'workout_id': workout_id
        }
        
        logger.info(f"Materializing session for squad {squad_id} at {start_date}")
        
        # Upsert session (create or update if exists)
        response = supabase.table('training_sessions')\
            .upsert(
                session_data,
                on_conflict='squad_id,start_date',
                ignore_duplicates=False  # Update if exists
            )\
            .execute()
        
        if not response.data:
            raise Exception("Failed to materialize session - no data returned")
        
        materialized_session = response.data[0] if isinstance(response.data, list) else response.data
        
        logger.info(f"Session materialized successfully with ID: {materialized_session.get('id')}")
        
        return materialized_session
        
    except Exception as e:
        logger.error(f"Error materializing session: {str(e)}")
        raise


def cleanup_virtual_sessions(squad_id: str, schedule_id: Optional[str] = None) -> int:
    """
    Clean up future non-materialized sessions.
    
    Deletes sessions that:
    - Are in the future (start_date > NOW)
    - Have no workout assigned (workout_id IS NULL)
    - Have no attendance records
    
    This is called when a schedule is updated to force recalculation.
    
    Args:
        squad_id: ID of the squad
        schedule_id: Optional schedule ID to limit cleanup to specific schedule's sessions
    
    Returns:
        Number of sessions deleted
    """
    try:
        supabase = get_supabase_client()
        
        now = datetime.utcnow().isoformat()
        
        logger.info(f"Cleaning up virtual sessions for squad {squad_id}")
        
        # Find sessions with no attendance
        attendance_response = supabase.table('training_attendance')\
            .select('training_session_id')\
            .execute()
        
        sessions_with_attendance = set(
            record['training_session_id'] 
            for record in (attendance_response.data or [])
        )
        
        # Query future sessions without workouts
        query = supabase.table('training_sessions')\
            .select('id')\
            .eq('squad_id', squad_id)\
            .gt('start_date', now)\
            .is_('workout_id', 'null')
        
        sessions_response = query.execute()
        sessions = sessions_response.data or []
        
        # Filter out sessions with attendance
        sessions_to_delete = [
            session['id'] 
            for session in sessions 
            if session['id'] not in sessions_with_attendance
        ]
        
        if not sessions_to_delete:
            logger.info("No sessions to clean up")
            return 0
        
        # Delete sessions
        delete_response = supabase.table('training_sessions')\
            .delete()\
            .in_('id', sessions_to_delete)\
            .execute()
        
        deleted_count = len(sessions_to_delete)
        logger.info(f"Cleaned up {deleted_count} virtual sessions")
        
        return deleted_count
        
    except Exception as e:
        logger.error(f"Error cleaning up virtual sessions: {str(e)}")
        raise
