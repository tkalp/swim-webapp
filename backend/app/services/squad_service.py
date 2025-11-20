"""Squad service for managing training squads and members."""
from typing import Dict, List, Optional, Any
from app.repositories.squad import SquadRepository, SquadMemberRepository
from app.repositories.swimmer import SwimmerRepository
from app.domain.exceptions import NotFoundError, UnauthorizedError, ValidationError


class SquadService:
    """Service for squad-related business logic."""
    
    def __init__(
        self,
        squad_repo: Optional[SquadRepository] = None,
        member_repo: Optional[SquadMemberRepository] = None,
        swimmer_repo: Optional[SwimmerRepository] = None
    ):
        """Initialize squad service.
        
        Args:
            squad_repo: Squad repository
            member_repo: Squad member repository
            swimmer_repo: Swimmer repository
        """
        self.squad_repo = squad_repo or SquadRepository()
        self.member_repo = member_repo or SquadMemberRepository()
        self.swimmer_repo = swimmer_repo or SwimmerRepository()
    
    def get_squads_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all squads for a user.
        
        Args:
            user_id: User identifier
            
        Returns:
            List of squad records
        """
        return self.squad_repo.find_by_user_id(user_id)
    
    def get_squad(
        self,
        squad_id: int,
        user_id: Optional[str] = None,
        include_members: bool = False
    ) -> Dict[str, Any]:
        """Get a squad by ID with optional member details.
        
        Args:
            squad_id: Squad identifier
            user_id: User ID for authorization
            include_members: Whether to include member details
            
        Returns:
            Squad record
            
        Raises:
            NotFoundError: If squad not found
            UnauthorizedError: If user not authorized
        """
        if include_members:
            return self.squad_repo.find_with_members(squad_id, user_id)
        else:
            squad = self.squad_repo.find_by_id(squad_id)
            
            if not squad:
                raise NotFoundError("Squad", squad_id)
            
            # Verify user ownership if user_id provided
            if user_id and squad.get("coach_id") != user_id:
                raise UnauthorizedError(f"User {user_id} not authorized to access squad {squad_id}")
            
            return squad
    
    def create_squad(
        self,
        user_id: str,
        name: str,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new squad.
        
        Args:
            user_id: User identifier
            name: Squad name
            description: Optional description
            
        Returns:
            Created squad record
            
        Raises:
            ValidationError: If validation fails
        """
        if not name or not name.strip():
            raise ValidationError("Squad name is required", field="name")
        
        squad_data = {
            "coach_id": user_id,
            "name": name.strip(),
        }
        
        if description:
            squad_data["description"] = description
        
        return self.squad_repo.create(squad_data)
    
    def update_squad(
        self,
        squad_id: int,
        user_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update squad information.
        
        Args:
            squad_id: Squad identifier
            user_id: User ID for authorization
            name: Optional new name
            description: Optional new description
            
        Returns:
            Updated squad record
            
        Raises:
            NotFoundError: If squad not found
            UnauthorizedError: If user not authorized
        """
        # Verify ownership
        squad = self.get_squad(squad_id, user_id)
        
        update_data: Dict[str, Any] = {}
        
        if name is not None:
            if not name.strip():
                raise ValidationError("Squad name cannot be empty", field="name")
            update_data["name"] = name.strip()
        
        if description is not None:
            update_data["description"] = description
        
        if not update_data:
            return squad
        
        return self.squad_repo.update(squad_id, update_data)
    
    def delete_squad(self, squad_id: int, user_id: str) -> bool:
        """Delete a squad.
        
        Args:
            squad_id: Squad identifier
            user_id: User ID for authorization
            
        Returns:
            True if deleted successfully
            
        Raises:
            NotFoundError: If squad not found
            UnauthorizedError: If user not authorized
        """
        # Verify ownership
        self.get_squad(squad_id, user_id)
        
        return self.squad_repo.delete(squad_id)
    
    def get_squad_members(self, squad_id: int, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all members of a squad.
        
        Args:
            squad_id: Squad identifier
            user_id: User ID for authorization
            
        Returns:
            List of squad member records with swimmer details
        """
        # Verify access
        if user_id:
            self.get_squad(squad_id, user_id)
        
        return self.member_repo.find_by_squad_id(squad_id)
    
    def add_member(
        self,
        squad_id: int,
        swimmer_id: int,
        user_id: str
    ) -> Dict[str, Any]:
        """Add a swimmer to a squad.
        
        Args:
            squad_id: Squad identifier
            swimmer_id: Swimmer identifier
            user_id: User ID for authorization
            
        Returns:
            Created squad member record
            
        Raises:
            NotFoundError: If squad or swimmer not found
            UnauthorizedError: If user not authorized
            ValidationError: If swimmer already in squad
        """
        # Verify squad ownership
        self.get_squad(squad_id, user_id)
        
        # Verify swimmer ownership
        swimmer = self.swimmer_repo.find_by_id(swimmer_id)
        if not swimmer:
            raise NotFoundError("Swimmer", swimmer_id)
        
        if swimmer.get("user_id") != user_id:
            raise UnauthorizedError(f"User {user_id} not authorized to add swimmer {swimmer_id}")
        
        # Add member
        return self.member_repo.add_member(squad_id, swimmer_id)
    
    def remove_member(
        self,
        squad_id: int,
        swimmer_id: int,
        user_id: str
    ) -> bool:
        """Remove a swimmer from a squad.
        
        Args:
            squad_id: Squad identifier
            swimmer_id: Swimmer identifier
            user_id: User ID for authorization
            
        Returns:
            True if removed successfully
            
        Raises:
            NotFoundError: If squad not found
            UnauthorizedError: If user not authorized
        """
        # Verify squad ownership
        self.get_squad(squad_id, user_id)
        
        return self.member_repo.remove_member(squad_id, swimmer_id)
