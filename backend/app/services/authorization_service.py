"""Authorization service for user access control."""
from typing import Dict, Optional, Any
from fastapi import Request
from app.repositories.swimmer import SwimmerRepository
from app.repositories.squad import SquadRepository
from app.domain.exceptions import UnauthorizedError


class AuthorizationService:
    """Service for authorization and access control."""
    
    def __init__(
        self,
        swimmer_repo: Optional[SwimmerRepository] = None,
        squad_repo: Optional[SquadRepository] = None
    ):
        """Initialize authorization service.
        
        Args:
            swimmer_repo: Swimmer repository
            squad_repo: Squad repository
        """
        self.swimmer_repo = swimmer_repo or SwimmerRepository()
        self.squad_repo = squad_repo or SquadRepository()
    
    def get_user_id_from_request(self, request: Request) -> str:
        """Extract user ID from request state.
        
        Args:
            request: FastAPI request object
            
        Returns:
            User identifier
            
        Raises:
            UnauthorizedError: If user not authenticated
        """
        user_id = getattr(request.state, "user_id", None)
        
        if not user_id:
            raise UnauthorizedError("User not authenticated")
        
        return user_id
    
    def verify_swimmer_ownership(
        self,
        swimmer_id: str,
        coach_id: str
    ) -> Dict[str, Any]:
        """Verify coach has access to swimmer through squad membership.
        
        Uses swimmer repository to check if coach has access to the swimmer's squad
        via the coach_squads table.
        
        Args:
            swimmer_id: Swimmer identifier (UUID)
            coach_id: Coach identifier (UUID)
            
        Returns:
            Swimmer record if authorized
            
        Raises:
            UnauthorizedError: If coach doesn't have access
        """
        # Use repository to verify access
        has_access = self.swimmer_repo.verify_coach_access(swimmer_id, coach_id)
        
        if not has_access:
            raise UnauthorizedError(
                f"Coach {coach_id} not authorized to access swimmer {swimmer_id}"
            )
        
        # Get and return the swimmer record
        swimmer = self.swimmer_repo.find_by_id(swimmer_id)
        if not swimmer:
            raise UnauthorizedError(f"Swimmer {swimmer_id} not found")
        
        return swimmer
    
    def verify_squad_ownership(
        self,
        squad_id: str,
        coach_id: str
    ) -> Dict[str, Any]:
        """Verify coach has access to squad via coach_squads.
        
        Args:
            squad_id: Squad identifier (UUID)
            coach_id: Coach identifier (UUID)
            
        Returns:
            Squad record if authorized
            
        Raises:
            UnauthorizedError: If coach doesn't have access
        """
        squad = self.squad_repo.find_by_id(squad_id)
        
        if not squad:
            raise UnauthorizedError(f"Squad {squad_id} not found")
        
        # Check if coach has access via coach_squads table
        from app.infrastructure.database import get_supabase_client
        supabase = get_supabase_client()
        
        coach_squad_response = supabase.table('coach_squads').select('id').eq(
            'coach_id', coach_id
        ).eq('squad_id', squad_id).execute()
        
        if not coach_squad_response.data:
            raise UnauthorizedError(
                f"Coach {coach_id} not authorized to access squad {squad_id}"
            )
        
        return squad
    
    def verify_squad_member_access(
        self,
        squad_id: str,
        swimmer_id: str,
        coach_id: str
    ) -> bool:
        """Verify coach can add/remove swimmer to/from squad.
        
        Args:
            squad_id: Squad identifier (UUID)
            swimmer_id: Swimmer identifier (UUID)
            coach_id: Coach identifier (UUID)
            
        Returns:
            True if authorized
            
        Raises:
            UnauthorizedError: If coach not authorized
        """
        # Verify squad ownership
        self.verify_squad_ownership(squad_id, coach_id)
        
        # Verify swimmer ownership
        self.verify_swimmer_ownership(swimmer_id, coach_id)
        
        return True


def get_current_user_id(request: Request) -> str:
    """Dependency function to get current user ID from request.
    
    Args:
        request: FastAPI request object
        
    Returns:
        User identifier
        
    Raises:
        UnauthorizedError: If user not authenticated
    """
    auth_service = AuthorizationService()
    return auth_service.get_user_id_from_request(request)
