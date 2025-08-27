import { ColumnMapping } from './fileAnalyzer';
import { ProcessedData } from './excelProcessor';

export interface NormalizedData {
  headers: string[];
  rows: any[][];
  metadata: {
    originalHeaders: string[];
    mappingsApplied: ColumnMapping[];
    rowsProcessed: number;
    warnings: string[];
  };
}

export function normalizeData(
  processedData: ProcessedData, 
  columnMappings: ColumnMapping[]
): NormalizedData {
  const warnings: string[] = [];
  const { headers: originalHeaders, rows: originalRows } = processedData;
  
  // Create mapping lookup
  const mappingLookup = new Map<string, string>();
  columnMappings.forEach(mapping => {
    if (mapping.suggested && mapping.suggested.trim()) {
      mappingLookup.set(mapping.original.toLowerCase(), mapping.suggested);
    }
  });

  // Create normalized headers
  const normalizedHeaders = originalHeaders.map(header => {
    const cleanHeader = header.toLowerCase().trim();
    return mappingLookup.get(cleanHeader) || header;
  });

  // Process rows with data type normalization
  const normalizedRows = originalRows.map((row, rowIndex) => {
    const normalizedRow = row.map((cell, cellIndex) => {
      const header = normalizedHeaders[cellIndex];
      return normalizeCell(cell, header, rowIndex, warnings);
    });
    return normalizedRow;
  });

  return {
    headers: normalizedHeaders,
    rows: normalizedRows,
    metadata: {
      originalHeaders,
      mappingsApplied: columnMappings,
      rowsProcessed: normalizedRows.length,
      warnings
    }
  };
}

function normalizeCell(cell: any, header: string, rowIndex: number, warnings: string[]): any {
  if (cell === null || cell === undefined || cell === '') {
    return '';
  }

  const cellStr = cell.toString().trim();
  
  // Date normalization for date-related fields
  if (header.includes('date') || header.includes('_in') || header.includes('_out')) {
    return normalizeDateField(cellStr, header, rowIndex, warnings);
  }
  
  // Time normalization for time fields
  if (header.includes('time') || header === 'scheduled_in' || header === 'scheduled_out' || 
      header === 'actual_in' || header === 'actual_out') {
    return normalizeTimeField(cellStr, header, rowIndex, warnings);
  }
  
  // Numeric normalization for numeric fields
  if (header.includes('hours') || header.includes('pct') || header.includes('percent')) {
    return normalizeNumericField(cellStr, header, rowIndex, warnings);
  }
  
  // Boolean normalization for status fields
  if (header === 'status' || header.includes('tardy') || header.includes('early')) {
    return normalizeBooleanField(cellStr, header);
  }
  
  // Default: clean text
  return normalizeTextField(cellStr);
}

function normalizeDateField(value: string, header: string, rowIndex: number, warnings: string[]): string {
  if (!value) return '';
  
  // Try various date formats
  const dateFormats = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/ // M/D/YY or MM/DD/YYYY
  ];
  
  // Try parsing as date
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  }
  
  // Check specific formats
  if (dateFormats.some(format => format.test(value))) {
    try {
      const parsedDate = new Date(value);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }
    } catch (e) {
      warnings.push(`Invalid date format in row ${rowIndex + 1}, column ${header}: ${value}`);
    }
  }
  
  return value; // Return original if can't parse
}

function normalizeTimeField(value: string, header: string, rowIndex: number, warnings: string[]): string {
  if (!value) return '';
  
  // Handle various time formats
  const timeFormats = [
    /^\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM))?$/i, // HH:MM or HH:MM:SS with optional AM/PM
    /^\d{4}$/, // HHMM format
    /^\d{1,2}\.\d{2}$/ // H.MM format
  ];
  
  let normalizedValue = value.trim().toUpperCase();
  
  // Convert HHMM to HH:MM
  if (/^\d{4}$/.test(normalizedValue)) {
    normalizedValue = `${normalizedValue.slice(0, 2)}:${normalizedValue.slice(2)}`;
  }
  
  // Convert H.MM to HH:MM
  if (/^\d{1,2}\.\d{2}$/.test(normalizedValue)) {
    normalizedValue = normalizedValue.replace('.', ':');
  }
  
  // Validate time format
  if (timeFormats.some(format => format.test(normalizedValue))) {
    return normalizedValue;
  }
  
  warnings.push(`Unusual time format in row ${rowIndex + 1}, column ${header}: ${value}`);
  return value;
}

function normalizeNumericField(value: string, header: string, rowIndex: number, warnings: string[]): number | string {
  if (!value) return 0;
  
  // Remove common formatting
  const cleanValue = value.replace(/[$,%]/g, '').trim();
  
  // Handle percentages
  if (value.includes('%') || header.includes('pct') || header.includes('percent')) {
    const num = parseFloat(cleanValue);
    if (!isNaN(num)) {
      return num > 1 ? num / 100 : num; // Convert if > 1 (e.g., 85% -> 0.85)
    }
  }
  
  // Handle regular numbers
  const num = parseFloat(cleanValue);
  if (!isNaN(num)) {
    return num;
  }
  
  return value; // Return original if can't parse
}

function normalizeBooleanField(value: string, header: string): string {
  if (!value) return '';
  
  const lowerValue = value.toLowerCase().trim();
  
  // Status field normalization
  if (header === 'status') {
    const statusMap = {
      'present': 'Present',
      'absent': 'Absent',
      'tardy': 'Tardy',
      'late': 'Tardy',
      'early': 'Early Out',
      'early out': 'Early Out',
      'no show': 'Absent',
      'excused': 'Excused',
      'sick': 'Sick Leave',
      'vacation': 'Vacation'
    };
    
    return statusMap[lowerValue] || value;
  }
  
  // Boolean fields
  const truthyValues = ['yes', 'y', 'true', '1', 'on', 'checked'];
  const falsyValues = ['no', 'n', 'false', '0', 'off', 'unchecked'];
  
  if (truthyValues.includes(lowerValue)) return 'true';
  if (falsyValues.includes(lowerValue)) return 'false';
  
  return value;
}

function normalizeTextField(value: string): string {
  return value.trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[""]/g, '"') // Normalize quotes
    .replace(/['']/g, "'"); // Normalize apostrophes
}