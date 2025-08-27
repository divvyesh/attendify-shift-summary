import Papa from 'papaparse';
import { format, parse, isValid } from 'date-fns';
import { AttendanceRecord } from '@/store/attendanceStore';

interface RawCSVRow {
  [key: string]: string;
}

export const processCSVFile = async (file: File): Promise<{ records: AttendanceRecord[], warnings: string[] }> => {
  return new Promise((resolve, reject) => {
    const warnings: string[] = [];
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        // Normalize header names (case insensitive, space tolerant)
        return header.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
      },
      complete: (results) => {
        try {
          const records: AttendanceRecord[] = [];
          
          results.data.forEach((row: any, index: number) => {
            try {
              // Map normalized headers to expected fields
              const employeeName = row.employee_name || row.name || '';
              const employeeId = row.employee_id || row.id || '';
              const store = row.store || row.location || '';
              const dateStr = row.date || '';
              const shift = (row.shift || 'AM').toUpperCase();
              const scheduledIn = row.scheduled_in || row.sched_in || '';
              const scheduledOut = row.scheduled_out || row.sched_out || '';
              const actualIn = row.actual_in || row.in_time || '';
              const actualOut = row.actual_out || row.out_time || '';
              let status = row.status || '';

              // Validate required fields
              if (!employeeName || !dateStr) {
                warnings.push(`Row ${index + 2}: Missing employee name or date`);
                return;
              }

              // Parse and validate date
              const dateObj = parse(dateStr, 'yyyy-MM-dd', new Date());
              if (!isValid(dateObj)) {
                warnings.push(`Row ${index + 2}: Invalid date format: ${dateStr}`);
                return;
              }

              // Calculate hours
              const scheduledHours = calculateHours(scheduledIn, scheduledOut);
              const workedHours = actualIn && actualOut ? calculateHours(actualIn, actualOut) : 0;
              
              // Infer status if missing
              if (!status) {
                status = workedHours >= scheduledHours * 0.5 ? 'Present' : 'Absent';
              }

              // Calculate tardiness and early dismissal
              const isTardy = actualIn ? isLate(scheduledIn, actualIn, 5) : false;
              const isEarlyOut = actualOut ? isEarly(scheduledOut, actualOut, 15) : false;

              const record: AttendanceRecord = {
                id: `${employeeId}_${dateStr}_${shift}`,
                employee_id: employeeId,
                employee_name: employeeName,
                employee_code: employeeId,
                store,
                date: format(dateObj, 'yyyy-MM-dd'),
                shift: shift as 'AM' | 'PM',
                scheduled_in: scheduledIn,
                scheduled_out: scheduledOut,
                actual_in: actualIn || null,
                actual_out: actualOut || null,
                status: status as any,
                scheduled_hours: scheduledHours,
                hours_worked: workedHours,
                attendance_pct: scheduledHours > 0 ? (workedHours / scheduledHours) * 100 : 0,
                is_tardy: isTardy,
                is_early_out: isEarlyOut,
              };

              records.push(record);
            } catch (error) {
              warnings.push(`Row ${index + 2}: Error processing row - ${error}`);
            }
          });

          resolve({ records, warnings });
        } catch (error) {
          reject(new Error(`Failed to process CSV: ${error}`));
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
    });
  });
};

const parseTime = (timeStr: string): Date | null => {
  if (!timeStr) return null;
  
  // Try various time formats
  const formats = [
    'h:mm a', 'H:mm', 'h:mm:ss a', 'H:mm:ss'
  ];
  
  for (const formatStr of formats) {
    try {
      const parsed = parse(timeStr, formatStr, new Date());
      if (isValid(parsed)) return parsed;
    } catch {
      continue;
    }
  }
  return null;
};

const calculateHours = (startTime: string, endTime: string): number => {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  
  if (!start || !end) return 0;
  
  let diffMs = end.getTime() - start.getTime();
  
  // Handle cross-midnight shifts
  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000;
  }
  
  return diffMs / (1000 * 60 * 60);
};

const isLate = (scheduledTime: string, actualTime: string, thresholdMinutes: number): boolean => {
  const scheduled = parseTime(scheduledTime);
  const actual = parseTime(actualTime);
  
  if (!scheduled || !actual) return false;
  
  const diffMinutes = (actual.getTime() - scheduled.getTime()) / (1000 * 60);
  return diffMinutes > thresholdMinutes;
};

const isEarly = (scheduledTime: string, actualTime: string, thresholdMinutes: number): boolean => {
  const scheduled = parseTime(scheduledTime);
  const actual = parseTime(actualTime);
  
  if (!scheduled || !actual) return false;
  
  const diffMinutes = (scheduled.getTime() - actual.getTime()) / (1000 * 60);
  return diffMinutes > thresholdMinutes;
};