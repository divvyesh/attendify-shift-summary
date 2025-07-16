# Sample Data Files

This directory contains sample Excel files for testing the Attendance Summariser.

## Files

- `punch_sample.xlsx` - Sample punch clock data with Daily Hours Report format
- `schedule_sample.xlsx` - Sample schedule data with month grid format

## Format Requirements

### Punch Clock File
- Must contain "Daily Hours Report For: mm/dd/yyyy" headers
- Must have column headers including "Employee Name", "IN 1", "OUT 1", "IN 2", "OUT 2", "Total"
- Data rows contain employee names and time punches

### Schedule File  
- Month grid format with date headers like "Thu\n5/1/25"
- AM/PM shift rows identified by text in column 3 (index 3)
- Blank cells indicate no shift scheduled
- Time overrides can be specified as "HH:MM:SS" in shift cells

Place your test files here to use with the API.