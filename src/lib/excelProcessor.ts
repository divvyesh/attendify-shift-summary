import * as XLSX from 'xlsx';

export interface ProcessedData {
  headers: string[];
  rows: any[][];
  metadata: {
    sheetName: string;
    totalRows: number;
    totalColumns: number;
  };
}

export async function processExcelFile(file: File): Promise<ProcessedData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to array of arrays
  const data = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1, 
    defval: '',
    raw: false // Ensure dates are formatted as strings
  }) as any[][];
  
  if (data.length === 0) {
    throw new Error('Excel file appears to be empty');
  }
  
  // Find the header row (first row with meaningful data)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    if (row && row.length >= 3 && row.some(cell => cell && cell.toString().trim())) {
      headerRowIndex = i;
      break;
    }
  }
  
  const headers = data[headerRowIndex] || [];
  const rows = data.slice(headerRowIndex + 1).filter(row => 
    row && row.some(cell => cell && cell.toString().trim())
  );
  
  return {
    headers: headers.map(h => h ? h.toString().trim() : ''),
    rows,
    metadata: {
      sheetName,
      totalRows: rows.length,
      totalColumns: headers.length
    }
  };
}

export async function processCSVFile(file: File): Promise<ProcessedData> {
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV file appears to be empty');
  }
  
  // Parse CSV (simple implementation)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result.map(cell => cell.replace(/^"|"$/g, ''));
  };
  
  const data = lines.map(parseCSVLine);
  const headers = data[0] || [];
  const rows = data.slice(1).filter(row => 
    row && row.some(cell => cell && cell.trim())
  );
  
  return {
    headers,
    rows,
    metadata: {
      sheetName: 'CSV Data',
      totalRows: rows.length,
      totalColumns: headers.length
    }
  };
}