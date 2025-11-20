"""
Database utilities for worker
"""

import os
from supabase import create_client, Client


def get_supabase_client() -> Client:
    """
    Create and return a Supabase client
    
    Returns:
        Configured Supabase client instance
    """
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    
    return create_client(supabase_url, supabase_key)
