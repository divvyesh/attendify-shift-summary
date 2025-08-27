import { AttendanceRecord } from '@/store/attendanceStore';
import { ProcessedData } from './excelProcessor';
import { FileInsights } from './fileAnalyzer';

export interface MergedAttendanceData {
  records: AttendanceRecord[];
  warnings: string[];
  summary: {
    totalRecords: number;
    employeeCount: number;
    dateRange?: { start: string; end: string };
    filesProcessed: string[];
  };
}

export function mergeAttendanceFiles(
  file1Data: { insights: FileInsights; processedData: ProcessedData },
  file2Data?: { insights: FileInsights; processedData: ProcessedData }
): MergedAttendanceData {
  const warnings: string[] = [];
  const filesProcessed: string[] = [file1Data.insights.fileName];
  
  if (file2Data) {
    filesProcessed.push(file2Data.insights.fileName);
  }

  // If we have only one file, process it directly
  if (!file2Data) {
    return processSingleFile(file1Data, warnings, filesProcessed);
  }

  // If we have two files, determine how to merge them
  const scheduleFile = file1Data.insights.fileType === 'schedule' ? file1Data : 
                      file2Data.insights.fileType === 'schedule' ? file2Data : null;
  
  const punchFile = file1Data.insights.fileType === 'punches' ? file1Data : 
                    file2Data.insights.fileType === 'punches' ? file2Data : null;

  if (scheduleFile && punchFile) {
    return mergeScheduleAndPunches(scheduleFile, punchFile, warnings, filesProcessed);
  } else {
    // Fallback: merge as combined data
    warnings.push('Could not determine optimal merge strategy, processing files as combined data');
    const combinedData = combineFiles(file1Data, file2Data);
    return processSingleFile({ insights: file1Data.insights, processedData: combinedData }, warnings, filesProcessed);
  }
}

function processSingleFile(
  fileData: { insights: FileInsights; processedData: ProcessedData },
  warnings: string[],
  filesProcessed: string[]
): MergedAttendanceData {
  const { processedData } = fileData;
  const records: AttendanceRecord[] = [];
  
  // Map headers to standard format
  const headerMap = createHeaderMap(processedData.headers);
  
  processedData.rows.forEach((row, index) => {
    try {
      const record = mapRowToAttendanceRecord(row, headerMap, processedData.headers);
      if (record) {
        records.push(record);
      }
    } catch (error) {
      warnings.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Failed to process'}`);
    }
  });

  const summary = createSummary(records, filesProcessed);
  
  return { records, warnings, summary };
}

function mergeScheduleAndPunches(
  scheduleFile: { insights: FileInsights; processedData: ProcessedData },
  punchFile: { insights: FileInsights; processedData: ProcessedData },
  warnings: string[],
  filesProcessed: string[]
): MergedAttendanceData {
  warnings.push('Advanced schedule-punch merging not fully implemented yet, processing as combined data');
  
  // For now, combine the files and process as single file
  const combinedData = combineFiles(scheduleFile, punchFile);
  return processSingleFile({ insights: scheduleFile.insights, processedData: combinedData }, warnings, filesProcessed);
}

function combineFiles(
  file1: { insights: FileInsights; processedData: ProcessedData },
  file2: { insights: FileInsights; processedData: ProcessedData }
): ProcessedData {
  // Simple combination - merge headers and rows
  const allHeaders = [...new Set([...file1.processedData.headers, ...file2.processedData.headers])];
  const allRows = [...file1.processedData.rows, ...file2.processedData.rows];
  
  return {
    headers: allHeaders,
    rows: allRows,
    metadata: {
      sheetName: 'Combined Data',
      totalRows: allRows.length,
      totalColumns: allHeaders.length
    }
  };
}

function createHeaderMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  
  const patterns = {
    employee_name: ['employee', 'name', 'employee_name'],
    employee_id: ['id', 'employee_id', 'emp_id'],
    store: ['store', 'location', 'site'],
    date: ['date', 'day', 'work_date'],
    shift: ['shift', 'shift_type'],
    scheduled_in: ['scheduled_in', 'sched_in', 'start_time', 'scheduled_start'],
    scheduled_out: ['scheduled_out', 'sched_out', 'end_time', 'scheduled_end'],
    actual_in: ['actual_in', 'clock_in', 'punch_in', 'in_time', 'actual_start'],
    actual_out: ['actual_out', 'clock_out', 'punch_out', 'out_time', 'actual_end'],
    status: ['status', 'attendance_status']
  };

  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    
    for (const [standardField, variations] of Object.entries(patterns)) {
      if (variations.some(variation => normalizedHeader.includes(variation))) {
        if (!map[standardField]) {
          map[standardField] = index;
        }
      }
    }
  });

  return map;
}

function mapRowToAttendanceRecord(
  row: any[],
  headerMap: Record<string, number>,
  originalHeaders: string[]
): AttendanceRecord | null {
  const getValue = (field: string): string => {
    const index = headerMap[field];
    return index !== undefined && row[index] ? row[index].toString().trim() : '';
  };

  const employeeName = getValue('employee_name');
  const date = getValue('date');
  
  if (!employeeName || !date) {
    return null; // Skip rows without essential data
  }

  // Parse date
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid date format: ${date}`);
  }

  // Map status to valid values
  const rawStatus = getValue('status').toLowerCase();
  let status: 'Present' | 'Absent' | 'Late' | 'Early-out' = 'Present';
  
  if (rawStatus.includes('absent')) {
    status = 'Absent';
  } else if (rawStatus.includes('late') || rawStatus.includes('tardy')) {
    status = 'Late';
  } else if (rawStatus.includes('early')) {
    status = 'Early-out';
  }

  return {
    id: `${employeeName.replace(/\s+/g, '_')}_${parsedDate.toISOString().split('T')[0]}_${Date.now()}`,
    employee_name: employeeName,
    employee_id: getValue('employee_id') || employeeName.replace(/\s+/g, '_'),
    employee_code: getValue('employee_id') || employeeName.replace(/\s+/g, '_'),
    store: getValue('store') || 'Unknown',
    date: parsedDate.toISOString().split('T')[0],
    shift: (getValue('shift') || 'AM') as 'AM' | 'PM',
    scheduled_in: getValue('scheduled_in') || '',
    scheduled_out: getValue('scheduled_out') || '',
    actual_in: getValue('actual_in') || null,
    actual_out: getValue('actual_out') || null,
    status,
    scheduled_hours: 0, // Will be calculated
    hours_worked: 0, // Will be calculated
    attendance_pct: 0, // Will be calculated
    is_tardy: false,
    is_early_out: false
  };
}

function createSummary(records: AttendanceRecord[], filesProcessed: string[]) {
  const uniqueEmployees = new Set(records.map(r => r.employee_name));
  const dates = records.map(r => r.date).filter(Boolean);
  
  return {
    totalRecords: records.length,
    employeeCount: uniqueEmployees.size,
    dateRange: dates.length > 0 ? {
      start: Math.min(...dates.map(d => new Date(d).getTime())).toString(),
      end: Math.max(...dates.map(d => new Date(d).getTime())).toString()
    } : undefined,
    filesProcessed
  };
}