import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse the Excel file to understand its structure
export function parseExcelFile(filePath: string) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    
    console.log('Available sheets:', sheetNames);
    
    // Read each sheet
    sheetNames.forEach(sheetName => {
      console.log(`\n--- Sheet: ${sheetName} ---`);
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      console.log('Headers (first row):', data[0]);
      console.log('Sample data (first 5 rows):');
      data.slice(0, 5).forEach((row, index) => {
        console.log(`Row ${index}:`, row);
      });
      
      // Convert to JSON for easier processing
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      console.log('\nFirst JSON record:', jsonData[0]);
      console.log(`Total records: ${jsonData.length}`);
    });
    
    return workbook;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw error;
  }
}

// Main execution
const excelPath = join(__dirname, '../../attached_assets/Hammer_Torque_Wrench_Numbers (1)_1755490533262.xlsx');

if (existsSync(excelPath)) {
  parseExcelFile(excelPath);
} else {
  console.error('Excel file not found at:', excelPath);
}