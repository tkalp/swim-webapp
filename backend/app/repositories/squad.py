"""Squad repository for managing training squads and memberships."""
from typing import Dict, List, Optional, Any, cast
from supabase import Client
from app.repositories.base import BaseRepository
from app.infrastructure.constants import Tables
from app.domain.exceptions import DatabaseError, NotFoundError


class SquadRepository(BaseRepository):
    """Repository for squad operations."""
    
    def __init__(self, db: Optional[Client] = None):
        super().__init__(Tables.SQUADS, db)
    
    def find_by_user_id(self, user_id: str) -> List[Dict[str, Any]]:
        """Find all squads for a user.
        
        Args:
            user_id: User identifier
            
        Returns:
            List of squad records
        """
        return self.find_all(filters={"coach_id": user_id}, order_by="name")
    
    def find_with_members(
        self,
        squad_id: int,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Find squad with member details.
        
        Args:
            squad_id: Squad identifier
            user_id: Optional user ID to verify ownership
            
        Returns:
            Squad record with members or None
            
        Raises:
            NotFoundError: If squad not found or user not authorized
        """
        try:
            select = """
                *,
                squad_members(
                    *,
                    swimmers(*)
                )
            """
            response = self.db.table(self.table_name).select(select).eq("id", squad_id).execute()
            
            if not response.data:
                raise NotFoundError("Squad", squad_id)
            
            squad = response.data[0]
            
            # Verify user ownership if user_id provided
            if user_id and squad.get("coach_id") != user_id:
                raise NotFoundError("Squad", squad_id)
            
            return cast(Dict[str, Any], squad)
        except NotFoundError:
            raise
        except Exception as e:
            raise DatabaseError(f"Failed to fetch squad {squad_id} with members") from e


class SquadMemberRepository(BaseRepository):
    """Repository for squad member operations."""
    
    def __init__(self, db: Optional[Client] = None):
        super().__init__(Tables.SQUAD_MEMBERS, db)
    
    def find_by_squad_id(self, squad_id: int) -> List[Dict[str, Any]]:
        """Find all members of a squad.
        
        Args:
            squad_id: Squad identifier
            
        Returns:
            List of squad member records with swimmer details
        """
        try:
            response = (
                self.db.table(self.table_name)
                .select("*, swimmers(*)")
                .eq("squad_id", squad_id)
                .execute()
            )
            return cast(List[Dict[str, Any]], response.data or [])
        except Exception as e:
            raise DatabaseError(f"Failed to fetch members for squad {squad_id}") from e
    
    def find_by_swimmer_id(self, swimmer_id: int) -> List[Dict[str, Any]]:
        """Find all squads a swimmer belongs to.
        
        Args:
            swimmer_id: Swimmer identifier
            
        Returns:
            List of squad member records with squad details
        """
        try:
            response = (
                self.db.table(self.table_name)
                .select("*, squads(*)")
                .eq("swimmer_id", swimmer_id)
                .execute()
            )
            return cast(List[Dict[str, Any]], response.data or [])
        except Exception as e:
            raise DatabaseError(f"Failed to fetch squads for swimmer {swimmer_id}") from e
    
    def exists_membership(self, squad_id: int, swimmer_id: int) -> bool:
        """Check if a swimmer is already a member of a squad.
        
        Args:
            squad_id: Squad identifier
            swimmer_id: Swimmer identifier
            
        Returns:
            True if membership exists
        """
        try:
            response = (
                self.db.table(self.table_name)
                .select("id")
                .eq("squad_id", squad_id)
                .eq("swimmer_id", swimmer_id)
                .execute()
            )
            return bool(response.data)
        except Exception:
            return False
    
    def add_member(self, squad_id: int, swimmer_id: int) -> Dict[str, Any]:
        """Add a swimmer to a squad.
        
        Args:
            squad_id: Squad identifier
            swimmer_id: Swimmer identifier
            
        Returns:
            Created squad member record
            
        Raises:
            DatabaseError: If member already exists or creation fails
        """
        if self.exists_membership(squad_id, swimmer_id):
            raise DatabaseError(f"Swimmer {swimmer_id} is already a member of squad {squad_id}")
        
        return self.create({
            "squad_id": squad_id,
            "swimmer_id": swimmer_id
        })
    
    def remove_member(self, squad_id: int, swimmer_id: int) -> bool:
        """Remove a swimmer from a squad.
        
        Args:
            squad_id: Squad identifier
            swimmer_id: Swimmer identifier
            
        Returns:
            True if removed successfully
        """
        try:
            response = (
                self.db.table(self.table_name)
                .delete()
                .eq("squad_id", squad_id)
                .eq("swimmer_id", swimmer_id)
                .execute()
            )
            return True
        except Exception as e:
            raise DatabaseError(f"Failed to remove swimmer {swimmer_id} from squad {squad_id}") from e
