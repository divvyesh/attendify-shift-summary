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
  
  // Find header row with dates
  let headerRowIdx = -1;
  const dateColumns: { [col: number]: Date } = {};
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i] as any[];
    let dateCount = 0;
    const tempDateCols: { [col: number]: Date } = {};
    
    row.forEach((cell, colIdx) => {
      const cellStr = String(cell).trim();
      const parsedDate = parseHeaderDate(cellStr);
      if (parsedDate) {
        tempDateCols[colIdx] = parsedDate;
        dateCount++;
      }
    });
    
    if (dateCount >= 3) {
      headerRowIdx = i;
      Object.assign(dateColumns, tempDateCols);
      break;
    }
  }
  
  if (headerRowIdx === -1) {
    throw new Error('Schedule date header row not detected');
  }
  
  // Parse shift rows
  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i] as any[];
    
    // Look for AM/PM in column 3 (0-based index 3)
    let shiftType: 'AM' | 'PM' | null = null;
    if (row.length > 3) {
      const cellStr = String(row[3]).trim().toUpperCase();
      if (cellStr.includes('AM')) shiftType = 'AM';
      else if (cellStr.includes('PM')) shiftType = 'PM';
    }
    
    if (!shiftType) continue;
    
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
        
        if (cellStr && cellStr !== '0') {
          // Check for explicit time in cell
          let actualStartTime = parseTimeString(cellStr);
          
          let startTime: Date;
          if (actualStartTime) {
            startTime = actualStartTime;
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
  
  if (records.length === 0) {
    throw new Error('No schedule records found in file');
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
  
  scheduleRecords.forEach(schedRecord => {
    const matchingPunch = punchRecords.find(p => p.date === schedRecord.date);
    
    const schedMinutes = (schedRecord.sched_end_dt.getTime() - schedRecord.sched_start_dt.getTime()) / (1000 * 60);
    
    let actualIn = matchingPunch?.in1 || null;
    let actualOut = matchingPunch?.out2 || null;
    let actualOut1 = matchingPunch?.out1 || null;
    let actualIn2 = matchingPunch?.in2 || null;
    
    const present = actualIn !== null;
    let workedMinutes = 0;
    let tardy = false;
    let earlyDismissal = false;
    
    if (present && actualOut) {
      // Calculate lunch break
      let lunchMinutes = 0;
      if (actualOut1 && actualIn2 && actualIn2.getTime() > actualOut1.getTime()) {
        lunchMinutes = (actualIn2.getTime() - actualOut1.getTime()) / (1000 * 60);
      }
      
      // Calculate total worked time
      const totalMinutes = (actualOut.getTime() - actualIn!.getTime()) / (1000 * 60);
      workedMinutes = Math.max(0, totalMinutes - lunchMinutes);
      
      // Check tardiness (more than 5 minutes late)
      if (actualIn.getTime() > schedRecord.sched_start_dt.getTime() + (TARDY_MINUTES * 60 * 1000)) {
        tardy = true;
      }
      
      // Check early dismissal (more than 15 minutes early)
      if (actualOut.getTime() < schedRecord.sched_end_dt.getTime() - (EARLY_MINUTES * 60 * 1000)) {
        earlyDismissal = true;
      }
    }
    
    const workedMinutesClipped = Math.min(Math.max(0, workedMinutes), schedMinutes);
    const attendanceFraction = schedMinutes > 0 ? workedMinutesClipped / schedMinutes : 0;
    
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