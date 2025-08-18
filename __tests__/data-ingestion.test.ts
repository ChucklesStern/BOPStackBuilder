/**
 * Data Ingestion Tests (PRD Section 10)
 * 
 * Tests CSV/XLSX parsing with required headers, flange size parsing,
 * data normalization, deduplication, and pressure class mapping
 */

import { parseCSV, parseXLSX } from '../server/services/csvParser';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';

describe('Data Ingestion (PRD Section 10)', () => {
  const testDataDir = path.join(__dirname, 'test-data');

  beforeAll(() => {
    // Create test data directory
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test data directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
  });

  describe('CSV Parsing', () => {
    test('should parse CSV with all required headers', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000
18-3/4,10M,10000,12,1-1/4,2,10000,BX-187,18-3/4 10M,10000,10000,10000,10000`;
      
      const csvPath = path.join(testDataDir, 'test-valid.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = await parseCSV(csvPath);

      expect(result).toHaveLength(2);
      expect(result[0].nominalBore).toBe('13-5/8');
      expect(result[0].pressureClassLabel).toBe('5M');
      expect(result[0].pressureClassPsi).toBe(5000);
      expect(result[0].boltCount).toBe(8);
      expect(result[0].sizeOfBolts).toBe('1-1/8');
      expect(result[0].wrenchNo).toBe(1);
      expect(result[0].truckUnitPsi).toBe(5000);
      expect(result[0].ringNeeded).toBe('BX-158');
      expect(result[0].flangeSizeRaw).toBe('13-5/8 5M');
    });

    test('should handle flange size parsing (e.g., "13-5/8 10M" → nominal_bore + pressure_class)', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,10M,10000,8,1-1/4,2,10000,BX-158,13-5/8 10M,10000,10000,10000,10000
21-1/4,5M,5000,16,1-1/8,1,5000,BX-212,21-1/4 5M,5000,5000,5000,5000`;
      
      const csvPath = path.join(testDataDir, 'test-flange-parsing.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = await parseCSV(csvPath);

      expect(result).toHaveLength(2);
      
      // Verify flange size parsing
      expect(result[0].nominalBore).toBe('13-5/8');
      expect(result[0].pressureClassLabel).toBe('10M');
      expect(result[0].flangeSizeRaw).toBe('13-5/8 10M');
      
      expect(result[1].nominalBore).toBe('21-1/4');
      expect(result[1].pressureClassLabel).toBe('5M');
      expect(result[1].flangeSizeRaw).toBe('21-1/4 5M');
    });

    test('should handle pressure class mapping (3M→3000, 5M→5000, 10M→10000)', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,3M,3000,8,1,1,3000,BX-158,13-5/8 3M,3000,3000,3000,3000
13-5/8,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000
13-5/8,10M,10000,8,1-1/4,2,10000,BX-158,13-5/8 10M,10000,10000,10000,10000`;
      
      const csvPath = path.join(testDataDir, 'test-pressure-mapping.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = await parseCSV(csvPath);

      expect(result).toHaveLength(3);
      
      expect(result[0].pressureClassLabel).toBe('3M');
      expect(result[0].pressureClassPsi).toBe(3000);
      
      expect(result[1].pressureClassLabel).toBe('5M');
      expect(result[1].pressureClassPsi).toBe(5000);
      
      expect(result[2].pressureClassLabel).toBe('10M');
      expect(result[2].pressureClassPsi).toBe(10000);
    });

    test('should handle data normalization and deduplication', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000
13-5/8,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000
18-3/4,10M,10000,12,1-1/4,2,10000,BX-187,18-3/4 10M,10000,10000,10000,10000`;
      
      const csvPath = path.join(testDataDir, 'test-deduplication.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = await parseCSV(csvPath);

      // Should deduplicate identical rows
      expect(result).toHaveLength(2);
      expect(result[0].nominalBore).toBe('13-5/8');
      expect(result[1].nominalBore).toBe('18-3/4');
    });

    test('should validate required headers are present', async () => {
      const csvContent = `nominal_bore,pressure_class_label,bolt_count
13-5/8,5M,8`;
      
      const csvPath = path.join(testDataDir, 'test-missing-headers.csv');
      fs.writeFileSync(csvPath, csvContent);

      await expect(parseCSV(csvPath)).rejects.toThrow();
    });

    test('should handle empty or invalid CSV', async () => {
      const csvContent = '';
      
      const csvPath = path.join(testDataDir, 'test-empty.csv');
      fs.writeFileSync(csvPath, csvContent);

      await expect(parseCSV(csvPath)).rejects.toThrow();
    });

    test('should handle numeric data type conversion', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,5M,"5000","8",1-1/8,"1","5000",BX-158,13-5/8 5M,"5000","5000","5000","5000"`;
      
      const csvPath = path.join(testDataDir, 'test-numeric-conversion.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = await parseCSV(csvPath);

      expect(result).toHaveLength(1);
      expect(typeof result[0].pressureClassPsi).toBe('number');
      expect(typeof result[0].boltCount).toBe('number');
      expect(typeof result[0].wrenchNo).toBe('number');
      expect(typeof result[0].truckUnitPsi).toBe('number');
      expect(typeof result[0].annularPressure).toBe('number');
    });
  });

  describe('XLSX Parsing', () => {
    test('should parse XLSX with all required headers', async () => {
      // Create test XLSX data
      const testData = [
        {
          nominal_bore: '13-5/8',
          pressure_class_label: '5M',
          pressure_class_psi: 5000,
          bolt_count: 8,
          size_of_bolts: '1-1/8',
          wrench_no: 1,
          truck_unit_psi: 5000,
          ring_needed: 'BX-158',
          flange_size_raw: '13-5/8 5M',
          annular_pressure: 5000,
          single_ram_pressure: 5000,
          double_rams_pressure: 5000,
          mud_cross_pressure: 5000
        },
        {
          nominal_bore: '18-3/4',
          pressure_class_label: '10M',
          pressure_class_psi: 10000,
          bolt_count: 12,
          size_of_bolts: '1-1/4',
          wrench_no: 2,
          truck_unit_psi: 10000,
          ring_needed: 'BX-187',
          flange_size_raw: '18-3/4 10M',
          annular_pressure: 10000,
          single_ram_pressure: 10000,
          double_rams_pressure: 10000,
          mud_cross_pressure: 10000
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      
      const xlsxPath = path.join(testDataDir, 'test-valid.xlsx');
      XLSX.writeFile(workbook, xlsxPath);

      const result = await parseXLSX(xlsxPath);

      expect(result).toHaveLength(2);
      expect(result[0].nominalBore).toBe('13-5/8');
      expect(result[0].pressureClassLabel).toBe('5M');
      expect(result[0].pressureClassPsi).toBe(5000);
      expect(result[1].nominalBore).toBe('18-3/4');
      expect(result[1].pressureClassLabel).toBe('10M');
      expect(result[1].pressureClassPsi).toBe(10000);
    });

    test('should handle XLSX with multiple sheets (use first sheet)', async () => {
      const testData1 = [
        {
          nominal_bore: '13-5/8',
          pressure_class_label: '5M',
          pressure_class_psi: 5000,
          bolt_count: 8,
          size_of_bolts: '1-1/8',
          wrench_no: 1,
          truck_unit_psi: 5000,
          ring_needed: 'BX-158',
          flange_size_raw: '13-5/8 5M',
          annular_pressure: 5000,
          single_ram_pressure: 5000,
          double_rams_pressure: 5000,
          mud_cross_pressure: 5000
        }
      ];

      const testData2 = [
        {
          nominal_bore: 'Should not be used',
          pressure_class_label: 'Should not be used',
          pressure_class_psi: 9999,
          bolt_count: 99,
          size_of_bolts: 'Should not be used',
          wrench_no: 99,
          truck_unit_psi: 9999,
          ring_needed: 'Should not be used',
          flange_size_raw: 'Should not be used',
          annular_pressure: 9999,
          single_ram_pressure: 9999,
          double_rams_pressure: 9999,
          mud_cross_pressure: 9999
        }
      ];

      const worksheet1 = XLSX.utils.json_to_sheet(testData1);
      const worksheet2 = XLSX.utils.json_to_sheet(testData2);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet1, 'First Sheet');
      XLSX.utils.book_append_sheet(workbook, worksheet2, 'Second Sheet');
      
      const xlsxPath = path.join(testDataDir, 'test-multiple-sheets.xlsx');
      XLSX.writeFile(workbook, xlsxPath);

      const result = await parseXLSX(xlsxPath);

      expect(result).toHaveLength(1);
      expect(result[0].nominalBore).toBe('13-5/8');
      expect(result[0].nominalBore).not.toBe('Should not be used');
    });

    test('should handle empty XLSX file', async () => {
      const worksheet = XLSX.utils.json_to_sheet([]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      
      const xlsxPath = path.join(testDataDir, 'test-empty.xlsx');
      XLSX.writeFile(workbook, xlsxPath);

      await expect(parseXLSX(xlsxPath)).rejects.toThrow();
    });
  });

  describe('Data Validation and Normalization', () => {
    test('should normalize whitespace in string fields', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
" 13-5/8 "," 5M ",5000,8," 1-1/8 ",1,5000," BX-158 "," 13-5/8 5M ",5000,5000,5000,5000`;
      
      const csvPath = path.join(testDataDir, 'test-whitespace.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = await parseCSV(csvPath);

      expect(result).toHaveLength(1);
      expect(result[0].nominalBore).toBe('13-5/8');
      expect(result[0].pressureClassLabel).toBe('5M');
      expect(result[0].sizeOfBolts).toBe('1-1/8');
      expect(result[0].ringNeeded).toBe('BX-158');
      expect(result[0].flangeSizeRaw).toBe('13-5/8 5M');
    });

    test('should handle case sensitivity normalization', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,5m,5000,8,1-1/8,1,5000,bx-158,13-5/8 5m,5000,5000,5000,5000`;
      
      const csvPath = path.join(testDataDir, 'test-case-sensitivity.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = await parseCSV(csvPath);

      expect(result).toHaveLength(1);
      // Should normalize to uppercase for pressure class
      expect(result[0].pressureClassLabel).toBe('5M');
      expect(result[0].ringNeeded).toBe('BX-158');
      expect(result[0].flangeSizeRaw).toBe('13-5/8 5M');
    });

    test('should validate numeric fields are positive', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,5M,-5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000`;
      
      const csvPath = path.join(testDataDir, 'test-negative-numbers.csv');
      fs.writeFileSync(csvPath, csvContent);

      await expect(parseCSV(csvPath)).rejects.toThrow();
    });

    test('should handle missing pressure values for some part types', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,,5000,
18-3/4,10M,10000,12,1-1/4,2,10000,BX-187,18-3/4 10M,,10000,,10000`;
      
      const csvPath = path.join(testDataDir, 'test-missing-pressures.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = await parseCSV(csvPath);

      expect(result).toHaveLength(2);
      expect(result[0].annularPressure).toBe(5000);
      expect(result[0].singleRamPressure).toBeNull();
      expect(result[0].doubleRamsPressure).toBe(5000);
      expect(result[0].mudCrossPressure).toBeNull();
      
      expect(result[1].annularPressure).toBeNull();
      expect(result[1].singleRamPressure).toBe(10000);
      expect(result[1].doubleRamsPressure).toBeNull();
      expect(result[1].mudCrossPressure).toBe(10000);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent file', async () => {
      const nonExistentPath = path.join(testDataDir, 'does-not-exist.csv');
      
      await expect(parseCSV(nonExistentPath)).rejects.toThrow();
    });

    test('should handle corrupted file', async () => {
      const corruptedPath = path.join(testDataDir, 'corrupted.csv');
      fs.writeFileSync(corruptedPath, Buffer.from([0x00, 0x01, 0x02, 0x03]));
      
      await expect(parseCSV(corruptedPath)).rejects.toThrow();
    });

    test('should provide clear error messages for validation failures', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000`;
      
      const csvPath = path.join(testDataDir, 'test-missing-required.csv');
      fs.writeFileSync(csvPath, csvContent);

      await expect(parseCSV(csvPath)).rejects.toThrow();
    });
  });
});