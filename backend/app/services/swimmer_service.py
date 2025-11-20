"""Swimmer service layer for business logic."""
from typing import Dict, List, Optional, Any
from app.repositories.swimmer import SwimmerRepository, SwimmerExternalLinkRepository
from app.infrastructure.constants import SyncStatus
from app.domain.exceptions import NotFoundError, UnauthorizedError, ValidationError


class SwimmerService:
    """Service for swimmer-related business logic."""
    
    def __init__(
        self,
        swimmer_repo: Optional[SwimmerRepository] = None,
        external_link_repo: Optional[SwimmerExternalLinkRepository] = None
    ):
        """Initialize swimmer service.
        
        Args:
            swimmer_repo: Swimmer repository (creates new if not provided)
            external_link_repo: External link repository (creates new if not provided)
        """
        self.swimmer_repo = swimmer_repo or SwimmerRepository()
        self.external_link_repo = external_link_repo or SwimmerExternalLinkRepository()
    
    def get_swimmers_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all swimmers for a user.
        
        Args:
            user_id: User identifier
            
        Returns:
            List of swimmer records
        """
        return self.swimmer_repo.find_by_user_id(user_id)
    
    def get_swimmer(
        self,
        swimmer_id: int,
        user_id: Optional[str] = None,
        include_external_link: bool = False
    ) -> Dict[str, Any]:
        """Get a swimmer by ID with authorization check.
        
        Args:
            swimmer_id: Swimmer identifier
            user_id: User ID for authorization
            include_external_link: Whether to include external link data
            
        Returns:
            Swimmer record
            
        Raises:
            NotFoundError: If swimmer not found
            UnauthorizedError: If user not authorized
        """
        select = "*, swimmer_external_links(*)" if include_external_link else "*"
        swimmer = self.swimmer_repo.find_by_id(swimmer_id, select=select)
        
        if not swimmer:
            raise NotFoundError("Swimmer", swimmer_id)
        
        # Verify user ownership if user_id provided
        if user_id and swimmer.get("user_id") != user_id:
            raise UnauthorizedError(f"User {user_id} not authorized to access swimmer {swimmer_id}")
        
        return swimmer
    
    def create_swimmer(
        self,
        user_id: str,
        name: str,
        email: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new swimmer.
        
        Args:
            user_id: User identifier
            name: Swimmer name
            email: Optional email address
            
        Returns:
            Created swimmer record
            
        Raises:
            ValidationError: If validation fails
        """
        if not name or not name.strip():
            raise ValidationError("Swimmer name is required", field="name")
        
        swimmer_data = {
            "user_id": user_id,
            "name": name.strip(),
        }
        
        if email:
            swimmer_data["email"] = email
        
        return self.swimmer_repo.create(swimmer_data)
    
    def create_swimmer_with_external_link(
        self,
        user_id: str,
        name: str,
        external_athlete_id: str,
        external_athlete_name: str,
        email: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create swimmer with external link to SwimRankings.
        
        Args:
            user_id: User identifier
            name: Swimmer name
            external_athlete_id: External athlete ID from SwimRankings
            external_athlete_name: External athlete name
            email: Optional email address
            
        Returns:
            Created swimmer with external link
            
        Raises:
            ValidationError: If validation fails
        """
        if not name or not name.strip():
            raise ValidationError("Swimmer name is required", field="name")
        
        if not external_athlete_id or not external_athlete_id.strip():
            raise ValidationError("External athlete ID is required", field="external_athlete_id")
        
        # Check if external athlete already linked
        existing_link = self.external_link_repo.find_by_external_id(external_athlete_id)
        if existing_link:
            raise ValidationError(
                f"Athlete {external_athlete_name} is already linked to another swimmer",
                field="external_athlete_id"
            )
        
        swimmer_data = {
            "user_id": user_id,
            "name": name.strip(),
        }
        
        if email:
            swimmer_data["email"] = email
        
        external_link_data = {
            "external_athlete_id": external_athlete_id.strip(),
            "external_athlete_name": external_athlete_name.strip(),
            "sync_status": SyncStatus.PENDING.value
        }
        
        return self.swimmer_repo.create_with_external_link(swimmer_data, external_link_data)
    
    def update_swimmer(
        self,
        swimmer_id: int,
        user_id: str,
        name: Optional[str] = None,
        email: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update swimmer information.
        
        Args:
            swimmer_id: Swimmer identifier
            user_id: User ID for authorization
            name: Optional new name
            email: Optional new email
            
        Returns:
            Updated swimmer record
            
        Raises:
            NotFoundError: If swimmer not found
            UnauthorizedError: If user not authorized
        """
        # Verify ownership
        swimmer = self.get_swimmer(swimmer_id, user_id)
        
        update_data: Dict[str, Any] = {}
        
        if name is not None:
            if not name.strip():
                raise ValidationError("Swimmer name cannot be empty", field="name")
            update_data["name"] = name.strip()
        
        if email is not None:
            update_data["email"] = email
        
        if not update_data:
            return swimmer
        
        return self.swimmer_repo.update(swimmer_id, update_data)
    
    def delete_swimmer(self, swimmer_id: int, user_id: str) -> bool:
        """Delete a swimmer.
        
        Args:
            swimmer_id: Swimmer identifier
            user_id: User ID for authorization
            
        Returns:
            True if deleted successfully
            
        Raises:
            NotFoundError: If swimmer not found
            UnauthorizedError: If user not authorized
        """
        # Verify ownership
        self.get_swimmer(swimmer_id, user_id)
        
        return self.swimmer_repo.delete(swimmer_id)
    
    def update_sync_status(
        self,
        swimmer_id: int,
        status: SyncStatus,
        progress: Optional[int] = None,
        total_events: Optional[int] = None,
        error_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update synchronization status for a swimmer's external link.
        
        Args:
            swimmer_id: Swimmer identifier
            status: Sync status
            progress: Current progress
            total_events: Total number of events
            error_message: Error message if failed
            
        Returns:
            Updated external link record
            
        Raises:
            NotFoundError: If external link not found
        """
        external_link = self.external_link_repo.find_by_swimmer_id(swimmer_id)
        
        if not external_link:
            raise NotFoundError("External link for swimmer", swimmer_id)
        
        return self.external_link_repo.update_sync_status(
            external_link["id"],
            status,
            progress,
            total_events,
            error_message
        )
    
    def cancel_sync(self, swimmer_id: int, user_id: str) -> Dict[str, Any]:
        """Cancel ongoing sync for a swimmer.
        
        Args:
            swimmer_id: Swimmer identifier
            user_id: User ID for authorization
            
        Returns:
            Updated external link record
            
        Raises:
            NotFoundError: If swimmer or external link not found
            UnauthorizedError: If user not authorized
        """
        # Verify ownership
        self.get_swimmer(swimmer_id, user_id)
        
        external_link = self.external_link_repo.find_by_swimmer_id(swimmer_id)
        
        if not external_link:
            raise NotFoundError("External link for swimmer", swimmer_id)
        
        return self.external_link_repo.cancel_sync(external_link["id"])
