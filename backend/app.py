from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json
import uuid
import tempfile
import os
from pathlib import Path
from typing import Optional, List
import logging
import io
import csv

from models import AttendanceResponse, PolicyConfig, ComputeRequest, ErrorResponse
from config import DEFAULT_SHIFT_CONFIG, TEMP_DIR, MAX_FILE_SIZE, ALLOWED_EXTENSIONS
from attendance_core.parse_punch import parse_punch_clock
from attendance_core.parse_schedule import parse_schedule
from attendance_core.compute import build_attendance

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Attendance Summariser API",
    description="Internal tool for processing employee attendance data from Excel files",
    version="1.0.0"
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for processed results (for CSV download)
# In production, this could be replaced with Redis or database
result_storage = {}

def validate_file(file: UploadFile) -> None:
    """Validate uploaded file"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

def parse_config(config_json: Optional[str]) -> PolicyConfig:
    """Parse configuration from JSON string or use defaults"""
    if config_json:
        try:
            config_dict = json.loads(config_json)
            return PolicyConfig(**config_dict)
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid config JSON: {e}. Using defaults.")
        except Exception as e:
            logger.warning(f"Config parsing error: {e}. Using defaults.")
    
    return PolicyConfig(**DEFAULT_SHIFT_CONFIG)

async def process_attendance(
    punch_file: UploadFile,
    schedule_file: UploadFile,
    config: PolicyConfig
) -> AttendanceResponse:
    """Main processing function"""
    warnings = []
    
    # Validate files
    validate_file(punch_file)
    validate_file(schedule_file)
    
    # Create temporary files
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as punch_temp:
        punch_content = await punch_file.read()
        punch_temp.write(punch_content)
        punch_temp_path = punch_temp.name
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as schedule_temp:
        schedule_content = await schedule_file.read()
        schedule_temp.write(schedule_content)
        schedule_temp_path = schedule_temp.name
    
    try:
        # Parse punch clock file
        logger.info(f"Parsing punch file: {punch_file.filename}")
        punch_df, employee_name, punch_warnings = parse_punch_clock(
            punch_temp_path, 
            config.timezone
        )
        warnings.extend(punch_warnings)
        
        # Parse schedule file
        logger.info(f"Parsing schedule file: {schedule_file.filename}")
        schedule_df, schedule_warnings = parse_schedule(
            schedule_temp_path,
            target_employee_name=employee_name,
            am_config=config.am.model_dump(),
            pm_config=config.pm.model_dump(),
            timezone_str=config.timezone
        )
        warnings.extend(schedule_warnings)
        
        # Compute attendance
        logger.info("Computing attendance analysis")
        day_records, summary, compute_warnings = build_attendance(
            punch_df, schedule_df, config
        )
        warnings.extend(compute_warnings)
        
        return AttendanceResponse(
            employee_name=employee_name,
            config_used=config,
            summary=summary,
            day_level=day_records
        )
        
    except Exception as e:
        logger.error(f"Processing error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    
    finally:
        # Clean up temporary files
        try:
            os.unlink(punch_temp_path)
            os.unlink(schedule_temp_path)
        except OSError as e:
            logger.warning(f"Failed to clean up temp files: {e}")

@app.post("/attendance/compute", response_model=AttendanceResponse)
async def compute_attendance(
    punch_file: UploadFile = File(..., description="Punch clock Excel file"),
    schedule_file: UploadFile = File(..., description="Schedule Excel file"),
    config: Optional[str] = Form(None, description="JSON configuration overrides")
):
    """
    Process attendance files and return analysis.
    
    Upload two Excel files and get detailed attendance analysis including:
    - Employee detection from punch data
    - Day-level attendance records  
    - Summary statistics and percentages
    - Tardiness and early dismissal tracking
    """
    
    logger.info(f"Processing attendance request for files: {punch_file.filename}, {schedule_file.filename}")
    
    # Parse configuration
    policy_config = parse_config(config)
    
    # Process files
    result = await process_attendance(punch_file, schedule_file, policy_config)
    
    # Store result for potential CSV download
    job_id = str(uuid.uuid4())
    result_storage[job_id] = result
    
    # Add job_id to response headers for CSV download
    return result

@app.get("/attendance/{job_id}/csv")
async def download_csv(job_id: str):
    """Download attendance analysis as CSV file"""
    
    if job_id not in result_storage:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    
    result = result_storage[job_id]
    
    # Create CSV content
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    headers = [
        'date', 'shift_type', 'sched_start_dt', 'sched_end_dt',
        'actual_in', 'actual_out', 'actual_out1', 'actual_in2',
        'sched_minutes', 'worked_minutes', 'worked_minutes_clipped',
        'attendance_fraction', 'present', 'tardy', 'early_dismissal'
    ]
    writer.writerow(headers)
    
    # Write day records
    for record in result.day_level:
        row = [
            record.date.isoformat(),
            record.shift_type,
            record.sched_start_dt.isoformat() if record.sched_start_dt else '',
            record.sched_end_dt.isoformat() if record.sched_end_dt else '',
            record.actual_in.isoformat() if record.actual_in else '',
            record.actual_out.isoformat() if record.actual_out else '',
            record.actual_out1.isoformat() if record.actual_out1 else '',
            record.actual_in2.isoformat() if record.actual_in2 else '',
            record.sched_minutes,
            record.worked_minutes,
            record.worked_minutes_clipped,
            record.attendance_fraction,
            record.present,
            record.tardy,
            record.early_dismissal
        ]
        writer.writerow(row)
    
    # Write summary section
    writer.writerow([])  # Empty row
    writer.writerow(['__SUMMARY__'])
    writer.writerow(['scheduled_shifts', result.summary.scheduled_shifts])
    writer.writerow(['shifts_worked', result.summary.shifts_worked])
    writer.writerow(['attendance_pct_shifts', result.summary.attendance_pct_shifts])
    writer.writerow(['scheduled_hours', result.summary.scheduled_hours])
    writer.writerow(['worked_hours', result.summary.worked_hours])
    writer.writerow(['attendance_pct_hours', result.summary.attendance_pct_hours])
    writer.writerow(['tardy_count', result.summary.tardy_count])
    writer.writerow(['early_dismissal_count', result.summary.early_dismissal_count])
    
    # Prepare response
    csv_content = output.getvalue()
    output.close()
    
    employee_name = result.employee_name or "unknown"
    filename = f"attendance_{employee_name.replace(' ', '_')}_{job_id[:8]}.csv"
    
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Attendance Summariser API is running"}

@app.get("/")
async def root():
    """API information"""
    return {
        "name": "Attendance Summariser API",
        "version": "1.0.0",
        "description": "Internal tool for processing employee attendance data",
        "endpoints": {
            "compute": "POST /attendance/compute",
            "download": "GET /attendance/{job_id}/csv",
            "health": "GET /health"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)