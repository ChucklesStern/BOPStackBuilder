/**
 * API Endpoint Tests (PRD Section 8)
 * 
 * Tests all specified API endpoints:
 * - POST /ingest (CSV/XLSX upload)
 * - GET /options/parts, /options/pressures, /options/flanges  
 * - POST /stack, POST /stack/:id/items, PATCH /stack/:id/order
 * - GET /stack/:id, POST /stack/:id/report
 * - GET /reports/:reportId/pdf, DELETE /stack/:id
 */

import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../server/routes';
import { PartType } from '@shared/schema';
import path from 'path';
import fs from 'fs';

describe('API Endpoints (PRD Section 8)', () => {
  let app: express.Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Data Ingestion API', () => {
    test('POST /api/ingest should accept CSV files', async () => {
      // Create a test CSV file
      const testCsv = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000`;
      
      const csvPath = path.join(__dirname, 'test-data.csv');
      fs.writeFileSync(csvPath, testCsv);

      const response = await request(app)
        .post('/api/ingest')
        .attach('file', csvPath);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Data ingested successfully');
      expect(response.body.count).toBeGreaterThan(0);

      // Clean up
      fs.unlinkSync(csvPath);
    });

    test('POST /api/ingest should reject invalid file types', async () => {
      const txtPath = path.join(__dirname, 'test.txt');
      fs.writeFileSync(txtPath, 'invalid content');

      const response = await request(app)
        .post('/api/ingest')
        .attach('file', txtPath);

      expect(response.status).toBe(400);

      // Clean up
      fs.unlinkSync(txtPath);
    });

    test('POST /api/ingest should return 400 when no file uploaded', async () => {
      const response = await request(app)
        .post('/api/ingest');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file uploaded');
    });
  });

  describe('Options API', () => {
    test('GET /api/options/parts should return all 7 part types', async () => {
      const response = await request(app)
        .get('/api/options/parts');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(7);
      
      const partTypes = response.body.map((part: any) => part.type);
      expect(partTypes).toContain(PartType.ANNULAR);
      expect(partTypes).toContain(PartType.SINGLE_RAM);
      expect(partTypes).toContain(PartType.DOUBLE_RAMS);
      expect(partTypes).toContain(PartType.MUD_CROSS);
      expect(partTypes).toContain(PartType.ANACONDA_LINES);
      expect(partTypes).toContain(PartType.ROTATING_HEAD);
      expect(partTypes).toContain('ADAPTER_SPOOL');
    });

    test('GET /api/options/parts should have correct labels as per PRD', async () => {
      const response = await request(app)
        .get('/api/options/parts');

      expect(response.status).toBe(200);
      
      const partsByType = response.body.reduce((acc: any, part: any) => {
        acc[part.type] = part;
        return acc;
      }, {});

      expect(partsByType[PartType.ANNULAR].label).toBe('Annular');
      expect(partsByType[PartType.SINGLE_RAM].label).toBe('Single B.O.P (RAM)');
      expect(partsByType[PartType.DOUBLE_RAMS].label).toBe('Double B.O.P (RAMs)');
      expect(partsByType[PartType.MUD_CROSS].label).toBe('Mud Cross');
      expect(partsByType[PartType.ANACONDA_LINES].label).toBe('Anaconda Lines');
      expect(partsByType[PartType.ROTATING_HEAD].label).toBe('Rotating Head');
      expect(partsByType['ADAPTER_SPOOL'].label).toBe('Adapter Spool');
    });

    test('GET /api/options/parts should categorize parts correctly', async () => {
      const response = await request(app)
        .get('/api/options/parts');

      expect(response.status).toBe(200);
      
      const categories = response.body.reduce((acc: any, part: any) => {
        if (!acc[part.category]) acc[part.category] = [];
        acc[part.category].push(part.type);
        return acc;
      }, {});

      expect(categories.pressure).toContain(PartType.ANNULAR);
      expect(categories.pressure).toContain(PartType.SINGLE_RAM);
      expect(categories.pressure).toContain(PartType.DOUBLE_RAMS);
      expect(categories.pressure).toContain(PartType.MUD_CROSS);
      
      expect(categories.geometry).toContain(PartType.ANACONDA_LINES);
      expect(categories.geometry).toContain(PartType.ROTATING_HEAD);
      
      expect(categories.spool).toContain('ADAPTER_SPOOL');
    });

    test('GET /api/options/pressures should require part type parameter', async () => {
      const response = await request(app)
        .get('/api/options/pressures');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Part type is required');
    });

    test('GET /api/options/pressures should return pressures for valid part type', async () => {
      const response = await request(app)
        .get('/api/options/pressures')
        .query({ part: PartType.ANNULAR });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /api/options/flanges should return flange specifications', async () => {
      const response = await request(app)
        .get('/api/options/flanges');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /api/options/flanges should filter by part type and pressure', async () => {
      const response = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.ANNULAR,
          pressure: 5000
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Stack Management API', () => {
    let stackId: string;

    test('POST /api/stack should create new stack', async () => {
      const stackData = {
        title: 'Test B.O.P Stack'
      };

      const response = await request(app)
        .post('/api/stack')
        .send(stackData);

      expect(response.status).toBe(200);
      expect(response.body.id).toBeDefined();
      expect(response.body.title).toBe('Test B.O.P Stack');
      
      stackId = response.body.id;
    });

    test('POST /api/stack should use default title if none provided', async () => {
      const response = await request(app)
        .post('/api/stack')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('B.O.P Stack');
    });

    test('GET /api/stack/:id should return stack details', async () => {
      if (!stackId) {
        // Create a stack first
        const createResponse = await request(app)
          .post('/api/stack')
          .send({ title: 'Test Stack' });
        stackId = createResponse.body.id;
      }

      const response = await request(app)
        .get(`/api/stack/${stackId}`);

      expect(response.status).toBe(200);
      expect(response.body.stack.id).toBe(stackId);
      expect(response.body.parts).toBeDefined();
      expect(Array.isArray(response.body.parts)).toBe(true);
    });

    test('GET /api/stack/:id should return 404 for non-existent stack', async () => {
      const response = await request(app)
        .get('/api/stack/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Stack not found');
    });

    test('DELETE /api/stack/:id should delete stack', async () => {
      // Create a stack first
      const createResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'Stack to Delete' });
      
      const deleteResponse = await request(app)
        .delete(`/api/stack/${createResponse.body.id}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);
    });
  });

  describe('Part Management API', () => {
    let stackId: string;
    let flangeSpecId: string;

    beforeEach(async () => {
      // Create a stack for testing
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'Test Stack for Parts' });
      stackId = stackResponse.body.id;

      // Get a flange spec for testing
      const flangeResponse = await request(app)
        .get('/api/options/flanges');
      if (flangeResponse.body.length > 0) {
        flangeSpecId = flangeResponse.body[0].id;
      }
    });

    test('POST /api/stack/:id/items should add part to stack', async () => {
      if (!flangeSpecId) {
        // Skip if no flange specs available
        console.log('Skipping test - no flange specs available');
        return;
      }

      const partData = {
        partType: PartType.ANNULAR,
        pressureValue: 5000,
        flangeSpecId: flangeSpecId
      };

      const response = await request(app)
        .post(`/api/stack/${stackId}/items`)
        .send(partData);

      expect(response.status).toBe(200);
      expect(response.body.partType).toBe(PartType.ANNULAR);
      expect(response.body.pressureValue).toBe(5000);
    });

    test('POST /api/stack/:id/items should validate part data', async () => {
      const invalidPartData = {
        partType: 'INVALID_TYPE',
        flangeSpecId: 'invalid-id'
      };

      const response = await request(app)
        .post(`/api/stack/${stackId}/items`)
        .send(invalidPartData);

      expect(response.status).toBe(400);
    });

    test('PATCH /api/stack/:id/order should update stack order', async () => {
      // First add some parts
      if (!flangeSpecId) {
        console.log('Skipping test - no flange specs available');
        return;
      }

      const part1Response = await request(app)
        .post(`/api/stack/${stackId}/items`)
        .send({
          partType: PartType.ANNULAR,
          pressureValue: 5000,
          flangeSpecId: flangeSpecId
        });

      const part2Response = await request(app)
        .post(`/api/stack/${stackId}/items`)
        .send({
          partType: PartType.SINGLE_RAM,
          pressureValue: 5000,
          flangeSpecId: flangeSpecId
        });

      const orderedPartIds = [part2Response.body.id, part1Response.body.id];

      const response = await request(app)
        .patch(`/api/stack/${stackId}/order`)
        .send({ orderedPartIds });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('PATCH /api/stack/:id/order should validate orderedPartIds array', async () => {
      const response = await request(app)
        .patch(`/api/stack/${stackId}/order`)
        .send({ orderedPartIds: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('orderedPartIds must be an array');
    });
  });

  describe('Report Generation API', () => {
    let stackId: string;

    beforeEach(async () => {
      // Create a stack for testing
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'Test Stack for Reports' });
      stackId = stackResponse.body.id;
    });

    test('POST /api/stack/:id/report should generate report', async () => {
      const response = await request(app)
        .post(`/api/stack/${stackId}/report`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBeDefined();
      expect(response.body.stackId).toBe(stackId);
      expect(response.body.pdfPath).toBeDefined();
    });

    test('POST /api/stack/:id/report should return 404 for non-existent stack', async () => {
      const response = await request(app)
        .post('/api/stack/non-existent-id/report');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Stack not found');
    });

    test('GET /api/reports/:reportId/pdf should download PDF', async () => {
      // First generate a report
      const reportResponse = await request(app)
        .post(`/api/stack/${stackId}/report`);

      const reportId = reportResponse.body.id;

      const downloadResponse = await request(app)
        .get(`/api/reports/${reportId}/pdf`);

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers['content-type']).toBe('application/pdf');
    });

    test('GET /api/reports/:reportId/pdf should return 404 for non-existent report', async () => {
      const response = await request(app)
        .get('/api/reports/non-existent-id/pdf');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Report not found');
    });
  });
});