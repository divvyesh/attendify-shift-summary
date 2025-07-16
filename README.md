# Attendance Summariser

A comprehensive internal web application for processing employee attendance data from Excel files.

## Overview

The Attendance Summariser automatically processes two types of Excel files per employee:
1. **Punch Clock Data** - Daily Hours Report exports with IN1, OUT1, IN2, OUT2 timestamps
2. **Scheduled Shifts** - Month grid exports with AM/PM shift schedules

The application automatically detects employee names, parses schedules, aligns day-level records, and computes detailed attendance metrics including tardiness and early dismissal tracking.

## Features

### 📊 Comprehensive Analysis
- **Attendance Percentages** - Both shift-based and hour-based calculations
- **Tardiness Tracking** - Configurable threshold for late arrivals
- **Early Dismissal Detection** - Configurable threshold for early departures
- **Day-Level Details** - Complete breakdown of each scheduled shift

### 🎯 Smart Processing
- **Automatic Employee Detection** - Extracts employee names from punch data
- **Cross-Midnight Shift Support** - Handles overnight shifts correctly
- **Lunch Break Calculation** - Accounts for OUT1/IN2 lunch punches
- **Worked Hours Clipping** - Limits worked hours to scheduled maximums

### ⚙️ Configurable Policies
- **Flexible Shift Times** - Customize AM/PM start and end times
- **Adjustable Thresholds** - Configure tardiness and early dismissal limits
- **Timezone Support** - Multiple timezone options for accurate calculations

### 📱 Modern Interface
- **Drag & Drop Upload** - Easy file upload with progress tracking
- **Interactive Tables** - Filter and search day-level records
- **Summary Cards** - Key metrics at a glance
- **CSV Export** - Download detailed analysis results

## Technology Stack

### Backend
- **FastAPI** - High-performance Python web framework
- **Pandas** - Data processing and analysis
- **OpenPyXL** - Excel file parsing
- **Pydantic** - Data validation and serialization

### Frontend
- **React 18** - Modern UI framework
- **TypeScript** - Type safety and development experience
- **Tailwind CSS** - Utility-first styling
- **Shadcn/UI** - Beautiful, accessible components
- **React Dropzone** - File upload handling

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- pip package manager

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup
```bash
npm install
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## File Format Requirements

### Punch Clock File
- Must contain repeated "Daily Hours Report For: mm/dd/yyyy" blocks
- Header row with columns: "Employee Name", "IN 1", "OUT 1", "IN 2", "OUT 2", "Total"
- Data rows with employee names like "LAST, FIRST" and time stamps
- Supports various time formats: "3:56PM", "12:17AM", "16:00:00"

### Schedule File
- Month grid format with date headers like "Thu\n5/1/25"
- AM/PM shift indicators in column 3 (0-based index)
- Blank cells indicate no shift scheduled
- Optional time overrides in format "16:00:00"

## Usage

1. **Upload Files** - Drag and drop or select your punch clock and schedule Excel files
2. **Configure Settings** - Adjust shift times, thresholds, and timezone as needed
3. **Process Data** - Click "Process Attendance Files" to analyze the data
4. **Review Results** - View summary metrics and detailed day-level records
5. **Export Data** - Download complete analysis as CSV file

## API Endpoints

- `POST /attendance/compute` - Process attendance files and return analysis
- `GET /attendance/{job_id}/csv` - Download analysis results as CSV
- `GET /health` - Health check endpoint
- `GET /` - API information and documentation

## Configuration Options

### Shift Policies
- **AM Shift** - Default: 09:45 - 16:30 (same day)
- **PM Shift** - Default: 16:00 - 00:15 (crosses midnight)
- **Cross-Midnight Support** - Automatic handling for overnight shifts

### Attendance Thresholds
- **Tardiness** - Default: 5 minutes after scheduled start
- **Early Dismissal** - Default: 15 minutes before scheduled end
- **Timezone** - Configurable for accurate time calculations

## Data Processing Logic

### Attendance Calculation
1. Parse punch clock file to extract daily time records
2. Parse schedule file to determine planned shifts
3. Match punch records to scheduled shifts by date
4. Calculate worked minutes excluding lunch breaks
5. Apply tardiness and early dismissal rules
6. Compute attendance percentages and summary statistics

### Key Metrics
- **Scheduled vs Worked Shifts** - Count and percentage
- **Scheduled vs Worked Hours** - Total hours and percentage
- **Tardiness Count** - Late arrivals exceeding threshold
- **Early Dismissal Count** - Early departures exceeding threshold

## Development

### Project Structure
```
attendance-summariser/
├── backend/
│   ├── app.py                 # FastAPI application
│   ├── models.py              # Pydantic data models
│   ├── config.py              # Application configuration
│   ├── attendance_core/       # Core processing logic
│   │   ├── parse_punch.py     # Punch clock file parser
│   │   ├── parse_schedule.py  # Schedule file parser
│   │   ├── compute.py         # Attendance calculations
│   │   └── utils.py           # Utility functions
│   ├── tests/                 # Unit tests
│   └── sample_data/           # Sample Excel files
└── src/
    ├── components/            # React components
    ├── pages/                 # Application pages
    └── lib/                   # Utilities and configuration
```

### Testing
```bash
# Backend tests
cd backend
pytest

# Frontend tests
npm test
```

## Deployment

The application can be deployed using Docker, cloud platforms, or traditional server hosting. See deployment documentation for specific instructions.

## Support

For questions, issues, or feature requests, please refer to the project documentation or contact the development team.

---

Built with ❤️ for efficient attendance management.