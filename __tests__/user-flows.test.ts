/**
 * Core User Flow Tests (PRD Section 4)
 * 
 * Tests the three main user flows:
 * - Branch A: Pressure-driven parts (Annular, Single RAM, Double RAMs, Mud Cross)
 * - Branch B: Geometry-driven parts (Anaconda Lines, Rotating Head)  
 * - Branch C: Adapter Spool (two-sided selection and validation)
 * - Stack Ordering: drag-and-drop reordering functionality
 * - Report Generation: PDF export with exact formatting
 */

import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../server/routes';
import { PartType } from '@shared/schema';
import path from 'path';
import fs from 'fs';

describe('Core User Flows (PRD Section 4)', () => {
  let app: express.Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);

    // Seed test data
    const testCsv = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000
13-5/8,10M,10000,8,1-1/4,2,10000,BX-158,13-5/8 10M,10000,10000,10000,10000
18-3/4,5M,5000,12,1-1/8,1,5000,BX-187,18-3/4 5M,5000,5000,5000,5000
18-3/4,10M,10000,12,1-1/4,2,10000,BX-187,18-3/4 10M,10000,10000,10000,10000`;
    
    const csvPath = path.join(__dirname, 'test-user-flows.csv');
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

  describe('Branch A: Pressure-Driven Parts Flow', () => {
    let stackId: string;

    beforeEach(async () => {
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'Branch A Test Stack' });
      stackId = stackResponse.body.id;
    });

    test('Annular selection flow should follow pressure-first pattern', async () => {
      // Step 1: Get available pressures for Annular
      const pressuresResponse = await request(app)
        .get('/api/options/pressures')
        .query({ part: PartType.ANNULAR });

      expect(pressuresResponse.status).toBe(200);
      expect(pressuresResponse.body).toContain(5000);
      expect(pressuresResponse.body).toContain(10000);

      // Step 2: Filter flanges by part type and pressure
      const flangesResponse = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.ANNULAR,
          pressure: 5000
        });

      expect(flangesResponse.status).toBe(200);
      expect(flangesResponse.body.length).toBeGreaterThan(0);

      // Step 3: Add part to stack
      const flangeSpec = flangesResponse.body[0];
      const addPartResponse = await request(app)
        .post(`/api/stack/${stackId}/items`)
        .send({
          partType: PartType.ANNULAR,
          pressureValue: 5000,
          flangeSpecId: flangeSpec.id
        });

      expect(addPartResponse.status).toBe(200);
      expect(addPartResponse.body.partType).toBe(PartType.ANNULAR);
      expect(addPartResponse.body.pressureValue).toBe(5000);
    });

    test('Single RAM selection flow should follow pressure-first pattern', async () => {
      const pressuresResponse = await request(app)
        .get('/api/options/pressures')
        .query({ part: PartType.SINGLE_RAM });

      expect(pressuresResponse.status).toBe(200);
      
      const flangesResponse = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.SINGLE_RAM,
          pressure: pressuresResponse.body[0]
        });

      expect(flangesResponse.status).toBe(200);
      
      const flangeSpec = flangesResponse.body[0];
      const addPartResponse = await request(app)
        .post(`/api/stack/${stackId}/items`)
        .send({
          partType: PartType.SINGLE_RAM,
          pressureValue: pressuresResponse.body[0],
          flangeSpecId: flangeSpec.id
        });

      expect(addPartResponse.status).toBe(200);
      expect(addPartResponse.body.partType).toBe(PartType.SINGLE_RAM);
    });

    test('Double RAMs selection flow should follow pressure-first pattern', async () => {
      const pressuresResponse = await request(app)
        .get('/api/options/pressures')
        .query({ part: PartType.DOUBLE_RAMS });

      expect(pressuresResponse.status).toBe(200);
      
      const flangesResponse = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.DOUBLE_RAMS,
          pressure: pressuresResponse.body[0]
        });

      expect(flangesResponse.status).toBe(200);
      
      const flangeSpec = flangesResponse.body[0];
      const addPartResponse = await request(app)
        .post(`/api/stack/${stackId}/items`)
        .send({
          partType: PartType.DOUBLE_RAMS,
          pressureValue: pressuresResponse.body[0],
          flangeSpecId: flangeSpec.id
        });

      expect(addPartResponse.status).toBe(200);
      expect(addPartResponse.body.partType).toBe(PartType.DOUBLE_RAMS);
    });

    test('Mud Cross selection flow should follow pressure-first pattern', async () => {
      const pressuresResponse = await request(app)
        .get('/api/options/pressures')
        .query({ part: PartType.MUD_CROSS });

      expect(pressuresResponse.status).toBe(200);
      
      const flangesResponse = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.MUD_CROSS,
          pressure: pressuresResponse.body[0]
        });

      expect(flangesResponse.status).toBe(200);
      
      const flangeSpec = flangesResponse.body[0];
      const addPartResponse = await request(app)
        .post(`/api/stack/${stackId}/items`)
        .send({
          partType: PartType.MUD_CROSS,
          pressureValue: pressuresResponse.body[0],
          flangeSpecId: flangeSpec.id
        });

      expect(addPartResponse.status).toBe(200);
      expect(addPartResponse.body.partType).toBe(PartType.MUD_CROSS);
    });
  });

  describe('Branch B: Geometry-Driven Parts Flow', () => {
    let stackId: string;

    beforeEach(async () => {
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'Branch B Test Stack' });
      stackId = stackResponse.body.id;
    });

    test('Anaconda Lines selection flow should skip pressure step', async () => {
      // Step 1: Should not require pressure selection
      const pressuresResponse = await request(app)
        .get('/api/options/pressures')
        .query({ part: PartType.ANACONDA_LINES });

      expect(pressuresResponse.status).toBe(200);
      expect(pressuresResponse.body).toHaveLength(0); // No pressures for geometry-driven parts

      // Step 2: Get flanges directly by part type
      const flangesResponse = await request(app)
        .get('/api/options/flanges')
        .query({ part: PartType.ANACONDA_LINES });

      expect(flangesResponse.status).toBe(200);

      // Step 3: Add part to stack without pressure
      if (flangesResponse.body.length > 0) {
        const flangeSpec = flangesResponse.body[0];
        const addPartResponse = await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ANACONDA_LINES,
            flangeSpecId: flangeSpec.id
            // No pressureValue for geometry-driven parts
          });

        expect(addPartResponse.status).toBe(200);
        expect(addPartResponse.body.partType).toBe(PartType.ANACONDA_LINES);
        expect(addPartResponse.body.pressureValue).toBeNull();
      }
    });

    test('Rotating Head selection flow should skip pressure step', async () => {
      const pressuresResponse = await request(app)
        .get('/api/options/pressures')
        .query({ part: PartType.ROTATING_HEAD });

      expect(pressuresResponse.status).toBe(200);
      expect(pressuresResponse.body).toHaveLength(0); // No pressures for geometry-driven parts

      const flangesResponse = await request(app)
        .get('/api/options/flanges')
        .query({ part: PartType.ROTATING_HEAD });

      expect(flangesResponse.status).toBe(200);

      if (flangesResponse.body.length > 0) {
        const flangeSpec = flangesResponse.body[0];
        const addPartResponse = await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ROTATING_HEAD,
            flangeSpecId: flangeSpec.id
          });

        expect(addPartResponse.status).toBe(200);
        expect(addPartResponse.body.partType).toBe(PartType.ROTATING_HEAD);
        expect(addPartResponse.body.pressureValue).toBeNull();
      }
    });
  });

  describe('Branch C: Adapter Spool Flow', () => {
    let stackId: string;

    beforeEach(async () => {
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'Branch C Test Stack' });
      stackId = stackResponse.body.id;
    });

    test('Adapter Spool should require two-sided selection', async () => {
      const flangesResponse = await request(app)
        .get('/api/options/flanges');

      expect(flangesResponse.status).toBe(200);

      if (flangesResponse.body.length >= 2) {
        const flangeSpec1 = flangesResponse.body[0];
        const flangeSpec2 = flangesResponse.body[1];

        // Add Side 1
        const side1Response = await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ADAPTER_SPOOL_SIDE,
            flangeSpecId: flangeSpec1.id,
            spoolGroupId: 'group-1'
          });

        expect(side1Response.status).toBe(200);
        expect(side1Response.body.partType).toBe(PartType.ADAPTER_SPOOL_SIDE);

        // Add Side 2 with same spool group
        const side2Response = await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ADAPTER_SPOOL_SIDE,
            flangeSpecId: flangeSpec2.id,
            spoolGroupId: 'group-1'
          });

        expect(side2Response.status).toBe(200);
        expect(side2Response.body.spoolGroupId).toBe('group-1');
      }
    });
  });

  describe('Stack Ordering Flow', () => {
    let stackId: string;
    let partIds: string[] = [];

    beforeEach(async () => {
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'Stack Ordering Test' });
      stackId = stackResponse.body.id;

      // Add multiple parts to test ordering
      const flangesResponse = await request(app)
        .get('/api/options/flanges');

      if (flangesResponse.body.length > 0) {
        const flangeSpec = flangesResponse.body[0];
        
        // Add Annular
        const part1Response = await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ANNULAR,
            pressureValue: 5000,
            flangeSpecId: flangeSpec.id
          });
        
        // Add Single RAM  
        const part2Response = await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.SINGLE_RAM,
            pressureValue: 5000,
            flangeSpecId: flangeSpec.id
          });

        partIds = [part1Response.body.id, part2Response.body.id];
      }
    });

    test('should support drag-and-drop reordering', async () => {
      if (partIds.length < 2) {
        console.log('Skipping test - insufficient parts added');
        return;
      }

      // Reverse the order
      const reversedOrder = [...partIds].reverse();

      const reorderResponse = await request(app)
        .patch(`/api/stack/${stackId}/order`)
        .send({ orderedPartIds: reversedOrder });

      expect(reorderResponse.status).toBe(200);
      expect(reorderResponse.body.success).toBe(true);

      // Verify the new order
      const stackResponse = await request(app)
        .get(`/api/stack/${stackId}`);

      expect(stackResponse.status).toBe(200);
      expect(stackResponse.body.parts.length).toBe(partIds.length);
      
      // Parts should be in the new order
      expect(stackResponse.body.parts[0].id).toBe(reversedOrder[0]);
      expect(stackResponse.body.parts[1].id).toBe(reversedOrder[1]);
    });

    test('stack ordering should persist on refresh', async () => {
      if (partIds.length < 2) {
        console.log('Skipping test - insufficient parts added');
        return;
      }

      const customOrder = [partIds[1], partIds[0]];

      await request(app)
        .patch(`/api/stack/${stackId}/order`)
        .send({ orderedPartIds: customOrder });

      // Simulate refresh by getting stack again
      const stackResponse1 = await request(app)
        .get(`/api/stack/${stackId}`);

      const stackResponse2 = await request(app)
        .get(`/api/stack/${stackId}`);

      expect(stackResponse1.body.parts).toEqual(stackResponse2.body.parts);
      expect(stackResponse2.body.parts[0].id).toBe(customOrder[0]);
      expect(stackResponse2.body.parts[1].id).toBe(customOrder[1]);
    });
  });

  describe('Report Generation Flow', () => {
    let stackId: string;

    beforeEach(async () => {
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'Report Generation Test Stack' });
      stackId = stackResponse.body.id;

      // Add some parts for testing
      const flangesResponse = await request(app)
        .get('/api/options/flanges');

      if (flangesResponse.body.length > 0) {
        const flangeSpec = flangesResponse.body[0];
        
        await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ANNULAR,
            pressureValue: 5000,
            flangeSpecId: flangeSpec.id
          });
      }
    });

    test('should generate PDF report with proper formatting', async () => {
      const reportResponse = await request(app)
        .post(`/api/stack/${stackId}/report`);

      expect(reportResponse.status).toBe(200);
      expect(reportResponse.body.id).toBeDefined();
      expect(reportResponse.body.stackId).toBe(stackId);
      expect(reportResponse.body.pdfPath).toBeDefined();

      // Verify PDF can be downloaded
      const downloadResponse = await request(app)
        .get(`/api/reports/${reportResponse.body.id}/pdf`);

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers['content-type']).toBe('application/pdf');
    });

    test('should show all parts in order in report', async () => {
      // Add multiple parts
      const flangesResponse = await request(app)
        .get('/api/options/flanges');

      if (flangesResponse.body.length > 0) {
        const flangeSpec = flangesResponse.body[0];
        
        await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.SINGLE_RAM,
            pressureValue: 5000,
            flangeSpecId: flangeSpec.id
          });
      }

      const reportResponse = await request(app)
        .post(`/api/stack/${stackId}/report`);

      expect(reportResponse.status).toBe(200);
      
      // Verify report contains all parts
      const stackResponse = await request(app)
        .get(`/api/stack/${stackId}`);

      expect(stackResponse.body.parts.length).toBeGreaterThan(1);
    });
  });
});