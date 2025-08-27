import * as XLSX from 'xlsx';

export interface FileInsights {
  fileName: string;
  fileType: 'schedule' | 'punches' | 'combined' | 'unknown';
  confidence: number;
  dateRange?: { start: string; end: string };
  employeeCount?: number;
  recordCount?: number;
  keyColumns: string[];
  sampleData?: any[];
  errors?: string[];
  warnings?: string[];
  reasoning?: string;
  aiAnalysis?: AIAnalysis;
  needsAIReview?: boolean;
}

export interface AIAnalysis {
  fileType: 'schedule' | 'punches' | 'combined' | 'unknown';
  confidence: number;
  reasoning: string;
  columnMappings: ColumnMapping[];
  warnings: string[];
  suggestions: string[];
}

export interface ColumnMapping {
  original: string;
  suggested: string;
  confidence: number;
}

interface HeaderPatterns {
  schedule: string[];
  punches: string[];
  combined: string[];
}

const HEADER_PATTERNS: HeaderPatterns = {
  schedule: [
    'employee', 'name', 'shift', 'am', 'pm', 'schedule', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
  ],
  punches: [
    'punch', 'clock', 'in', 'out', 'time', 'actual', 'total', 'hours', 'daily', 'report'
  ],
  combined: [
    'attendance', 'employee_name', 'employee_id', 'date', 'scheduled_in', 'scheduled_out', 
    'actual_in', 'actual_out', 'status', 'shift'
  ]
};

// Constants
const AI_CONFIDENCE_THRESHOLD = 70; // If confidence is below this, suggest AI analysis
const UNKNOWN_TYPE_THRESHOLD = 50; // If unknown type with low confidence, definitely need AI

export async function analyzeFile(file: File): Promise<FileInsights> {
  const insights: FileInsights = {
    fileName: file.name,
    fileType: 'unknown',
    confidence: 0,
    keyColumns: [],
    errors: [],
    warnings: []
  };

  try {
    let data: any[][] = [];
    
    if (file.name.toLowerCase().endsWith('.csv')) {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      data = lines.slice(0, 20).map(line => line.split(',').map(cell => cell.trim().replace(/"/g, '')));
    } else {
      // Excel file
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', range: 20 });
      data = jsonData as any[][];
    }

    if (data.length === 0) {
      insights.errors?.push('File appears to be empty');
      return insights;
    }

    // Extract headers from first few rows
    const headers = extractHeaders(data);
    insights.keyColumns = headers;

    // Analyze patterns
    const analysis = analyzeHeaders(headers);
    insights.fileType = analysis.type;
    insights.confidence = analysis.confidence;

    // Extract sample data and additional insights
    const sampleRows = data.slice(1, 6).filter(row => row.some(cell => cell && cell.toString().trim()));
    insights.sampleData = sampleRows.map(row => 
      Object.fromEntries(headers.map((header, i) => [header, row[i] || '']))
    );

    // Analyze content for additional insights
    analyzeContent(insights, data, headers);

    // Determine if AI review is needed
    insights.needsAIReview = shouldUseAIAnalysis(insights);

    // Add reasoning for local analysis
    insights.reasoning = generateLocalReasoning(insights, analysis);

  } catch (error) {
    insights.errors?.push(`Failed to analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return insights;
}

// Add AI analysis function
export async function getAIAnalysis(
  fileName: string, 
  headers: string[], 
  sampleRows: any[][], 
  localGuess?: { type: string; confidence: number }
): Promise<AIAnalysis> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    
    const { data, error } = await supabase.functions.invoke('ai-file-analyzer', {
      body: {
        fileName,
        headers,
        sampleRows,
        localGuess
      }
    });

    if (error) {
      throw new Error(`AI analysis failed: ${error.message}`);
    }

    return data as AIAnalysis;
  } catch (error) {
    console.error('AI Analysis Error:', error);
    throw error;
  }
}

function shouldUseAIAnalysis(insights: FileInsights): boolean {
  // Suggest AI analysis if:
  // 1. Confidence is below threshold
  // 2. File type is unknown
  // 3. Multiple warnings present
  
  if (insights.confidence < AI_CONFIDENCE_THRESHOLD) return true;
  if (insights.fileType === 'unknown' && insights.confidence < UNKNOWN_TYPE_THRESHOLD) return true;
  if (insights.warnings && insights.warnings.length > 2) return true;
  
  return false;
}

function generateLocalReasoning(insights: FileInsights, analysis: any): string {
  const reasons = [];
  
  if (insights.confidence > 80) {
    reasons.push(`High confidence (${insights.confidence}%) based on header pattern matching`);
  } else if (insights.confidence > 50) {
    reasons.push(`Moderate confidence (${insights.confidence}%) - some expected patterns found`);
  } else {
    reasons.push(`Low confidence (${insights.confidence}%) - limited pattern matches`);
  }
  
  if (insights.fileType !== 'unknown') {
    reasons.push(`Identified as ${insights.fileType} file based on column headers`);
  } else {
    reasons.push('Unable to determine file type from headers alone');
  }
  
  if (insights.employeeCount) {
    reasons.push(`Found ${insights.employeeCount} unique employees`);
  }
  
  if (insights.dateRange) {
    reasons.push(`Date range: ${insights.dateRange.start} to ${insights.dateRange.end}`);
  }
  
  return reasons.join('. ') + '.';
}

function extractHeaders(data: any[][]): string[] {
  // Look through first few rows for headers
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    if (row && row.length > 0) {
      const cleanedRow = row.map(cell => 
        cell ? cell.toString().toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, '_') : ''
      ).filter(cell => cell);
      
      if (cleanedRow.length >= 3) {
        return cleanedRow;
      }
    }
  }
  return [];
}

function analyzeHeaders(headers: string[]): { type: 'schedule' | 'punches' | 'combined' | 'unknown'; confidence: number } {
  const headerStr = headers.join(' ').toLowerCase();
  
  let scheduleScore = 0;
  let punchesScore = 0;
  let combinedScore = 0;

  // Score against patterns
  for (const pattern of HEADER_PATTERNS.schedule) {
    if (headerStr.includes(pattern)) scheduleScore++;
  }
  
  for (const pattern of HEADER_PATTERNS.punches) {
    if (headerStr.includes(pattern)) punchesScore++;
  }
  
  for (const pattern of HEADER_PATTERNS.combined) {
    if (headerStr.includes(pattern)) combinedScore++;
  }

  // Determine type and confidence
  const maxScore = Math.max(scheduleScore, punchesScore, combinedScore);
  
  if (maxScore === 0) {
    return { type: 'unknown', confidence: 0 };
  }

  const totalPatterns = headers.length;
  let confidence = Math.min(90, (maxScore / totalPatterns) * 100);

  if (combinedScore === maxScore) {
    return { type: 'combined', confidence };
  } else if (scheduleScore === maxScore) {
    return { type: 'schedule', confidence };
  } else if (punchesScore === maxScore) {
    return { type: 'punches', confidence };
  }

  return { type: 'unknown', confidence: 0 };
}

function analyzeContent(insights: FileInsights, data: any[][], headers: string[]): void {
  try {
    const contentRows = data.slice(1).filter(row => row && row.some(cell => cell && cell.toString().trim()));
    insights.recordCount = contentRows.length;

    // Try to find employee names and count unique ones
    const employeeColumns = headers.filter(h => 
      h.includes('employee') || h.includes('name')
    );
    
    if (employeeColumns.length > 0) {
      const employeeIndex = headers.indexOf(employeeColumns[0]);
      const uniqueEmployees = new Set();
      
      contentRows.forEach(row => {
        const employeeName = row[employeeIndex];
        if (employeeName && employeeName.toString().trim()) {
          uniqueEmployees.add(employeeName.toString().trim());
        }
      });
      
      insights.employeeCount = uniqueEmployees.size;
    }

    // Try to find date range
    const dateColumns = headers.filter(h => 
      h.includes('date') || h.includes('day') || h.includes('time')
    );
    
    if (dateColumns.length > 0) {
      const dates: Date[] = [];
      
      dateColumns.forEach(dateCol => {
        const dateIndex = headers.indexOf(dateCol);
        contentRows.forEach(row => {
          const dateValue = row[dateIndex];
          if (dateValue) {
            const date = new Date(dateValue.toString());
            if (!isNaN(date.getTime())) {
              dates.push(date);
            }
          }
        });
      });
      
      if (dates.length > 0) {
        dates.sort((a, b) => a.getTime() - b.getTime());
        insights.dateRange = {
          start: dates[0].toISOString().split('T')[0],
          end: dates[dates.length - 1].toISOString().split('T')[0]
        };
      }
    }

    // Add warnings based on analysis
    if (insights.employeeCount === 0) {
      insights.warnings?.push('No employee names detected');
    }
    
    if (!insights.dateRange) {
      insights.warnings?.push('No date information found');
    }
    
    if (insights.recordCount === 0) {
      insights.warnings?.push('No data rows found');
    }

  } catch (error) {
    insights.warnings?.push('Failed to analyze file content completely');
  }
}