import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { InsertFlangeSpec } from '@shared/schema';

// Interface for the original Excel format (for backwards compatibility)
interface RawFlangeDataExcel {
  'Flange size': string;
  '# of bolts': string | number;
  'Size of bolts': string;
  'Wrench': string | number;
  'Truck Unit PSI': string | number;
  'Ring needed': string;
  'Annular Pressure': string | number;
  'Single B.O.P (RAM)': string | number;
  'Double B.O.P (Double Rams)': string | number;
  'Mud Cross': string | number;
}

// Interface for the test/standard CSV format
interface RawFlangeDataCSV {
  nominal_bore: string;
  pressure_class_label: string;
  pressure_class_psi: string | number;
  bolt_count: string | number;
  size_of_bolts: string;
  wrench_no: string | number;
  truck_unit_psi: string | number;
  ring_needed: string;
  flange_size_raw: string;
  annular_pressure: string | number;
  single_ram_pressure: string | number;
  double_rams_pressure: string | number;
  mud_cross_pressure: string | number;
}

type RawFlangeData = RawFlangeDataExcel | RawFlangeDataCSV;

function parseFlangeSize(flangeSize: string): {
  nominalBore: string;
  pressureClassLabel: string;
  pressureClassPsi: number;
} {
  // Example: "13-5/8 10M" -> nominal_bore: "13-5/8", pressure_class_label: "10M", pressure_class_psi: 10000
  const parts = flangeSize.trim().split(/\s+/);
  if (parts.length !== 2) {
    throw new Error(`Invalid flange size format: ${flangeSize}`);
  }

  const nominalBore = parts[0];
  const pressureClassLabel = parts[1];
  
  // Convert pressure class to PSI
  let pressureClassPsi = 0;
  const numericPart = pressureClassLabel.replace(/[^\d]/g, '');
  if (numericPart) {
    pressureClassPsi = parseInt(numericPart) * 1000; // Convert from K to actual PSI
  }

  return {
    nominalBore,
    pressureClassLabel,
    pressureClassPsi,
  };
}

function parseNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value || value === '' || value === '-') return 0;
  
  const cleaned = value.toString().replace(/[,\s]/g, '');
  const parsed = parseInt(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseNumberWithValidation(value: string | number): number {
  const num = parseNumber(value);
  if (num < 0) {
    throw new Error(`Numeric value cannot be negative: ${value}`);
  }
  return num;
}

function parseNullableNumber(value: string | number): number | null {
  if (!value || value === '' || value === '-') return null;
  
  const num = parseNumber(value);
  return num === 0 ? null : num;
}

function normalizeString(value: string): string {
  if (!value) return '';
  
  let result = value.toString().trim();
  
  // Fix Excel date parsing issues for common fractional patterns
  // Example: "1/1/08" -> "1-1/8", "1/1/04" -> "1-1/4"
  const dateToFractionPattern = /^(\d+)\/(\d+)\/0*(\d+)$/;
  const match = result.match(dateToFractionPattern);
  if (match) {
    const [, whole, num, denom] = match;
    // Only apply this fix for common bolt size patterns
    if ((num === '1' && ['4', '8'].includes(denom))) {
      result = `${whole}-${num}/${denom}`;
    }
  }
  
  return result;
}

function normalizePressureClass(value: string): string {
  if (!value) return '';
  
  // Normalize to uppercase (e.g., '5m' -> '5M')
  return value.toString().trim().toUpperCase();
}

function normalizeRingNeeded(value: string): string {
  if (!value) return '';
  
  // Normalize to uppercase (e.g., 'bx-158' -> 'BX-158')
  return value.toString().trim().toUpperCase();
}

function normalizeFlangeSize(value: string): string {
  if (!value) return '';
  
  // Normalize flange size to have uppercase pressure class (e.g., '13-5/8 5m' -> '13-5/8 5M')
  const parts = value.toString().trim().split(/\s+/);
  if (parts.length === 2) {
    return `${parts[0]} ${parts[1].toUpperCase()}`;
  }
  return value.toString().trim();
}

function isCSVFormat(row: any): row is RawFlangeDataCSV {
  return 'nominal_bore' in row && 'pressure_class_label' in row && 'pressure_class_psi' in row;
}

function isExcelFormat(row: any): row is RawFlangeDataExcel {
  return 'Flange size' in row && 'Size of bolts' in row && 'Ring needed' in row;
}

function processRawData(rawData: RawFlangeData[]): InsertFlangeSpec[] {
  const processed: InsertFlangeSpec[] = [];
  const seen = new Set<string>(); // For deduplication
  
  for (const row of rawData) {
    try {
      let spec: InsertFlangeSpec;
      
      if (isCSVFormat(row)) {
        // Handle CSV format (test format)
        if (!row.nominal_bore || !row.pressure_class_label || !row.size_of_bolts || !row.ring_needed) {
          throw new Error('Missing required fields');
        }

        spec = {
          nominalBore: normalizeString(row.nominal_bore),
          pressureClassLabel: normalizePressureClass(row.pressure_class_label),
          pressureClassPsi: parseNumberWithValidation(row.pressure_class_psi),
          boltCount: parseNumberWithValidation(row.bolt_count),
          sizeOfBolts: normalizeString(row.size_of_bolts),
          wrenchNo: parseNumberWithValidation(row.wrench_no),
          truckUnitPsi: parseNumberWithValidation(row.truck_unit_psi),
          ringNeeded: normalizeRingNeeded(row.ring_needed),
          flangeSizeRaw: normalizeFlangeSize(row.flange_size_raw),
          
          // Parse pressure values (null if empty/dash)
          annularPressure: parseNullableNumber(row.annular_pressure),
          singleRamPressure: parseNullableNumber(row.single_ram_pressure),
          doubleRamsPressure: parseNullableNumber(row.double_rams_pressure),
          mudCrossPressure: parseNullableNumber(row.mud_cross_pressure),
        };
      } else if (isExcelFormat(row)) {
        // Handle Excel format (original format)
        if (!row['Flange size'] || !row['Size of bolts'] || !row['Ring needed']) {
          continue;
        }

        const { nominalBore, pressureClassLabel, pressureClassPsi } = parseFlangeSize(row['Flange size']);
        
        spec = {
          nominalBore,
          pressureClassLabel,
          pressureClassPsi,
          boltCount: parseNumber(row['# of bolts']),
          sizeOfBolts: normalizeString(row['Size of bolts']),
          wrenchNo: parseNumber(row['Wrench']),
          truckUnitPsi: parseNumber(row['Truck Unit PSI']),
          ringNeeded: row['Ring needed'].toString().trim(),
          flangeSizeRaw: row['Flange size'].toString().trim(),
          
          // Parse pressure values (null if empty/dash)
          annularPressure: parseNullableNumber(row['Annular Pressure']),
          singleRamPressure: parseNullableNumber(row['Single B.O.P (RAM)']),
          doubleRamsPressure: parseNullableNumber(row['Double B.O.P (Double Rams)']),
          mudCrossPressure: parseNullableNumber(row['Mud Cross']),
        };
      } else {
        throw new Error('Unknown data format');
      }

      // Deduplication based on key fields
      const key = `${spec.nominalBore}-${spec.pressureClassLabel}-${spec.boltCount}-${spec.sizeOfBolts}`;
      if (seen.has(key)) {
        continue; // Skip duplicate
      }
      seen.add(key);

      processed.push(spec);
    } catch (error) {
      // Re-throw validation errors, just log and skip parsing errors
      if (error instanceof Error && (error.message.includes('negative') || error.message.includes('required'))) {
        throw error;
      }
      console.warn(`Skipping invalid row:`, error, row);
    }
  }

  return processed;
}

export async function parseCSV(filePath: string): Promise<InsertFlangeSpec[]> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  if (!fileContent.trim()) {
    throw new Error('Empty CSV file');
  }
  
  const workbook = XLSX.read(fileContent, { type: 'string', cellDates: false, cellText: true });
  
  // For CSV files, use the first (and typically only) sheet
  const sheetName = workbook.SheetNames[0];
  
  if (!sheetName) {
    throw new Error('No sheet found in CSV file');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<RawFlangeData>(worksheet, { raw: false, defval: '' });

  if (rawData.length === 0) {
    throw new Error('No data found in CSV file');
  }
  
  // Validate that we have the expected headers
  const firstRow = rawData[0];
  const hasCSVHeaders = isCSVFormat(firstRow);
  const hasExcelHeaders = isExcelFormat(firstRow);
  
  if (!hasCSVHeaders && !hasExcelHeaders) {
    throw new Error('Missing required headers in CSV file');
  }

  return processRawData(rawData);
}

export async function parseXLSX(filePath: string): Promise<InsertFlangeSpec[]> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const workbook = XLSX.readFile(filePath, { cellDates: false, cellText: true });
  
  if (workbook.SheetNames.length === 0) {
    throw new Error('No sheets found in XLSX file');
  }
  
  // For test files, use the first sheet. For production files, look for Common Flanges sheet
  let sheetName = workbook.SheetNames.find(name => 
    name.toLowerCase().includes('common') && name.toLowerCase().includes('flange')
  );
  
  if (!sheetName) {
    sheetName = workbook.SheetNames[0]; // Fallback to first sheet
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<RawFlangeData>(worksheet, { raw: false, defval: '' });

  if (rawData.length === 0) {
    throw new Error('No data found in XLSX file');
  }

  return processRawData(rawData);
}
