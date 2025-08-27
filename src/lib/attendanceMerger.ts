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
  
  console.log('📋 Processing file:', fileData.insights.fileName);
  console.log('📊 Detected headers:', processedData.headers.slice(0, 6), '...');
  console.log('📈 Data rows:', processedData.rows.length);
  
  // Map headers to standard format
  const headerMappingResult = createHeaderMap(processedData.headers);
  const { map: headerMap, missing, inferred, diagnostics } = headerMappingResult;
  
  // Add warnings for missing critical fields
  if (missing.includes('employee_name') || missing.includes('date')) {
    warnings.push(`Critical fields missing: ${missing.join(', ')}. File may not process correctly.`);
  }
  
  // Add info about inferred mappings
  if (inferred.length > 0) {
    warnings.push(`Auto-inferred fields: ${inferred.join(', ')}. Please verify these mappings.`);
  }

  let processedRowCount = 0;
  let skippedRowCount = 0;
  
  processedData.rows.forEach((row, index) => {
    try {
      const record = mapRowToAttendanceRecord(row, headerMap, processedData.headers);
      if (record) {
        records.push(record);
        processedRowCount++;
      } else {
        skippedRowCount++;
      }
    } catch (error) {
      skippedRowCount++;
      warnings.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Failed to process'}`);
    }
  });

  console.log(`📊 Processing results: ${processedRowCount} records created, ${skippedRowCount} rows skipped`);
  
  // If no records were created, provide detailed diagnostics
  if (records.length === 0) {
    warnings.push(`No records created. Headers found: ${diagnostics.originalHeaders.slice(0, 8).join(', ')}${diagnostics.originalHeaders.length > 8 ? '...' : ''}`);
    warnings.push(`Mapped fields: ${Object.entries(diagnostics.mappedFields).map(([k,v]) => `${k}→${v}`).join(', ') || 'None'}`);
  }

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

interface HeaderMappingResult {
  map: Record<string, number>;
  matched: string[];
  missing: string[];
  inferred: string[];
  diagnostics: {
    originalHeaders: string[];
    mappedFields: Record<string, string>;
  };
}

function createHeaderMap(headers: string[]): HeaderMappingResult {
  const map: Record<string, number> = {};
  const matched: string[] = [];
  const missing: string[] = [];
  const inferred: string[] = [];
  
  console.log('🔍 Analyzing headers:', headers);
  
  // Expanded patterns for real-world attendance files
  const patterns = {
    employee_name: [
      'employee', 'name', 'employee_name', 'employee name', 'associate', 
      'associate name', 'staff', 'worker', 'full name', 'emp name', 'person'
    ],
    employee_id: [
      'employee_id', 'emp_id', 'id', 'badge', 'badge_id', 'payroll_id', 
      'employee id', 'emp id', 'badge id', 'payroll id', 'number', 'employee number'
    ],
    store: [
      'store', 'location', 'site', 'department', 'store_name', 'store name',
      'dept', 'unit', 'branch', 'facility'
    ],
    date: [
      'date', 'day', 'work_date', 'shift_date', 'business_date', 'workday',
      'date worked', 'shift date', 'business date', 'work day'
    ],
    shift: [
      'shift', 'shift_type', 'schedule', 'scheduled_shift', 'am_pm', 'period',
      'shift type', 'scheduled shift', 'am/pm'
    ],
    scheduled_in: [
      'scheduled_in', 'sched_in', 'start_time', 'scheduled_start', 'planned_in',
      'scheduled in', 'sched in', 'start time', 'scheduled start', 'planned in',
      'plan in', 'shift start', 'begin time'
    ],
    scheduled_out: [
      'scheduled_out', 'sched_out', 'end_time', 'scheduled_end', 'planned_out',
      'scheduled out', 'sched out', 'end time', 'scheduled end', 'planned out',
      'plan out', 'shift end', 'finish time'
    ],
    actual_in: [
      'actual_in', 'clock_in', 'punch_in', 'in_time', 'actual_start', 'time_in',
      'actual in', 'clock in', 'punch in', 'time in', 'in', 'in_1', 'punch 1'
    ],
    actual_out: [
      'actual_out', 'clock_out', 'punch_out', 'out_time', 'actual_end', 'time_out',
      'actual out', 'clock out', 'punch out', 'time out', 'out', 'out_1', 'punch 2'
    ],
    status: [
      'status', 'attendance_status', 'attendance', 'code', 'reason',
      'attendance status', 'att status', 'present'
    ]
  };

  // First pass: exact and partial matches
  headers.forEach((header, index) => {
    if (!header) return;
    
    const normalizedHeader = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    
    for (const [standardField, variations] of Object.entries(patterns)) {
      if (!map[standardField]) {
        // Check for exact or partial matches
        const isMatch = variations.some(variation => {
          const normalizedVariation = variation.toLowerCase().replace(/[^a-z0-9]/g, '_');
          return normalizedHeader.includes(normalizedVariation) || 
                 normalizedVariation.includes(normalizedHeader);
        });
        
        if (isMatch) {
          map[standardField] = index;
          matched.push(standardField);
          console.log(`✅ Matched ${standardField} -> "${header}" (column ${index})`);
        }
      }
    }
  });

  // Second pass: intelligent inference for missing critical fields
  const criticalFields = ['employee_name', 'date'];
  
  criticalFields.forEach(field => {
    if (!map[field]) {
      let inferredIndex = -1;
      
      if (field === 'employee_name') {
        // Look for any column that might contain names (text-heavy, contains common name patterns)
        inferredIndex = headers.findIndex((header, index) => {
          if (map.employee_id === index) return false; // Skip if already used for ID
          const h = header.toLowerCase();
          return h.includes('name') || h.includes('employee') || 
                 h.includes('associate') || h.includes('staff') ||
                 (index === 0 && !h.includes('id') && !h.includes('date')); // First column heuristic
        });
      } else if (field === 'date') {
        // Look for columns that might contain dates
        inferredIndex = headers.findIndex(header => {
          const h = header.toLowerCase();
          return h.includes('date') || h.includes('day') || h.includes('time') ||
                 h.includes('shift') && !h.includes('type');
        });
      }
      
      if (inferredIndex >= 0) {
        map[field] = inferredIndex;
        inferred.push(field);
        console.log(`🔮 Inferred ${field} -> "${headers[inferredIndex]}" (column ${inferredIndex})`);
      } else {
        missing.push(field);
        console.log(`❌ Missing critical field: ${field}`);
      }
    }
  });

  // Check for other missing fields
  Object.keys(patterns).forEach(field => {
    if (!map[field] && !criticalFields.includes(field)) {
      missing.push(field);
    }
  });

  const mappedFields: Record<string, string> = {};
  Object.entries(map).forEach(([field, index]) => {
    mappedFields[field] = headers[index] || '';
  });

  console.log('📊 Header mapping summary:', {
    matched: matched.length,
    inferred: inferred.length,
    missing: missing.length,
    mappedFields
  });

  return {
    map,
    matched,
    missing,
    inferred,
    diagnostics: {
      originalHeaders: headers,
      mappedFields
    }
  };
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
  const employeeId = getValue('employee_id');
  const date = getValue('date');
  
  // More flexible validation - accept either name or ID plus date
  if ((!employeeName && !employeeId) || !date) {
    return null; // Skip rows without essential data
  }

  // Improved date parsing - handle multiple formats
  const parsedDate = parseFlexibleDate(date);
  if (!parsedDate) {
    throw new Error(`Invalid date format: ${date}`);
  }

  // Map status to valid values with broader synonyms
  const rawStatus = getValue('status').toLowerCase();
  let status: 'Present' | 'Absent' | 'Late' | 'Early-out' = 'Present';
  
  if (rawStatus.includes('absent') || rawStatus.includes('no show') || rawStatus.includes('ns')) {
    status = 'Absent';
  } else if (rawStatus.includes('late') || rawStatus.includes('tardy') || rawStatus.includes('l')) {
    status = 'Late';
  } else if (rawStatus.includes('early') || rawStatus.includes('eo') || rawStatus.includes('left early')) {
    status = 'Early-out';
  }

  // Use employee name or fallback to ID
  const finalEmployeeName = employeeName || employeeId || 'Unknown Employee';
  const finalEmployeeId = employeeId || employeeName?.replace(/\s+/g, '_') || 'unknown';

  return {
    id: `${finalEmployeeName.replace(/\s+/g, '_')}_${parsedDate.toISOString().split('T')[0]}_${Date.now()}`,
    employee_name: finalEmployeeName,
    employee_id: finalEmployeeId,
    employee_code: finalEmployeeId,
    store: getValue('store') || 'Unknown',
    date: parsedDate.toISOString().split('T')[0],
    shift: normalizeShift(getValue('shift')),
    scheduled_in: normalizeTime(getValue('scheduled_in')),
    scheduled_out: normalizeTime(getValue('scheduled_out')),
    actual_in: normalizeTime(getValue('actual_in')) || null,
    actual_out: normalizeTime(getValue('actual_out')) || null,
    status,
    scheduled_hours: 0, // Will be calculated
    hours_worked: 0, // Will be calculated
    attendance_pct: 0, // Will be calculated
    is_tardy: false,
    is_early_out: false
  };
}

function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const cleanDate = dateStr.trim();
  
  // Try standard Date constructor first
  let date = new Date(cleanDate);
  if (!isNaN(date.getTime())) return date;
  
  // Try common date formats manually
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, // MM/DD/YY or MM/DD/YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{2,4})/, // MM-DD-YY or MM-DD-YYYY  
    /^(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
    /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/ // MM.DD.YY or MM.DD.YYYY
  ];
  
  for (const format of formats) {
    const match = cleanDate.match(format);
    if (match) {
      const [, part1, part2, part3] = match;
      let year, month, day;
      
      if (format.source.startsWith('^(\\d{4})')) {
        // YYYY-MM-DD format
        year = parseInt(part1);
        month = parseInt(part2) - 1; // JS months are 0-based
        day = parseInt(part3);
      } else {
        // MM/DD/YY or similar formats
        month = parseInt(part1) - 1;
        day = parseInt(part2);
        year = parseInt(part3);
        if (year < 100) year += 2000; // Convert 2-digit year
      }
      
      date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  return null;
}

function normalizeShift(shift: string): 'AM' | 'PM' {
  if (!shift) return 'AM';
  
  const s = shift.toLowerCase().trim();
  if (s.includes('pm') || s.includes('evening') || s.includes('night') || s === 'p') {
    return 'PM';
  }
  return 'AM';
}

function normalizeTime(timeStr: string): string {
  if (!timeStr) return '';
  
  const clean = timeStr.trim();
  
  // If already in HH:MM format, return as-is
  if (/^\d{1,2}:\d{2}(\s*(AM|PM))?$/i.test(clean)) {
    return clean;
  }
  
  // Convert HHMM to HH:MM
  if (/^\d{4}$/.test(clean)) {
    return `${clean.slice(0, 2)}:${clean.slice(2)}`;
  }
  
  // Convert H.MM to HH:MM
  if (/^\d{1,2}\.\d{2}$/.test(clean)) {
    return clean.replace('.', ':');
  }
  
  return clean; // Return as-is if can't normalize
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