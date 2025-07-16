import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from ..models import DayRecord, Summary, PolicyConfig
from .utils import clamp
import logging

logger = logging.getLogger(__name__)

def build_attendance(
    punch_df: pd.DataFrame,
    schedule_df: pd.DataFrame, 
    config: PolicyConfig
) -> Tuple[List[DayRecord], Summary, List[str]]:
    """
    Build attendance analysis from punch and schedule data.
    
    Args:
        punch_df: DataFrame with punch clock data
        schedule_df: DataFrame with schedule data
        config: Policy configuration
        
    Returns:
        - List of DayRecord objects
        - Summary statistics
        - List of warnings
    """
    warnings = []
    day_records = []
    
    tardy_minutes = config.tardy_minutes
    early_minutes = config.early_minutes
    
    # Process each scheduled shift
    for _, sched_row in schedule_df.iterrows():
        shift_date = sched_row['date']
        shift_type = sched_row['shift_type']
        sched_start_dt = sched_row['sched_start_dt']
        sched_end_dt = sched_row['sched_end_dt']
        
        # Calculate scheduled minutes
        sched_minutes = (sched_end_dt - sched_start_dt).total_seconds() / 60
        
        # Find matching punch record for this date
        punch_matches = punch_df[punch_df['date'] == shift_date]
        
        # Initialize default values
        actual_in = None
        actual_out = None
        actual_out1 = None
        actual_in2 = None
        worked_minutes = 0.0
        present = False
        
        if not punch_matches.empty:
            # Use the first (or earliest in1) punch record if multiple exist
            if len(punch_matches) > 1:
                warnings.append(f"Multiple punch records found for {shift_date}, using first one")
            
            punch_row = punch_matches.iloc[0]
            
            actual_in = punch_row['in1']
            actual_out = punch_row['out2']  # Primary out time
            actual_out1 = punch_row['out1']  # Lunch out
            actual_in2 = punch_row['in2']    # Lunch in
            
            present = actual_in is not None
            
            if present and actual_out is not None:
                # Handle cross-midnight schedules for PM shifts
                cross_midnight = sched_end_dt.date() > sched_start_dt.date()
                
                # For cross-midnight PM shifts, if actual_out is before actual_in (same day),
                # it means the out punch was the next day
                if cross_midnight and actual_out.time() < actual_in.time():
                    # Adjust actual_out to next day
                    actual_out = actual_out.replace(
                        year=actual_out.year,
                        month=actual_out.month, 
                        day=actual_out.day
                    ) + timedelta(days=1)
                    logger.debug(f"Adjusted cross-midnight actual_out for {shift_date}: {actual_out}")
                
                # Also handle cross-midnight for lunch times if needed
                if cross_midnight and actual_out1 and actual_in2:
                    if actual_in2.time() < actual_out1.time():
                        actual_in2 = actual_in2 + timedelta(days=1)
                
                # Calculate lunch minutes (time between out1 and in2)
                lunch_minutes = 0.0
                if actual_out1 and actual_in2:
                    lunch_duration = actual_in2 - actual_out1
                    if lunch_duration.total_seconds() > 0:
                        lunch_minutes = lunch_duration.total_seconds() / 60
                    lunch_minutes = max(0.0, lunch_minutes)
                
                # Calculate total worked minutes (total time minus lunch)
                total_duration = actual_out - actual_in
                total_minutes = total_duration.total_seconds() / 60
                worked_minutes = max(0.0, total_minutes - lunch_minutes)
                
                logger.debug(f"Date {shift_date}: total={total_minutes:.1f}min, lunch={lunch_minutes:.1f}min, worked={worked_minutes:.1f}min")
        
        # Calculate tardiness and early dismissal
        tardy = False
        early_dismissal = False
        
        if present:
            # Tardy check: arrived more than tardy_minutes after scheduled start
            if actual_in and actual_in > (sched_start_dt + timedelta(minutes=tardy_minutes)):
                tardy = True
            
            # Early dismissal check: left more than early_minutes before scheduled end
            if actual_out and actual_out < (sched_end_dt - timedelta(minutes=early_minutes)):
                early_dismissal = True
        
        # Clip worked minutes to scheduled minutes
        worked_minutes_clipped = clamp(worked_minutes, 0.0, sched_minutes)
        
        # Calculate attendance fraction
        attendance_fraction = worked_minutes_clipped / sched_minutes if sched_minutes > 0 else 0.0
        
        # Create day record
        day_record = DayRecord(
            date=shift_date,
            shift_type=shift_type,
            sched_start_dt=sched_start_dt,
            sched_end_dt=sched_end_dt,
            actual_in=actual_in,
            actual_out=actual_out,
            actual_out1=actual_out1,
            actual_in2=actual_in2,
            sched_minutes=sched_minutes,
            worked_minutes=worked_minutes,
            worked_minutes_clipped=worked_minutes_clipped,
            attendance_fraction=attendance_fraction,
            present=present,
            tardy=tardy,
            early_dismissal=early_dismissal
        )
        
        day_records.append(day_record)
        
        logger.debug(f"Processed {shift_type} shift on {shift_date}: present={present}, tardy={tardy}, early={early_dismissal}")
    
    # Calculate summary statistics
    summary = calculate_summary(day_records)
    
    logger.info(f"Computed attendance for {len(day_records)} shifts")
    
    return day_records, summary, warnings

def calculate_summary(day_records: List[DayRecord]) -> Summary:
    """Calculate summary statistics from day records"""
    
    if not day_records:
        return Summary(
            scheduled_shifts=0,
            shifts_worked=0,
            attendance_pct_shifts=0.0,
            scheduled_hours=0.0,
            worked_hours=0.0,
            attendance_pct_hours=0.0,
            tardy_count=0,
            early_dismissal_count=0
        )
    
    scheduled_shifts = len(day_records)
    shifts_worked = sum(1 for record in day_records if record.present)
    tardy_count = sum(1 for record in day_records if record.tardy)
    early_dismissal_count = sum(1 for record in day_records if record.early_dismissal)
    
    scheduled_hours = sum(record.sched_minutes for record in day_records) / 60
    worked_hours = sum(record.worked_minutes_clipped for record in day_records) / 60
    
    attendance_pct_shifts = (shifts_worked / scheduled_shifts * 100) if scheduled_shifts > 0 else 0.0
    attendance_pct_hours = (worked_hours / scheduled_hours * 100) if scheduled_hours > 0 else 0.0
    
    return Summary(
        scheduled_shifts=scheduled_shifts,
        shifts_worked=shifts_worked,
        attendance_pct_shifts=round(attendance_pct_shifts, 2),
        scheduled_hours=round(scheduled_hours, 2),
        worked_hours=round(worked_hours, 2),
        attendance_pct_hours=round(attendance_pct_hours, 2),
        tardy_count=tardy_count,
        early_dismissal_count=early_dismissal_count
    )