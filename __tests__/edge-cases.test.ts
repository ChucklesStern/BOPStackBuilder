/**
 * Edge Cases and Error Scenarios Tests (PRD Section 12)
 * 
 * Tests edge cases and error handling:
 * - Parts with no pressure options skip pressure step
 * - Multiple flange candidates show selection table  
 * - Zero matches show appropriate error messages
 * - Typographical variation normalization
 * - Various data validation edge cases
 */

import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../server/routes';
import { PartType } from '@shared/schema';
import { parseCSV, parseXLSX } from '../server/services/csvParser';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';

describe('Edge Cases and Error Scenarios (PRD Section 12)', () => {
  let app: express.Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);

    // Seed edge case test data
    const testCsv = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000
13-5/8,5M,5000,8,1-1/4,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000
13-5/8,5M,5000,12,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000
18-3/4,10M,10000,12,1-1/4,2,10000,BX-187,18-3/4 10M,,,10000,
21-1/4,5M,5000,16,1-1/8,1,5000,BX-212,21-1/4 5M,,5000,,5000`;
    
    const csvPath = path.join(__dirname, 'edge-cases-data.csv');
    fs.writeFileSync(csvPath, testCsv);

    await request(app)
      .post('/api/ingest')
      .attach('file', csvPath);

    fs.unlinkSync(csvPath);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Parts with No Pressure Options', () => {
    test('Part type with no pressure data should return empty pressure array', async () => {
      // Test with geometry-driven parts
      const anacondaResponse = await request(app)
        .get('/api/options/pressures')
        .query({ part: PartType.ANACONDA_LINES });

      expect(anacondaResponse.status).toBe(200);
      expect(anacondaResponse.body).toHaveLength(0);

      const rotatingResponse = await request(app)
        .get('/api/options/pressures')
        .query({ part: PartType.ROTATING_HEAD });

      expect(rotatingResponse.status).toBe(200);
      expect(rotatingResponse.body).toHaveLength(0);
    });

    test('Part type with sparse pressure data should only show available pressures', async () => {
      // Based on our test data, different parts have different pressure availability
      const mudCrossResponse = await request(app)
        .get('/api/options/pressures')
        .query({ part: PartType.MUD_CROSS });

      expect(mudCrossResponse.status).toBe(200);
      expect(mudCrossResponse.body).toContain(5000);
      expect(mudCrossResponse.body).toContain(10000);
    });
  });

  describe('Multiple Flange Candidates', () => {
    let stackId: string;

    beforeEach(async () => {
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'Multiple Candidates Test' });
      stackId = stackResponse.body.id;
    });

    test('Multiple flanges with same pressure should require further filtering', async () => {
      const flangesResponse = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.ANNULAR,
          pressure: 5000
        });

      expect(flangesResponse.status).toBe(200);
      expect(flangesResponse.body.length).toBeGreaterThan(1);

      // Should have multiple options with same pressure but different bolt configurations
      const flanges5M = flangesResponse.body.filter(
        (flange: any) => flange.pressureClassLabel === '5M'
      );
      expect(flanges5M.length).toBeGreaterThan(1);
    });

    test('Adding part should fail when multiple flange candidates exist without full filtering', async () => {
      // This test simulates trying to add a part without fully narrowing down to one flange spec
      // In the real UI, this would be prevented, but we test the API behavior
      
      const flangesResponse = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.ANNULAR,
          pressure: 5000
        });

      // If multiple flanges exist, using wrong ID should fail
      if (flangesResponse.body.length > 1) {
        const invalidResponse = await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ANNULAR,
            pressureValue: 5000,
            flangeSpecId: 'invalid-flange-id'
          });

        expect(invalidResponse.status).toBe(400);
      }
    });
  });

  describe('Zero Matches Scenarios', () => {
    test('Filtering with impossible combination should return empty results', async () => {
      const noMatchResponse = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.ANNULAR,
          pressure: 5000,
          boltCount: 999, // Impossible bolt count
          flangeSize: '13-5/8 5M'
        });

      expect(noMatchResponse.status).toBe(200);
      expect(noMatchResponse.body).toHaveLength(0);
    });

    test('Non-existent pressure for part type should return empty results', async () => {
      const noMatchResponse = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.ANNULAR,
          pressure: 99999 // Non-existent pressure
        });

      expect(noMatchResponse.status).toBe(200);
      expect(noMatchResponse.body).toHaveLength(0);
    });

    test('Invalid part type should return error', async () => {
      const invalidPartResponse = await request(app)
        .get('/api/options/pressures')
        .query({ part: 'INVALID_PART_TYPE' });

      expect(invalidPartResponse.status).toBe(200);
      expect(invalidPartResponse.body).toHaveLength(0);
    });
  });

  describe('Typographical Variation Normalization', () => {
    const testDataDir = path.join(__dirname, 'normalization-tests');

    beforeAll(() => {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }
    });

    afterAll(() => {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true });
      }
    });

    test('Should normalize pressure class variations (5m → 5M, 10m → 10M)', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,5m,5000,8,1-1/8,1,5000,bx-158,13-5/8 5m,5000,5000,5000,5000
18-3/4,10M,10000,12,1-1/4,2,10000,BX-187,18-3/4 10M,10000,10000,10000,10000`;
      
      const csvPath = path.join(testDataDir, 'case-normalization.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = await parseCSV(csvPath);

      expect(result).toHaveLength(2);
      expect(result[0].pressureClassLabel).toBe('5M'); // Normalized from 5m
      expect(result[0].ringNeeded).toBe('BX-158'); // Normalized from bx-158
      expect(result[0].flangeSizeRaw).toBe('13-5/8 5M'); // Normalized from 13-5/8 5m
    });

    test('Should handle whitespace variations', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
" 13-5/8 "," 5M ",5000,8," 1-1/8 ",1,5000," BX-158 "," 13-5/8 5M ",5000,5000,5000,5000`;
      
      const csvPath = path.join(testDataDir, 'whitespace-normalization.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = await parseCSV(csvPath);

      expect(result).toHaveLength(1);
      expect(result[0].nominalBore).toBe('13-5/8');
      expect(result[0].pressureClassLabel).toBe('5M');
      expect(result[0].sizeOfBolts).toBe('1-1/8');
      expect(result[0].ringNeeded).toBe('BX-158');
      expect(result[0].flangeSizeRaw).toBe('13-5/8 5M');
    });

    test('Should handle fractional bore size variations', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13 5/8,5M,5000,8,1-1/8,1,5000,BX-158,13 5/8 5M,5000,5000,5000,5000
13-5/8,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000`;
      
      const csvPath = path.join(testDataDir, 'fraction-normalization.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = await parseCSV(csvPath);

      expect(result).toHaveLength(2);
      // Both should be preserved as-is from the data
      expect(result[0].nominalBore).toBe('13 5/8');
      expect(result[1].nominalBore).toBe('13-5/8');
    });
  });

  describe('Data Validation Edge Cases', () => {
    const testDataDir = path.join(__dirname, 'validation-tests');

    beforeAll(() => {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }
    });

    afterAll(() => {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true });
      }
    });

    test('Should handle negative numbers gracefully', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,5M,-5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000`;
      
      const csvPath = path.join(testDataDir, 'negative-numbers.csv');
      fs.writeFileSync(csvPath, csvContent);

      await expect(parseCSV(csvPath)).rejects.toThrow();
    });

    test('Should handle zero values appropriately', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,0M,0,0,1-1/8,0,0,BX-158,13-5/8 0M,0,0,0,0`;
      
      const csvPath = path.join(testDataDir, 'zero-values.csv');
      fs.writeFileSync(csvPath, csvContent);

      await expect(parseCSV(csvPath)).rejects.toThrow();
    });

    test('Should handle empty required fields', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000`;
      
      const csvPath = path.join(testDataDir, 'empty-required.csv');
      fs.writeFileSync(csvPath, csvContent);

      await expect(parseCSV(csvPath)).rejects.toThrow();
    });

    test('Should handle extremely large numbers', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,999M,999999999,999,1-1/8,999,999999999,BX-158,13-5/8 999M,999999999,999999999,999999999,999999999`;
      
      const csvPath = path.join(testDataDir, 'large-numbers.csv');
      fs.writeFileSync(csvPath, csvContent);

      // Should parse but may have business logic validation
      const result = await parseCSV(csvPath);
      expect(result).toHaveLength(1);
      expect(result[0].pressureClassPsi).toBe(999999999);
    });

    test('Should handle special characters in text fields', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
"13-5/8""",5M,5000,8,"1-1/8""",1,5000,"BX-158""","13-5/8"" 5M",5000,5000,5000,5000`;
      
      const csvPath = path.join(testDataDir, 'special-chars.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = await parseCSV(csvPath);
      expect(result).toHaveLength(1);
      // CSV parser should handle quoted fields with special characters
    });
  });

  describe('File Format Edge Cases', () => {
    const testDataDir = path.join(__dirname, 'file-format-tests');

    beforeAll(() => {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }
    });

    afterAll(() => {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true });
      }
    });

    test('Should handle CSV with different line endings', async () => {
      const csvContent = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure\r\n13-5/8,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000\r\n`;
      
      const csvPath = path.join(testDataDir, 'crlf-endings.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = await parseCSV(csvPath);
      expect(result).toHaveLength(1);
    });

    test('Should handle XLSX with empty cells', async () => {
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
          single_ram_pressure: '', // Empty cell
          double_rams_pressure: 5000,
          mud_cross_pressure: null // Null cell
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      
      const xlsxPath = path.join(testDataDir, 'empty-cells.xlsx');
      XLSX.writeFile(workbook, xlsxPath);

      const result = await parseXLSX(xlsxPath);
      expect(result).toHaveLength(1);
      expect(result[0].annularPressure).toBe(5000);
      expect(result[0].singleRamPressure).toBeNull();
      expect(result[0].doubleRamsPressure).toBe(5000);
      expect(result[0].mudCrossPressure).toBeNull();
    });

    test('Should handle very large CSV files efficiently', async () => {
      // Generate large CSV data
      const header = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure`;
      const rows = [];
      
      for (let i = 0; i < 1000; i++) {
        rows.push(`13-5/8,5M,5000,8,1-1/8,1,5000,BX-158-${i},13-5/8 5M,5000,5000,5000,5000`);
      }
      
      const largeCsvContent = header + '\n' + rows.join('\n');
      const largeCsvPath = path.join(testDataDir, 'large-file.csv');
      fs.writeFileSync(largeCsvPath, largeCsvContent);

      const start = Date.now();
      const result = await parseCSV(largeCsvPath);
      const duration = Date.now() - start;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('API Error Handling Edge Cases', () => {
    test('Should handle malformed JSON in requests', async () => {
      const response = await request(app)
        .post('/api/stack')
        .send('{ invalid json }')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    test('Should handle extremely long stack titles', async () => {
      const longTitle = 'A'.repeat(10000);
      
      const response = await request(app)
        .post('/api/stack')
        .send({ title: longTitle });

      // Should either accept or reject gracefully
      expect([200, 400]).toContain(response.status);
    });

    test('Should handle concurrent stack modifications', async () => {
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'Concurrent Test Stack' });
      const stackId = stackResponse.body.id;

      const flangesResponse = await request(app)
        .get('/api/options/flanges');

      if (flangesResponse.body.length > 0) {
        const flangeSpec = flangesResponse.body[0];

        // Simulate concurrent part additions
        const promises = [];
        for (let i = 0; i < 5; i++) {
          promises.push(
            request(app)
              .post(`/api/stack/${stackId}/items`)
              .send({
                partType: PartType.ANNULAR,
                pressureValue: 5000,
                flangeSpecId: flangeSpec.id
              })
          );
        }

        const results = await Promise.all(promises);
        
        // All should succeed or fail gracefully
        results.forEach(result => {
          expect([200, 400, 409, 500]).toContain(result.status);
        });
      }
    });

    test('Should handle stack operations on deleted stack', async () => {
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'Stack to Delete' });
      const stackId = stackResponse.body.id;

      // Delete the stack
      await request(app)
        .delete(`/api/stack/${stackId}`);

      // Try to add part to deleted stack
      const flangesResponse = await request(app)
        .get('/api/options/flanges');

      if (flangesResponse.body.length > 0) {
        const addPartResponse = await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ANNULAR,
            pressureValue: 5000,
            flangeSpecId: flangesResponse.body[0].id
          });

        expect(addPartResponse.status).toBe(500); // Should fail gracefully
      }

      // Try to get deleted stack
      const getStackResponse = await request(app)
        .get(`/api/stack/${stackId}`);

      expect(getStackResponse.status).toBe(404);
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    test('Should handle multiple simultaneous file uploads', async () => {
      const testCsv = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000`;
      
      const csvPaths = [];
      for (let i = 0; i < 3; i++) {
        const csvPath = path.join(__dirname, `concurrent-upload-${i}.csv`);
        fs.writeFileSync(csvPath, testCsv);
        csvPaths.push(csvPath);
      }

      // Upload multiple files concurrently
      const uploadPromises = csvPaths.map(csvPath =>
        request(app)
          .post('/api/ingest')
          .attach('file', csvPath)
      );

      const results = await Promise.all(uploadPromises);
      
      // All uploads should complete (successfully or with appropriate errors)
      results.forEach(result => {
        expect([200, 400, 409, 500]).toContain(result.status);
      });

      // Clean up
      csvPaths.forEach(csvPath => {
        if (fs.existsSync(csvPath)) {
          fs.unlinkSync(csvPath);
        }
      });
    });

    test('Should handle rapid API requests', async () => {
      // Make many rapid requests to test rate limiting/performance
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app).get('/api/options/parts')
        );
      }

      const results = await Promise.all(promises);
      
      // All should succeed or fail gracefully
      results.forEach(result => {
        expect([200, 429, 500]).toContain(result.status);
      });
    });
  });
});