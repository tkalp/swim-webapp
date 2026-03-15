"""Base repository providing common database operations using SQLAlchemy."""
from typing import Dict, List, Optional, Any, Type, TypeVar
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db import Base
from app.domain.exceptions import DatabaseError, NotFoundError

M = TypeVar('M', bound=Base)


class BaseRepository:
    """Base repository with common async CRUD operations.

    Attributes:
        model: SQLAlchemy model class
        db: AsyncSession instance
    """

    def __init__(self, model: Type[M], db: AsyncSession):
        self.model = model
        self.db = db

    async def find_by_id(self, id: Any) -> Optional[Dict[str, Any]]:
        """Find a record by ID."""
        try:
            result = await self.db.execute(
                select(self.model).where(self.model.id == id)
            )
            row = result.scalar_one_or_none()
            return self._to_dict(row) if row else None
        except Exception as e:
            raise DatabaseError(f"Failed to find {self.model.__tablename__} by ID: {id}") from e

    async def find_all(
        self,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Find all records matching criteria."""
        try:
            query = select(self.model)

            if filters:
                for column, value in filters.items():
                    query = query.where(getattr(self.model, column) == value)

            if order_by:
                # Handle "column.desc" syntax
                if order_by.endswith(".desc"):
                    col_name = order_by[:-5]
                    query = query.order_by(getattr(self.model, col_name).desc())
                else:
                    query = query.order_by(getattr(self.model, order_by))

            if limit:
                query = query.limit(limit)

            result = await self.db.execute(query)
            return [self._to_dict(row) for row in result.scalars().all()]
        except Exception as e:
            raise DatabaseError(f"Failed to find {self.model.__tablename__} records") from e

    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new record."""
        try:
            instance = self.model(**data)
            self.db.add(instance)
            await self.db.flush()
            await self.db.refresh(instance)
            return self._to_dict(instance)
        except Exception as e:
            raise DatabaseError(f"Failed to create {self.model.__tablename__} record") from e

    async def update(self, id: Any, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update a record by ID."""
        try:
            result = await self.db.execute(
                select(self.model).where(self.model.id == id)
            )
            instance = result.scalar_one_or_none()
            if not instance:
                raise NotFoundError(self.model.__tablename__, id)

            for key, value in data.items():
                setattr(instance, key, value)

            await self.db.flush()
            await self.db.refresh(instance)
            return self._to_dict(instance)
        except NotFoundError:
            raise
        except Exception as e:
            raise DatabaseError(f"Failed to update {self.model.__tablename__} record: {id}") from e

    async def delete(self, id: Any) -> bool:
        """Delete a record by ID."""
        try:
            await self.db.execute(
                delete(self.model).where(self.model.id == id)
            )
            await self.db.flush()
            return True
        except Exception as e:
            raise DatabaseError(f"Failed to delete {self.model.__tablename__} record: {id}") from e

    async def exists(self, id: Any) -> bool:
        """Check if a record exists."""
        try:
            result = await self.db.execute(
                select(func.count()).select_from(self.model).where(self.model.id == id)
            )
            return result.scalar_one() > 0
        except Exception:
            return False

    def _to_dict(self, instance: Any) -> Dict[str, Any]:
        """Convert a SQLAlchemy model instance to a dictionary."""
        if instance is None:
            return {}
        d = {}
        for column in instance.__table__.columns:
            value = getattr(instance, column.name)
            # Convert UUID to string for JSON compatibility
            if hasattr(value, 'hex'):
                value = str(value)
            d[column.name] = value
        return d
