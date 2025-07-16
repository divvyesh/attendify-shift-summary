import re
from datetime import datetime, time
from typing import Optional, Union
import pandas as pd
import pytz

def _try_parse_time_str(time_str: str) -> Optional[time]:
    """
    Parse time string in various formats like '3:56PM', '12:17AM', '16:00:00'
    Returns time object or None if parsing fails
    """
    if not time_str or pd.isna(time_str):
        return None
    
    time_str = str(time_str).strip()
    if not time_str:
        return None
        
    # Try multiple time formats
    time_formats = [
        '%I:%M%p',      # 3:56PM
        '%I:%M %p',     # 3:56 PM  
        '%H:%M:%S',     # 16:00:00
        '%H:%M',        # 16:00
        '%I:%M:%S%p',   # 3:56:30PM
        '%I:%M:%S %p'   # 3:56:30 PM
    ]
    
    for fmt in time_formats:
        try:
            parsed = datetime.strptime(time_str, fmt).time()
            return parsed
        except ValueError:
            continue
    
    # Try regex for flexible parsing
    # Match patterns like 3:56PM, 12:17AM
    am_pm_pattern = r'^(\d{1,2}):(\d{2})\s*(AM|PM)$'
    match = re.match(am_pm_pattern, time_str.upper())
    if match:
        hour, minute, ampm = match.groups()
        hour = int(hour)
        minute = int(minute)
        
        if ampm == 'PM' and hour != 12:
            hour += 12
        elif ampm == 'AM' and hour == 12:
            hour = 0
            
        return time(hour, minute)
    
    # Match 24-hour format
    hour_pattern = r'^(\d{1,2}):(\d{2})(?::(\d{2}))?$'
    match = re.match(hour_pattern, time_str)
    if match:
        hour, minute, second = match.groups()
        hour = int(hour)
        minute = int(minute)
        second = int(second) if second else 0
        
        if 0 <= hour <= 23 and 0 <= minute <= 59 and 0 <= second <= 59:
            return time(hour, minute, second)
    
    return None

def _parse_header_date_str(date_str: str) -> Optional[datetime]:
    """
    Parse date strings from schedule headers like 'Thu\n5/1/25'
    Returns datetime object or None if parsing fails
    """
    if not date_str or pd.isna(date_str):
        return None
        
    date_str = str(date_str).strip()
    if not date_str:
        return None
    
    # Remove day names and newlines
    # Pattern: Thu\n5/1/25 or similar
    lines = date_str.split('\n')
    if len(lines) > 1:
        date_part = lines[-1].strip()  # Take the last line as date
    else:
        date_part = date_str
    
    # Remove day names if present
    day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
                 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    
    for day in day_names:
        date_part = re.sub(rf'\b{day}\b', '', date_part, flags=re.IGNORECASE).strip()
    
    # Try different date formats
    date_formats = [
        '%m/%d/%y',     # 5/1/25
        '%m/%d/%Y',     # 5/1/2025
        '%m-%d-%y',     # 5-1-25
        '%m-%d-%Y',     # 5-1-2025
        '%Y-%m-%d',     # 2025-05-01
        '%d/%m/%y',     # 1/5/25 (if needed)
        '%d/%m/%Y'      # 1/5/2025 (if needed)
    ]
    
    for fmt in date_formats:
        try:
            return datetime.strptime(date_part, fmt)
        except ValueError:
            continue
    
    return None

def combine_date_time(date_obj: datetime, time_obj: Optional[time], timezone_str: str = "America/New_York") -> Optional[datetime]:
    """
    Combine date and time objects into timezone-aware datetime
    """
    if not time_obj:
        return None
        
    tz = pytz.timezone(timezone_str)
    combined = datetime.combine(date_obj.date(), time_obj)
    return tz.localize(combined)

def parse_shift_time(time_str: str) -> time:
    """
    Parse shift time string (HH:MM format) into time object
    """
    try:
        return datetime.strptime(time_str, '%H:%M').time()
    except ValueError:
        raise ValueError(f"Invalid time format: {time_str}. Expected HH:MM format.")

def clamp(value: float, min_val: float, max_val: float) -> float:
    """Clamp value between min and max"""
    return max(min_val, min(value, max_val))