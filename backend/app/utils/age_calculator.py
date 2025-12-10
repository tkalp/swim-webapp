"""Age calculation utilities for swimmer performance analysis."""
from datetime import datetime, date
from typing import Union


def calculate_age(date_of_birth: Union[str, date], reference_date: Union[str, date, None] = None) -> float:
    """
    Calculate age at a reference date with decimal precision.
    
    Args:
        date_of_birth: Birth date (string 'YYYY-MM-DD' or date object)
        reference_date: Date to calculate age at (defaults to today)
        
    Returns:
        Age in years with decimal precision (e.g., 14.5 for 14 years 6 months)
    """
    if isinstance(date_of_birth, str):
        dob = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
    else:
        dob = date_of_birth
    
    if reference_date is None:
        ref = date.today()
    elif isinstance(reference_date, str):
        ref = datetime.strptime(reference_date, '%Y-%m-%d').date()
    else:
        ref = reference_date
    
    # Calculate years
    years = ref.year - dob.year
    
    # Adjust if birthday hasn't occurred yet this year
    if (ref.month, ref.day) < (dob.month, dob.day):
        years -= 1
    
    # Calculate fractional year component
    # Days since last birthday / days in year of reference
    last_birthday = date(ref.year if (ref.month, ref.day) >= (dob.month, dob.day) else ref.year - 1, dob.month, dob.day)
    days_since_birthday = (ref - last_birthday).days
    
    # Use 365.25 for average year length
    fractional_year = days_since_birthday / 365.25
    
    return years + fractional_year


def calculate_age_whole_years(date_of_birth: Union[str, date], reference_date: Union[str, date, None] = None) -> int:
    """
    Calculate age in whole years at a reference date.
    
    Args:
        date_of_birth: Birth date (string 'YYYY-MM-DD' or date object)
        reference_date: Date to calculate age at (defaults to today)
        
    Returns:
        Age in whole years
    """
    return int(calculate_age(date_of_birth, reference_date))


def get_age_group(age: float) -> str:
    """
    Get competitive age group for a given age.
    
    Args:
        age: Age in years (decimal)
        
    Returns:
        Age group string (e.g., "13-14", "15-16", "Senior")
    """
    age_int = int(age)
    
    if age_int <= 10:
        return "10 & Under"
    elif age_int <= 12:
        return "11-12"
    elif age_int <= 14:
        return "13-14"
    elif age_int <= 16:
        return "15-16"
    elif age_int <= 18:
        return "17-18"
    else:
        return "Senior"
