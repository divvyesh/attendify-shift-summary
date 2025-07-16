import pytest
from datetime import datetime, date, time
import pandas as pd
from models import PolicyConfig, DayRecord
from attendance_core.compute import calculate_summary

def test_calculate_summary_empty():
    """Test summary calculation with empty records"""
    summary = calculate_summary([])
    
    assert summary.scheduled_shifts == 0
    assert summary.shifts_worked == 0
    assert summary.attendance_pct_shifts == 0.0
    assert summary.scheduled_hours == 0.0
    assert summary.worked_hours == 0.0
    assert summary.attendance_pct_hours == 0.0
    assert summary.tardy_count == 0
    assert summary.early_dismissal_count == 0

def test_calculate_summary_with_records():
    """Test summary calculation with sample records"""
    # Create sample day records
    records = [
        DayRecord(
            date=date(2025, 1, 1),
            shift_type="AM",
            sched_start_dt=datetime(2025, 1, 1, 9, 45),
            sched_end_dt=datetime(2025, 1, 1, 16, 30),
            actual_in=datetime(2025, 1, 1, 9, 50),
            actual_out=datetime(2025, 1, 1, 16, 30),
            actual_out1=None,
            actual_in2=None,
            sched_minutes=405.0,  # 6h 45m
            worked_minutes=400.0,
            worked_minutes_clipped=400.0,
            attendance_fraction=0.988,
            present=True,
            tardy=True,  # 5 minutes late
            early_dismissal=False
        ),
        DayRecord(
            date=date(2025, 1, 2),
            shift_type="AM", 
            sched_start_dt=datetime(2025, 1, 2, 9, 45),
            sched_end_dt=datetime(2025, 1, 2, 16, 30),
            actual_in=None,
            actual_out=None,
            actual_out1=None,
            actual_in2=None,
            sched_minutes=405.0,
            worked_minutes=0.0,
            worked_minutes_clipped=0.0,
            attendance_fraction=0.0,
            present=False,
            tardy=False,
            early_dismissal=False
        )
    ]
    
    summary = calculate_summary(records)
    
    assert summary.scheduled_shifts == 2
    assert summary.shifts_worked == 1
    assert summary.attendance_pct_shifts == 50.0
    assert summary.scheduled_hours == 13.5  # 810 minutes / 60
    assert summary.worked_hours == 6.67  # 400 minutes / 60, rounded
    assert summary.tardy_count == 1
    assert summary.early_dismissal_count == 0