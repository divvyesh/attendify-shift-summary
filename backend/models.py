from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime, date
import json

class ShiftConfig(BaseModel):
    start: str = Field(..., description="Shift start time in HH:MM format")
    end: str = Field(..., description="Shift end time in HH:MM format") 
    cross_midnight: bool = Field(False, description="Whether shift crosses midnight")

class PolicyConfig(BaseModel):
    am: ShiftConfig = Field(default_factory=lambda: ShiftConfig(start="09:45", end="16:30", cross_midnight=False))
    pm: ShiftConfig = Field(default_factory=lambda: ShiftConfig(start="16:00", end="00:15", cross_midnight=True))
    tardy_minutes: int = Field(5, description="Minutes late before considered tardy")
    early_minutes: int = Field(15, description="Minutes early departure before considered early dismissal") 
    timezone: str = Field("America/New_York", description="Timezone for time calculations")

class DayRecord(BaseModel):
    date: date
    shift_type: Literal["AM", "PM"]
    sched_start_dt: datetime
    sched_end_dt: datetime
    actual_in: Optional[datetime] = None
    actual_out: Optional[datetime] = None
    actual_out1: Optional[datetime] = None
    actual_in2: Optional[datetime] = None
    sched_minutes: float
    worked_minutes: float
    worked_minutes_clipped: float
    attendance_fraction: float
    present: bool
    tardy: bool
    early_dismissal: bool

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            date: lambda v: v.isoformat() if v else None
        }

class Summary(BaseModel):
    scheduled_shifts: int
    shifts_worked: int  
    attendance_pct_shifts: float = Field(..., description="Percentage of shifts worked")
    scheduled_hours: float
    worked_hours: float
    attendance_pct_hours: float = Field(..., description="Percentage of hours worked")
    tardy_count: int
    early_dismissal_count: int

class AttendanceResponse(BaseModel):
    employee_name: Optional[str]
    config_used: PolicyConfig
    summary: Summary
    day_level: List[DayRecord]

class ComputeRequest(BaseModel):
    config: Optional[PolicyConfig] = None

class ErrorResponse(BaseModel):
    error: str
    details: Optional[str] = None
    warnings: Optional[List[str]] = None