import pandas as pd
from datetime import datetime, timedelta, time
from typing import List, Dict, Any, Union, Optional, Tuple
import re
from pathlib import Path
from .utils import _parse_header_date_str, parse_shift_time, combine_date_time
import logging

logger = logging.getLogger(__name__)

def parse_schedule(
    file_path: Union[str, Path], 
    target_employee_name: Optional[str] = None,
    am_config: Dict[str, Any] = None,
    pm_config: Dict[str, Any] = None,
    timezone_str: str = "America/New_York"
) -> Tuple[pd.DataFrame, List[str]]:
    """
    Parse schedule Excel file with month grid format.
    
    Args:
        file_path: Path to Excel file
        target_employee_name: Employee name to filter schedules (optional)
        am_config: AM shift configuration dict with start, end, cross_midnight
        pm_config: PM shift configuration dict with start, end, cross_midnight
        timezone_str: Timezone string
        
    Returns:
        - DataFrame with columns: date, shift_type, sched_start_dt, sched_end_dt
        - List of warnings
    """
    warnings = []
    
    # Default shift configurations
    if am_config is None:
        am_config = {"start": "09:45", "end": "16:30", "cross_midnight": False}
    if pm_config is None:
        pm_config = {"start": "16:00", "end": "00:15", "cross_midnight": True}
    
    try:
        # Read Excel file
        df = pd.read_excel(file_path, header=None)
    except Exception as e:
        raise ValueError(f"Failed to read Excel file: {str(e)}")
    
    if df.empty:
        raise ValueError("Excel file is empty")
    
    # Find header row with dates
    header_row_idx = None
    date_columns = {}
    
    for idx, row in df.iterrows():
        date_count = 0
        temp_date_cols = {}
        
        for col_idx, cell in enumerate(row):
            if pd.notna(cell):
                cell_str = str(cell).strip()
                parsed_date = _parse_header_date_str(cell_str)
                if parsed_date:
                    temp_date_cols[col_idx] = parsed_date
                    date_count += 1
        
        # If we found multiple dates in this row, it's likely the header
        if date_count >= 3:  # Arbitrary threshold
            header_row_idx = idx
            date_columns = temp_date_cols
            break
    
    if header_row_idx is None:
        raise ValueError("Schedule date header row not detected")
    
    logger.info(f"Found header row at index {header_row_idx} with {len(date_columns)} date columns")
    
    schedule_records = []
    
    # Parse shift rows (AM and PM)
    for idx in range(header_row_idx + 1, len(df)):
        row = df.iloc[idx]
        
        # Check if this row contains shift type indicator
        shift_type = None
        
        # Look in column 3 (0-based index 3) for AM/PM indicator
        if len(row) > 3 and pd.notna(row.iloc[3]):
            cell_str = str(row.iloc[3]).strip().upper()
            if 'AM' in cell_str:
                shift_type = 'AM'
            elif 'PM' in cell_str:
                shift_type = 'PM'
        
        if not shift_type:
            continue
        
        logger.debug(f"Processing {shift_type} shift row at index {idx}")
        
        # Get shift configuration
        shift_config = am_config if shift_type == 'AM' else pm_config
        default_start = parse_shift_time(shift_config['start'])
        default_end = parse_shift_time(shift_config['end'])
        cross_midnight = shift_config['cross_midnight']
        
        # Process each date column
        for col_idx, schedule_date in date_columns.items():
            if col_idx < len(row):
                cell = row.iloc[col_idx]
                
                if pd.notna(cell) and str(cell).strip():
                    cell_str = str(cell).strip()
                    
                    # Check if cell contains explicit time (e.g., "16:00:00")
                    explicit_start = None
                    time_pattern = r'\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b'
                    time_match = re.search(time_pattern, cell_str)
                    
                    if time_match:
                        hour = int(time_match.group(1))
                        minute = int(time_match.group(2))
                        explicit_start = time(hour, minute)
                    
                    # Use explicit time or default
                    shift_start_time = explicit_start if explicit_start else default_start
                    shift_end_time = default_end
                    
                    # Create start datetime
                    sched_start_dt = combine_date_time(schedule_date, shift_start_time, timezone_str)
                    
                    # Create end datetime (may cross midnight)
                    if cross_midnight:
                        end_date = schedule_date + timedelta(days=1)
                        sched_end_dt = combine_date_time(end_date, shift_end_time, timezone_str)
                    else:
                        sched_end_dt = combine_date_time(schedule_date, shift_end_time, timezone_str)
                    
                    schedule_records.append({
                        'date': schedule_date.date(),
                        'shift_type': shift_type,
                        'sched_start_dt': sched_start_dt,
                        'sched_end_dt': sched_end_dt
                    })
                    
                    logger.debug(f"Added {shift_type} shift for {schedule_date.date()}: {sched_start_dt} to {sched_end_dt}")
    
    if not schedule_records:
        raise ValueError("No schedule records found in file")
    
    schedule_df = pd.DataFrame(schedule_records)
    
    # Sort by date and shift type
    schedule_df = schedule_df.sort_values(['date', 'shift_type'])
    
    logger.info(f"Parsed {len(schedule_records)} schedule records")
    
    return schedule_df, warnings