import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Union, Optional, Tuple
import re
from pathlib import Path
from .utils import _try_parse_time_str, combine_date_time
import logging

logger = logging.getLogger(__name__)

def parse_punch_clock(file_path: Union[str, Path], timezone_str: str = "America/New_York") -> Tuple[pd.DataFrame, Optional[str], List[str]]:
    """
    Parse punch clock Excel file containing Daily Hours Report blocks.
    
    Returns:
        - DataFrame with columns: date, employee_name_raw, in1, out1, in2, out2, total_hours_reported
        - Most frequent employee name (canonical)
        - List of warnings
    """
    warnings = []
    
    try:
        # Read Excel file
        df = pd.read_excel(file_path, header=None)
    except Exception as e:
        raise ValueError(f"Failed to read Excel file: {str(e)}")
    
    if df.empty:
        raise ValueError("Excel file is empty")
    
    punch_records = []
    current_date = None
    
    # Scan for Daily Hours Report blocks
    for idx, row in df.iterrows():
        # Convert row to strings and handle NaN
        row_str = [str(cell) if pd.notna(cell) else '' for cell in row]
        row_text = ' '.join(row_str).strip()
        
        # Look for Daily Hours Report header
        if 'Daily Hours Report For:' in row_text:
            # Extract date from this line
            date_match = re.search(r'Daily Hours Report For:\s*(\d{1,2}/\d{1,2}/\d{4})', row_text)
            if date_match:
                try:
                    current_date = datetime.strptime(date_match.group(1), '%m/%d/%Y')
                    logger.debug(f"Found report date: {current_date.date()}")
                except ValueError as e:
                    warnings.append(f"Could not parse date '{date_match.group(1)}': {str(e)}")
                    continue
            else:
                warnings.append(f"Could not extract date from line: {row_text}")
                continue
        
        # Look for header row with column names
        elif current_date and any('Employee Name' in str(cell) for cell in row if pd.notna(cell)):
            # This is the header row, find column positions
            header_positions = {}
            for col_idx, cell in enumerate(row):
                if pd.notna(cell):
                    cell_str = str(cell).strip()
                    if 'Employee Name' in cell_str:
                        header_positions['employee'] = col_idx
                    elif 'IN 1' in cell_str:
                        header_positions['in1'] = col_idx
                    elif 'OUT 1' in cell_str:
                        header_positions['out1'] = col_idx
                    elif 'IN 2' in cell_str:
                        header_positions['in2'] = col_idx
                    elif 'OUT 2' in cell_str:
                        header_positions['out2'] = col_idx
                    elif 'Total' in cell_str:
                        header_positions['total'] = col_idx
            
            # Next row should contain data
            if idx + 1 < len(df):
                data_row = df.iloc[idx + 1]
                
                # Extract employee name
                employee_name = None
                if 'employee' in header_positions:
                    emp_cell = data_row.iloc[header_positions['employee']]
                    if pd.notna(emp_cell):
                        employee_name = str(emp_cell).strip()
                
                if not employee_name:
                    warnings.append(f"No employee name found for date {current_date.date()}")
                    continue
                
                # Extract punch times
                def get_time_from_position(pos_key):
                    if pos_key in header_positions:
                        cell = data_row.iloc[header_positions[pos_key]]
                        if pd.notna(cell) and str(cell).strip():
                            return _try_parse_time_str(str(cell))
                    return None
                
                in1_time = get_time_from_position('in1')
                out1_time = get_time_from_position('out1')  
                in2_time = get_time_from_position('in2')
                out2_time = get_time_from_position('out2')
                
                # Extract total hours
                total_hours = None
                if 'total' in header_positions:
                    total_cell = data_row.iloc[header_positions['total']]
                    if pd.notna(total_cell):
                        try:
                            total_hours = float(total_cell)
                        except (ValueError, TypeError):
                            pass
                
                # Convert times to datetimes (will be adjusted later with shift context)
                in1_dt = combine_date_time(current_date, in1_time, timezone_str) if in1_time else None
                out1_dt = combine_date_time(current_date, out1_time, timezone_str) if out1_time else None
                in2_dt = combine_date_time(current_date, in2_time, timezone_str) if in2_time else None
                out2_dt = combine_date_time(current_date, out2_time, timezone_str) if out2_time else None
                
                punch_records.append({
                    'date': current_date.date(),
                    'employee_name_raw': employee_name,
                    'in1': in1_dt,
                    'out1': out1_dt,
                    'in2': in2_dt,
                    'out2': out2_dt,
                    'total_hours_reported': total_hours
                })
                
                logger.debug(f"Parsed punch record for {employee_name} on {current_date.date()}")
    
    if not punch_records:
        raise ValueError("No punch records found in file")
    
    punch_df = pd.DataFrame(punch_records)
    
    # Determine canonical employee name (most frequent)
    employee_counts = punch_df['employee_name_raw'].value_counts()
    canonical_employee = employee_counts.index[0] if not employee_counts.empty else None
    
    if len(employee_counts) > 1:
        warnings.append(f"Multiple employee names found: {list(employee_counts.index)}. Using most frequent: {canonical_employee}")
    
    logger.info(f"Parsed {len(punch_records)} punch records for employee: {canonical_employee}")
    
    return punch_df, canonical_employee, warnings