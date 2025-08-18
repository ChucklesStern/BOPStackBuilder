import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inspect the Excel data more closely
const excelPath = join(__dirname, '../../attached_assets/Hammer_Torque_Wrench_Numbers (1)_1755490533262.xlsx');
const workbook = XLSX.readFile(excelPath);

console.log('=== DETAILED EXCEL DATA INSPECTION ===\n');

// Read Common Flanges sheet with more detail
const flangeSheet = workbook.Sheets['Common Flanges'];
const flangeData = XLSX.utils.sheet_to_json(flangeSheet, { header: 1 });

console.log('Raw data (first 5 rows):');
flangeData.slice(0, 5).forEach((row, i) => {
  console.log(`Row ${i}:`, row);
});

console.log('\n=== JSON REPRESENTATION ===');
const jsonData = XLSX.utils.sheet_to_json(flangeSheet);
console.log('First 3 records:');
jsonData.slice(0, 3).forEach((record, i) => {
  console.log(`\nRecord ${i + 1}:`);
  Object.entries(record).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
});

console.log('\n=== COLUMN ANALYSIS ===');
const headers = flangeData[0] as string[];
headers.forEach((header, index) => {
  console.log(`Column ${index}: "${header}"`);
  const values = flangeData.slice(1, 4).map(row => (row as any)[index]);
  console.log(`  Sample values: ${values.join(', ')}`);
});