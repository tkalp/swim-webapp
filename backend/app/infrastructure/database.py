"""Shared database client for Supabase connections."""
import os
from typing import Optional
from supabase import create_client, Client


class DatabaseClient:
    """Singleton database client for Supabase.
    
    Provides a shared instance to eliminate duplicate client creation
    across routes and services.
    """
    
    _instance: Optional[Client] = None
    
    @classmethod
    def get_client(cls) -> Client:
        """Get or create the Supabase client instance.
        
        Returns:
            Client: Configured Supabase client
            
        Raises:
            ValueError: If required environment variables are missing
        """
        if cls._instance is None:
            url = os.environ.get("SUPABASE_URL")
            key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            
            if not url or not key:
                raise ValueError(
                    "Missing required environment variables: "
                    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
                )
            
            cls._instance = create_client(url, key)
        
        return cls._instance
    
    @classmethod
    def reset(cls) -> None:
        """Reset the client instance (primarily for testing)."""
        cls._instance = None


def get_supabase_client() -> Client:
    """Get the Supabase client instance.
    
    This function provides a convenient way to access the database client
    throughout the application.
    
    Returns:
        Client: Configured Supabase client
    """
    return DatabaseClient.get_client()
