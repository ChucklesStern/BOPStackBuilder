import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { InsertFlangeSpec } from '@shared/schema';

interface RawFlangeData {
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

function normalizeString(value: string): string {
  if (!value) return '';
  
  // Normalize multiplication symbols
  return value.toString()
    .replace(/\s*[x×]\s*/g, ' × ')
    .trim();
}

function processRawData(rawData: RawFlangeData[]): InsertFlangeSpec[] {
  const processed: InsertFlangeSpec[] = [];
  
  for (const row of rawData) {
    try {
      // Skip rows with missing required data
      if (!row['Flange size'] || !row['Size of bolts'] || !row['Ring needed']) {
        continue;
      }

      const { nominalBore, pressureClassLabel, pressureClassPsi } = parseFlangeSize(row['Flange size']);
      
      const spec: InsertFlangeSpec = {
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
        annularPressure: parseNumber(row['Annular Pressure']) || null,
        singleRamPressure: parseNumber(row['Single B.O.P (RAM)']) || null,
        doubleRamsPressure: parseNumber(row['Double B.O.P (Double Rams)']) || null,
        mudCrossPressure: parseNumber(row['Mud Cross']) || null,
      };

      processed.push(spec);
    } catch (error) {
      console.warn(`Skipping invalid row:`, error, row);
    }
  }

  return processed;
}

export async function parseCSV(filePath: string): Promise<InsertFlangeSpec[]> {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const workbook = XLSX.read(fileContent, { type: 'string' });
  
  // Look for Common Flanges sheet
  const sheetName = workbook.SheetNames.find(name => 
    name.toLowerCase().includes('common') && name.toLowerCase().includes('flange')
  ) || workbook.SheetNames[0];
  
  if (!sheetName) {
    throw new Error('No suitable sheet found in CSV file');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<RawFlangeData>(worksheet);

  if (rawData.length === 0) {
    throw new Error('No data found in CSV file');
  }

  return processRawData(rawData);
}

export async function parseXLSX(filePath: string): Promise<InsertFlangeSpec[]> {
  const workbook = XLSX.readFile(filePath);
  
  // Look for Common Flanges sheet
  const sheetName = workbook.SheetNames.find(name => 
    name.toLowerCase().includes('common') && name.toLowerCase().includes('flange')
  );
  
  if (!sheetName) {
    throw new Error('Common Flanges sheet not found in XLSX file');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<RawFlangeData>(worksheet);

  if (rawData.length === 0) {
    throw new Error('No data found in Common Flanges sheet');
  }

  return processRawData(rawData);
}
