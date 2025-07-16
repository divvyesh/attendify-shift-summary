import * as XLSX from 'xlsx';

interface PunchRecord {
  date: string;
  employee_name_raw: string;
  in1: Date | null;
  out1: Date | null;
  in2: Date | null;
  out2: Date | null;
  total_hours_reported: number | null;
}

interface ScheduleRecord {
  date: string;
  shift_type: 'AM' | 'PM';
  sched_start_dt: Date;
  sched_end_dt: Date;
}

interface DayRecord {
  date: string;
  shift_type: 'AM' | 'PM';
  sched_start_dt: string;
  sched_end_dt: string;
  actual_in: string | null;
  actual_out: string | null;
  actual_out1: string | null;
  actual_in2: string | null;
  sched_minutes: number;
  worked_minutes: number;
  worked_minutes_clipped: number;
  attendance_fraction: number;
  present: boolean;
  tardy: boolean;
  early_dismissal: boolean;
}

interface AttendanceSummary {
  scheduled_shifts: number;
  shifts_worked: number;
  attendance_pct_shifts: number;
  scheduled_hours: number;
  worked_hours: number;
  attendance_pct_hours: number;
  tardy_count: number;
  early_dismissal_count: number;
}

interface AttendanceResult {
  employee_name: string;
  summary: AttendanceSummary;
  day_level: DayRecord[];
  warnings: string[];
}

// Parse time string in various formats
function parseTimeString(timeStr: string): Date | null {
  if (!timeStr || timeStr.trim() === '') return null;
  
  timeStr = timeStr.trim();
  
  // Try AM/PM format first (3:56PM, 12:17AM)
  const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let [, hourStr, minuteStr, ampm] = ampmMatch;
    let hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);
    
    if (ampm.toUpperCase() === 'PM' && hour !== 12) {
      hour += 12;
    } else if (ampm.toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }
    
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  }
  
  // Try 24-hour format (16:00:00, 16:00)
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const [, hourStr, minuteStr, secondStr] = timeMatch;
    const hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);
    const second = secondStr ? parseInt(secondStr) : 0;
    
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      const date = new Date();
      date.setHours(hour, minute, second, 0);
      return date;
    }
  }
  
  return null;
}

// Parse date string from schedule headers
function parseHeaderDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Handle newlines (Thu\n5/1/25)
  const lines = dateStr.split('\n');
  const datePart = lines[lines.length - 1].trim();
  
  // Remove day names
  const cleanDate = datePart.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi, '').trim();
  
  // Try different date formats
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,     // 5/1/25
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,     // 5/1/2025
  ];
  
  for (const format of formats) {
    const match = cleanDate.match(format);
    if (match) {
      const [, monthStr, dayStr, yearStr] = match;
      let year = parseInt(yearStr);
      if (year < 100) year += 2000; // Convert 25 to 2025
      
      const month = parseInt(monthStr) - 1; // JavaScript months are 0-based
      const day = parseInt(dayStr);
      
      return new Date(year, month, day);
    }
  }
  
  return null;
}

// Combine date and time
function combineDateTime(date: Date, time: Date | null): Date | null {
  if (!time) return null;
  
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
  return combined;
}

// Parse punch clock file
function parsePunchFile(file: ArrayBuffer): { records: PunchRecord[], employee: string, warnings: string[] } {
  const workbook = XLSX.read(file, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  const records: PunchRecord[] = [];
  const warnings: string[] = [];
  let currentDate: Date | null = null;
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i] as any[];
    const rowText = row.join(' ').trim();
    
    // Look for Daily Hours Report header
    const dateMatch = rowText.match(/Daily Hours Report For:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateMatch) {
      const [month, day, year] = dateMatch[1].split('/').map(Number);
      currentDate = new Date(year, month - 1, day);
      continue;
    }
    
    // Look for header row with column names
    if (currentDate && row.some(cell => String(cell).includes('Employee Name'))) {
      const headerPositions: { [key: string]: number } = {};
      
      row.forEach((cell, idx) => {
        const cellStr = String(cell).trim();
        if (cellStr.includes('Employee Name')) headerPositions.employee = idx;
        else if (cellStr.includes('IN 1')) headerPositions.in1 = idx;
        else if (cellStr.includes('OUT 1')) headerPositions.out1 = idx;
        else if (cellStr.includes('IN 2')) headerPositions.in2 = idx;
        else if (cellStr.includes('OUT 2')) headerPositions.out2 = idx;
        else if (cellStr.includes('Total')) headerPositions.total = idx;
      });
      
      // Next row should contain data
      if (i + 1 < data.length) {
        const dataRow = data[i + 1] as any[];
        
        const employeeName = headerPositions.employee !== undefined ? 
          String(dataRow[headerPositions.employee] || '').trim() : '';
        
        if (employeeName) {
          const getTime = (pos: string) => {
            const idx = headerPositions[pos];
            return idx !== undefined ? parseTimeString(String(dataRow[idx] || '')) : null;
          };
          
          const in1 = getTime('in1');
          const out1 = getTime('out1');
          const in2 = getTime('in2');
          const out2 = getTime('out2');
          
          // Handle cross-midnight for out times
          let finalOut2 = out2;
          if (finalOut2 && in1 && finalOut2.getTime() < in1.getTime()) {
            finalOut2 = new Date(finalOut2.getTime() + 24 * 60 * 60 * 1000);
          }
          
          records.push({
            date: currentDate.toISOString().split('T')[0],
            employee_name_raw: employeeName,
            in1: combineDateTime(currentDate, in1),
            out1: combineDateTime(currentDate, out1),
            in2: combineDateTime(currentDate, in2),
            out2: combineDateTime(currentDate, finalOut2),
            total_hours_reported: headerPositions.total !== undefined ? 
              parseFloat(String(dataRow[headerPositions.total] || '0')) || null : null
          });
        }
      }
    }
  }
  
  if (records.length === 0) {
    throw new Error('No punch records found in file');
  }
  
  // Find most frequent employee name
  const employeeCounts: { [name: string]: number } = {};
  records.forEach(record => {
    employeeCounts[record.employee_name_raw] = (employeeCounts[record.employee_name_raw] || 0) + 1;
  });
  
  const employee = Object.keys(employeeCounts).reduce((a, b) => 
    employeeCounts[a] > employeeCounts[b] ? a : b
  );
  
  return { records, employee, warnings };
}

// Parse schedule file
function parseScheduleFile(file: ArrayBuffer): { records: ScheduleRecord[], warnings: string[] } {
  const workbook = XLSX.read(file, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  const records: ScheduleRecord[] = [];
  const warnings: string[] = [];
  
  console.log('Schedule file data preview:', data.slice(0, 10));
  console.log('Total rows in schedule file:', data.length);
  
  // Find header row with dates - be more flexible
  let headerRowIdx = -1;
  const dateColumns: { [col: number]: Date } = {};
  
  for (let i = 0; i < Math.min(data.length, 20); i++) { // Check first 20 rows
    const row = data[i] as any[];
    let dateCount = 0;
    const tempDateCols: { [col: number]: Date } = {};
    
    console.log(`Row ${i}:`, row);
    
    row.forEach((cell, colIdx) => {
      const cellStr = String(cell).trim();
      
      // Try multiple date detection patterns
      if (cellStr) {
        let parsedDate = parseHeaderDate(cellStr);
        
        // Also try direct date parsing for common formats
        if (!parsedDate) {
          // Try parsing Excel date numbers
          if (typeof cell === 'number' && cell > 40000 && cell < 50000) {
            parsedDate = new Date((cell - 25569) * 86400 * 1000);
          }
          
          // Try other common date formats
          if (!parsedDate && cellStr.match(/\d+\/\d+/)) {
            parsedDate = parseHeaderDate(cellStr);
          }
        }
        
        if (parsedDate) {
          tempDateCols[colIdx] = parsedDate;
          dateCount++;
          console.log(`Found date in row ${i}, col ${colIdx}:`, cellStr, '→', parsedDate);
        }
      }
    });
    
    // If we found multiple dates in this row, it's likely the header
    if (dateCount >= 2) { // Lower threshold
      headerRowIdx = i;
      Object.assign(dateColumns, tempDateCols);
      console.log(`Using row ${i} as header with ${dateCount} dates`);
      break;
    }
  }
  
  if (headerRowIdx === -1) {
    console.error('Could not find date header row. Checked rows:', data.slice(0, 20));
    throw new Error('Schedule date header row not detected. Please ensure your schedule file has a row with multiple dates.');
  }
  
  console.log('Found date columns:', dateColumns);
  
  // Parse shift rows - be more flexible with shift detection
  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i] as any[];
    
    // Look for AM/PM indicators in any of the first few columns
    let shiftType: 'AM' | 'PM' | null = null;
    let rowText = '';
    
    // Check first 5 columns for shift indicators
    for (let colIdx = 0; colIdx < Math.min(row.length, 5); colIdx++) {
      if (row[colIdx]) {
        const cellStr = String(row[colIdx]).trim().toUpperCase();
        rowText += cellStr + ' ';
        
        if (cellStr.includes('AM') || cellStr === 'AM') {
          shiftType = 'AM';
          break;
        } else if (cellStr.includes('PM') || cellStr === 'PM') {
          shiftType = 'PM';
          break;
        }
      }
    }
    
    if (!shiftType) {
      // Try to detect from the entire row text
      if (rowText.includes('AM')) shiftType = 'AM';
      else if (rowText.includes('PM')) shiftType = 'PM';
    }
    
    if (!shiftType) {
      console.log(`Row ${i} - no shift type found in:`, rowText);
      continue;
    }
    
    console.log(`Row ${i} - detected ${shiftType} shift`);
    
    // Default shift times
    const shiftDefaults = {
      AM: { start: '09:45', end: '16:30', crossMidnight: false },
      PM: { start: '16:00', end: '00:15', crossMidnight: true }
    };
    
    const config = shiftDefaults[shiftType];
    
    // Parse shift times
    const [startHour, startMin] = config.start.split(':').map(Number);
    const [endHour, endMin] = config.end.split(':').map(Number);
    
    // Process each date column
    Object.entries(dateColumns).forEach(([colStr, scheduleDate]) => {
      const colIdx = parseInt(colStr);
      if (colIdx < row.length) {
        const cell = row[colIdx];
        const cellStr = String(cell).trim();
        
        // Consider a cell as indicating a scheduled shift if:
        // 1. It's not empty/null/undefined
        // 2. It's not just "0" or similar null values
        // 3. It contains any meaningful content
        const hasShift = cell && 
                        cellStr !== '' && 
                        cellStr !== '0' && 
                        cellStr !== 'null' && 
                        cellStr !== 'undefined' &&
                        cellStr.toLowerCase() !== 'off';
        
        if (hasShift) {
          console.log(`Found shift: ${shiftType} on ${scheduleDate.toDateString()}, cell value: "${cellStr}"`);
          
          // Check for explicit time in cell
          let actualStartTime = parseTimeString(cellStr);
          
          let startTime: Date;
          if (actualStartTime) {
            startTime = actualStartTime;
            console.log(`Using explicit start time: ${actualStartTime.toTimeString()}`);
          } else {
            startTime = new Date();
            startTime.setHours(startHour, startMin, 0, 0);
          }
          
          let endTime = new Date();
          endTime.setHours(endHour, endMin, 0, 0);
          
          // Create schedule start datetime
          const schedStart = combineDateTime(scheduleDate, startTime)!;
          
          // Create schedule end datetime (handle cross-midnight)
          let schedEnd: Date;
          if (config.crossMidnight) {
            const nextDay = new Date(scheduleDate);
            nextDay.setDate(nextDay.getDate() + 1);
            schedEnd = combineDateTime(nextDay, endTime)!;
          } else {
            schedEnd = combineDateTime(scheduleDate, endTime)!;
          }
          
          records.push({
            date: scheduleDate.toISOString().split('T')[0],
            shift_type: shiftType,
            sched_start_dt: schedStart,
            sched_end_dt: schedEnd
          });
        }
      }
    });
  }
  
  console.log(`Parsed ${records.length} schedule records`);
  
  if (records.length === 0) {
    warnings.push('No schedule records found. Please check that your schedule file contains:');
    warnings.push('1. A header row with dates (like "Thu\n5/1/25" or "5/1/25")');
    warnings.push('2. Rows with "AM" or "PM" in the first few columns');
    warnings.push('3. Non-empty cells under date columns for scheduled shifts');
    
    throw new Error(`No schedule records found in file. Common issues:
    
1. Date header row not detected - ensure dates are in format like "5/1/25" or "Thu\n5/1/25"
2. AM/PM shift rows not found - ensure "AM" or "PM" appears in the first few columns
3. No scheduled shifts found - ensure non-empty cells under date columns

Please check your file format and try again.`);
  }
  
  return { records, warnings };
}

// Calculate attendance
function calculateAttendance(punchRecords: PunchRecord[], scheduleRecords: ScheduleRecord[]): {
  dayRecords: DayRecord[],
  summary: AttendanceSummary,
  warnings: string[]
} {
  const warnings: string[] = [];
  const dayRecords: DayRecord[] = [];
  
  const TARDY_MINUTES = 5;
  const EARLY_MINUTES = 15;
  
  console.log('\n=== ATTENDANCE CALCULATION DEBUG ===');
  console.log('Schedule records:', scheduleRecords.length);
  console.log('Punch records:', punchRecords.length);
  
  scheduleRecords.forEach((schedRecord, index) => {
    const matchingPunch = punchRecords.find(p => p.date === schedRecord.date);
    
    console.log(`\n--- Day ${index + 1}: ${schedRecord.date} (${schedRecord.shift_type}) ---`);
    console.log('Schedule:', schedRecord.sched_start_dt.toLocaleTimeString(), 'to', schedRecord.sched_end_dt.toLocaleTimeString());
    
    const schedMinutes = (schedRecord.sched_end_dt.getTime() - schedRecord.sched_start_dt.getTime()) / (1000 * 60);
    console.log('Scheduled minutes:', schedMinutes);
    
    let actualIn = matchingPunch?.in1 || null;
    let actualOut = matchingPunch?.out2 || null;
    let actualOut1 = matchingPunch?.out1 || null;
    let actualIn2 = matchingPunch?.in2 || null;
    
    console.log('Punches - IN1:', actualIn?.toLocaleTimeString() || 'none', 
                'OUT1:', actualOut1?.toLocaleTimeString() || 'none',
                'IN2:', actualIn2?.toLocaleTimeString() || 'none', 
                'OUT2:', actualOut?.toLocaleTimeString() || 'none');
    
    const present = actualIn !== null;
    let workedMinutes = 0;
    let lunchMinutes = 0;
    let tardy = false;
    let earlyDismissal = false;
    
    if (present && actualOut) {
      // Handle cross-midnight for PM shifts
      let adjustedOut = actualOut;
      if (schedRecord.shift_type === 'PM' && actualOut.getTime() < actualIn!.getTime()) {
        adjustedOut = new Date(actualOut.getTime() + 24 * 60 * 60 * 1000);
        console.log('Adjusted OUT2 for cross-midnight:', adjustedOut.toLocaleTimeString());
      }
      
      // Calculate lunch break (OUT1 to IN2)
      if (actualOut1 && actualIn2) {
        let adjustedIn2 = actualIn2;
        // Handle cross-midnight for lunch return
        if (schedRecord.shift_type === 'PM' && actualIn2.getTime() < actualOut1.getTime()) {
          adjustedIn2 = new Date(actualIn2.getTime() + 24 * 60 * 60 * 1000);
        }
        
        if (adjustedIn2.getTime() > actualOut1.getTime()) {
          lunchMinutes = (adjustedIn2.getTime() - actualOut1.getTime()) / (1000 * 60);
        }
      }
      
      // Calculate total worked time (IN1 to OUT2 minus lunch)
      const totalMinutes = (adjustedOut.getTime() - actualIn!.getTime()) / (1000 * 60);
      workedMinutes = Math.max(0, totalMinutes - lunchMinutes);
      
      console.log('Total span minutes:', totalMinutes.toFixed(2));
      console.log('Lunch minutes:', lunchMinutes.toFixed(2));
      console.log('Worked minutes:', workedMinutes.toFixed(2));
      
      // Check tardiness (arrived more than 5 minutes after scheduled start)
      const lateMinutes = (actualIn.getTime() - schedRecord.sched_start_dt.getTime()) / (1000 * 60);
      if (lateMinutes > TARDY_MINUTES) {
        tardy = true;
        console.log('TARDY: Late by', lateMinutes.toFixed(1), 'minutes');
      }
      
      // Check early dismissal (left more than 15 minutes before scheduled end)
      const earlyMinutes = (schedRecord.sched_end_dt.getTime() - adjustedOut.getTime()) / (1000 * 60);
      if (earlyMinutes > EARLY_MINUTES) {
        earlyDismissal = true;
        console.log('EARLY DISMISSAL: Left', earlyMinutes.toFixed(1), 'minutes early');
      }
    } else {
      console.log('ABSENT: No punch data');
    }
    
    // Clip worked minutes to scheduled minutes (can't work more than scheduled)
    const workedMinutesClipped = Math.min(Math.max(0, workedMinutes), schedMinutes);
    const attendanceFraction = schedMinutes > 0 ? workedMinutesClipped / schedMinutes : 0;
    
    console.log('Worked minutes clipped:', workedMinutesClipped.toFixed(2));
    console.log('Attendance fraction:', (attendanceFraction * 100).toFixed(1) + '%');
    
    dayRecords.push({
      date: schedRecord.date,
      shift_type: schedRecord.shift_type,
      sched_start_dt: schedRecord.sched_start_dt.toISOString(),
      sched_end_dt: schedRecord.sched_end_dt.toISOString(),
      actual_in: actualIn?.toISOString() || null,
      actual_out: actualOut?.toISOString() || null,
      actual_out1: actualOut1?.toISOString() || null,
      actual_in2: actualIn2?.toISOString() || null,
      sched_minutes: schedMinutes,
      worked_minutes: workedMinutes,
      worked_minutes_clipped: workedMinutesClipped,
      attendance_fraction: attendanceFraction,
      present,
      tardy,
      early_dismissal: earlyDismissal
    });
  });
  
  // Calculate summary
  const scheduledShifts = dayRecords.length;
  const shiftsWorked = dayRecords.filter(r => r.present).length;
  const tardyCount = dayRecords.filter(r => r.tardy).length;
  const earlyDismissalCount = dayRecords.filter(r => r.early_dismissal).length;
  
  const scheduledHours = dayRecords.reduce((sum, r) => sum + r.sched_minutes, 0) / 60;
  const workedHours = dayRecords.reduce((sum, r) => sum + r.worked_minutes_clipped, 0) / 60;
  
  const attendancePctShifts = scheduledShifts > 0 ? (shiftsWorked / scheduledShifts) * 100 : 0;
  const attendancePctHours = scheduledHours > 0 ? (workedHours / scheduledHours) * 100 : 0;
  
  console.log('\n=== SUMMARY CALCULATION ===');
  console.log('Scheduled shifts:', scheduledShifts);
  console.log('Shifts worked:', shiftsWorked);
  console.log('Attendance % (shifts):', attendancePctShifts.toFixed(2) + '%');
  console.log('Scheduled hours:', scheduledHours.toFixed(2));
  console.log('Worked hours:', workedHours.toFixed(2));
  console.log('Attendance % (hours):', attendancePctHours.toFixed(2) + '%');
  console.log('Tardy count:', tardyCount);
  console.log('Early dismissal count:', earlyDismissalCount);
  
  const summary: AttendanceSummary = {
    scheduled_shifts: scheduledShifts,
    shifts_worked: shiftsWorked,
    attendance_pct_shifts: Math.round(attendancePctShifts * 100) / 100,
    scheduled_hours: Math.round(scheduledHours * 100) / 100,
    worked_hours: Math.round(workedHours * 100) / 100,
    attendance_pct_hours: Math.round(attendancePctHours * 100) / 100,
    tardy_count: tardyCount,
    early_dismissal_count: earlyDismissalCount
  };
  
  return { dayRecords, summary, warnings };
}

// Main processing function
export async function processAttendanceFiles(punchFile: File, scheduleFile: File): Promise<AttendanceResult> {
  try {
    // Read files as ArrayBuffer
    const punchBuffer = await punchFile.arrayBuffer();
    const scheduleBuffer = await scheduleFile.arrayBuffer();
    
    // Parse files
    const { records: punchRecords, employee, warnings: punchWarnings } = parsePunchFile(punchBuffer);
    const { records: scheduleRecords, warnings: schedWarnings } = parseScheduleFile(scheduleBuffer);
    
    // Calculate attendance
    const { dayRecords, summary, warnings: calcWarnings } = calculateAttendance(punchRecords, scheduleRecords);
    
    const allWarnings = [...punchWarnings, ...schedWarnings, ...calcWarnings];
    
    return {
      employee_name: employee,
      summary,
      day_level: dayRecords,
      warnings: allWarnings
    };
    
  } catch (error) {
    throw new Error(`Failed to process files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}