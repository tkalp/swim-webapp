"""Base repository providing common database operations."""
from typing import Dict, List, Optional, Any, TypeVar, Generic, cast
from supabase import Client
from app.infrastructure.database import get_supabase_client
from app.domain.exceptions import DatabaseError, NotFoundError

T = TypeVar('T')


class BaseRepository(Generic[T]):
    """Base repository with common CRUD operations.
    
    Attributes:
        table_name: Name of the database table
        db: Supabase client instance
    """
    
    def __init__(self, table_name: str, db: Optional[Client] = None):
        """Initialize repository.
        
        Args:
            table_name: Database table name
            db: Optional Supabase client (uses shared client if not provided)
        """
        self.table_name = table_name
        self.db = db or get_supabase_client()
    
    def find_by_id(self, id: Any, select: str = "*") -> Optional[Dict[str, Any]]:
        """Find a record by ID.
        
        Args:
            id: Record identifier
            select: Fields to select (default: all)
            
        Returns:
            Record dictionary or None if not found
            
        Raises:
            DatabaseError: If query fails
        """
        try:
            response = self.db.table(self.table_name).select(select).eq("id", id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            raise DatabaseError(f"Failed to find {self.table_name} by ID: {id}") from e

    
    def find_all(
        self,
        select: str = "*",
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Find all records matching criteria.
        
        Args:
            select: Fields to select
            filters: Dictionary of column: value filters
            order_by: Column to order by
            limit: Maximum number of records
            
        Returns:
            List of record dictionaries
            
        Raises:
            DatabaseError: If query fails
        """
        try:
            query = self.db.table(self.table_name).select(select)
            
            if filters:
                for column, value in filters.items():
                    query = query.eq(column, value)
            
            if order_by:
                query = query.order(order_by)
            
            if limit:
                query = query.limit(limit)
            
            response = query.execute()
            return cast(List[Dict[str, Any]], response.data or [])
        except Exception as e:
            raise DatabaseError(f"Failed to find {self.table_name} records") from e
    
    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new record.
        
        Args:
            data: Record data
            
        Returns:
            Created record dictionary
            
        Raises:
            DatabaseError: If insert fails
        """
        try:
            response = self.db.table(self.table_name).insert(data).execute()
            if not response.data:
                raise DatabaseError(f"Failed to create {self.table_name} record")
            return cast(Dict[str, Any], response.data[0])
        except Exception as e:
            raise DatabaseError(f"Failed to create {self.table_name} record") from e
    
    def update(self, id: Any, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update a record by ID.
        
        Args:
            id: Record identifier
            data: Updated fields
            
        Returns:
            Updated record dictionary
            
        Raises:
            NotFoundError: If record not found
            DatabaseError: If update fails
        """
        try:
            response = self.db.table(self.table_name).update(data).eq("id", id).execute()
            if not response.data:
                raise NotFoundError(self.table_name, id)
            return cast(Dict[str, Any], response.data[0])
        except NotFoundError:
            raise
        except Exception as e:
            raise DatabaseError(f"Failed to update {self.table_name} record: {id}") from e
    
    def delete(self, id: Any) -> bool:
        """Delete a record by ID.
        
        Args:
            id: Record identifier
            
        Returns:
            True if deleted successfully
            
        Raises:
            DatabaseError: If delete fails
        """
        try:
            response = self.db.table(self.table_name).delete().eq("id", id).execute()
            return True
        except Exception as e:
            raise DatabaseError(f"Failed to delete {self.table_name} record: {id}") from e
    
    def exists(self, id: Any) -> bool:
        """Check if a record exists.
        
        Args:
            id: Record identifier
            
        Returns:
            True if record exists
        """
        try:
            response = self.db.table(self.table_name).select("id").eq("id", id).execute()
            return bool(response.data)
        except Exception:
            return False
