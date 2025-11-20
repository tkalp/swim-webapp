"""Swimmer repository for managing swimmer data and external links."""
from typing import Dict, List, Optional, Any, cast
from supabase import Client
from app.repositories.base import BaseRepository
from app.infrastructure.constants import Tables, SyncStatus
from app.domain.exceptions import NotFoundError, DatabaseError


class SwimmerRepository(BaseRepository):
    """Repository for swimmer operations."""
    
    def __init__(self, db: Optional[Client] = None):
        super().__init__(Tables.SWIMMERS, db)
    
    def find_by_user_id(self, user_id: str) -> List[Dict[str, Any]]:
        """Find all swimmers for a coach (user).
        
        Swimmers are associated with coaches through squads.
        
        Args:
            user_id: Coach identifier
            
        Returns:
            List of swimmer records
        """
        try:
            # Get all squads this coach has access to via coach_squads
            coach_squads_response = self.db.table('coach_squads').select("squad_id").eq("coach_id", user_id).execute()
            
            if not coach_squads_response.data:
                return []
            
            squad_ids = [cs["squad_id"] for cs in coach_squads_response.data]
            
            # Get all swimmers in those squads
            swimmers_response = (
                self.db.table(self.table_name)
                .select("*")
                .in_("squad_id", squad_ids)
                .order("first_name, last_name")
                .execute()
            )
            
            return cast(List[Dict[str, Any]], swimmers_response.data or [])
        except Exception as e:
            raise DatabaseError(f"Failed to fetch swimmers for coach {user_id}") from e
    
    def verify_coach_access(self, swimmer_id: str, coach_id: str) -> bool:
        """Verify coach has access to swimmer via squad membership.
        
        Args:
            swimmer_id: Swimmer identifier (UUID)
            coach_id: Coach identifier (UUID)
            
        Returns:
            True if coach has access to the swimmer
            
        Raises:
            NotFoundError: If swimmer not found
        """
        try:
            # Get swimmer with squad_id
            swimmer_response = self.db.table(self.table_name).select('id, squad_id').eq('id', swimmer_id).execute()
            
            if not swimmer_response.data:
                raise NotFoundError("Swimmer", swimmer_id)
            
            swimmer = swimmer_response.data[0]
            squad_id = swimmer.get('squad_id')
            
            if not squad_id:
                return False
            
            # Check if coach has access to this squad via coach_squads
            coach_squad_response = self.db.table('coach_squads').select('id').eq(
                'coach_id', coach_id
            ).eq('squad_id', squad_id).execute()
            
            return bool(coach_squad_response.data)
        except NotFoundError:
            raise
        except Exception as e:
            raise DatabaseError(f"Failed to verify coach access to swimmer {swimmer_id}") from e
    
    def find_with_external_link(
        self,
        swimmer_id: int,
        select: str = "*, swimmer_external_links(*)"
    ) -> Optional[Dict[str, Any]]:
        """Find swimmer with external links.
        
        Args:
            swimmer_id: Swimmer identifier
            select: Fields to select (includes external links by default)
            
        Returns:
            Swimmer record with external links or None
        """
        return self.find_by_id(swimmer_id, select=select)
    
    def create_with_external_link(
        self,
        swimmer_data: Dict[str, Any],
        external_link_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create swimmer with external link in a transaction.
        
        Args:
            swimmer_data: Swimmer record data
            external_link_data: External link data
            
        Returns:
            Created swimmer record with external link
            
        Raises:
            DatabaseError: If creation fails
        """
        try:
            # Create swimmer
            swimmer = self.create(swimmer_data)
            
            # Create external link
            external_link_data["swimmer_id"] = swimmer["id"]
            external_link_repo = SwimmerExternalLinkRepository(self.db)
            external_link = external_link_repo.create(external_link_data)
            
            # Return swimmer with external link
            swimmer["swimmer_external_links"] = [external_link]
            return swimmer
        except Exception as e:
            raise DatabaseError("Failed to create swimmer with external link") from e


class SwimmerExternalLinkRepository(BaseRepository):
    """Repository for swimmer external link operations."""
    
    def __init__(self, db: Optional[Client] = None):
        super().__init__(Tables.SWIMMER_EXTERNAL_LINKS, db)
    
    def find_by_swimmer_id(self, swimmer_id: int) -> Optional[Dict[str, Any]]:
        """Find external link by swimmer ID.
        
        Args:
            swimmer_id: Swimmer identifier
            
        Returns:
            External link record or None
        """
        links = self.find_all(filters={"swimmer_id": swimmer_id}, limit=1)
        return links[0] if links else None
    
    def find_by_external_id(self, external_id: str) -> Optional[Dict[str, Any]]:
        """Find external link by external athlete ID.
        
        Args:
            external_id: External athlete identifier
            
        Returns:
            External link record or None
        """
        links = self.find_all(filters={"external_athlete_id": external_id}, limit=1)
        return links[0] if links else None
    
    def update_sync_status(
        self,
        link_id: int,
        status: SyncStatus,
        progress: Optional[int] = None,
        total_events: Optional[int] = None,
        error_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update synchronization status.
        
        Args:
            link_id: External link identifier
            status: Sync status
            progress: Current progress (events processed)
            total_events: Total number of events
            error_message: Error message if failed
            
        Returns:
            Updated external link record
        """
        update_data: Dict[str, Any] = {"sync_status": status.value}
        
        if progress is not None:
            update_data["sync_progress"] = progress
        
        if total_events is not None:
            update_data["sync_total_events"] = total_events
        
        if error_message is not None:
            update_data["sync_error_message"] = error_message
        
        if status == SyncStatus.COMPLETED:
            # Update last_synced timestamp
            update_data["sync_error_message"] = None
        
        return self.update(link_id, update_data)
    
    def cancel_sync(self, link_id: int) -> Dict[str, Any]:
        """Cancel an ongoing sync operation.
        
        Args:
            link_id: External link identifier
            
        Returns:
            Updated external link record
        """
        return self.update_sync_status(
            link_id,
            SyncStatus.CANCELLED,
            error_message="Sync cancelled by user"
        )
