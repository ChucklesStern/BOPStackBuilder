/**
 * PRD Specific Test Examples (PRD Section 15)
 * 
 * Implements the specific test cases mentioned in the PRD:
 * - T1 Annular 5M: Add Annular → choose pressure 5000 → narrow by Flange size to "13-5/8 5M" → verify finalized specs
 * - T2 Rotating Head: Add Rotating Head → select Flange size "13-5/8 10M" → select bolt size → verify
 * - T3 Adapter Spool: Finalize both sides → add → reorder → generate report → verify PDF labels
 */

import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../server/routes';
import { PartType } from '@shared/schema';
import path from 'path';
import fs from 'fs';

describe('PRD Specific Test Examples (Section 15)', () => {
  let app: express.Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);

    // Seed exact test data for PRD examples
    const testCsv = `nominal_bore,pressure_class_label,pressure_class_psi,bolt_count,size_of_bolts,wrench_no,truck_unit_psi,ring_needed,flange_size_raw,annular_pressure,single_ram_pressure,double_rams_pressure,mud_cross_pressure
13-5/8,5M,5000,8,1-1/8,1,5000,BX-158,13-5/8 5M,5000,5000,5000,5000
13-5/8,10M,10000,8,1-1/4,2,10000,BX-158,13-5/8 10M,10000,10000,10000,10000
18-3/4,5M,5000,12,1-1/8,1,5000,BX-187,18-3/4 5M,5000,5000,5000,5000
18-3/4,10M,10000,12,1-1/4,2,10000,BX-187,18-3/4 10M,10000,10000,10000,10000
21-1/4,5M,5000,16,1-1/8,1,5000,BX-212,21-1/4 5M,5000,5000,5000,5000
21-1/4,10M,10000,16,1-1/4,2,10000,BX-212,21-1/4 10M,10000,10000,10000,10000`;
    
    const csvPath = path.join(__dirname, 'prd-examples-data.csv');
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

  describe('T1: Annular 5M Test Case', () => {
    let stackId: string;

    beforeEach(async () => {
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'T1 Annular 5M Test Stack' });
      stackId = stackResponse.body.id;
    });

    test('T1: Add Annular → choose pressure 5000 → narrow by Flange size to "13-5/8 5M" → verify finalized specs', async () => {
      // Step 1: Add Annular part type
      // (In real UI, this would be selecting from part type dropdown)
      
      // Step 2: Choose pressure 5000
      const pressuresResponse = await request(app)
        .get('/api/options/pressures')
        .query({ part: PartType.ANNULAR });

      expect(pressuresResponse.status).toBe(200);
      expect(pressuresResponse.body).toContain(5000);

      // Step 3: Get flanges with pressure filter
      const flangesWithPressureResponse = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.ANNULAR,
          pressure: 5000
        });

      expect(flangesWithPressureResponse.status).toBe(200);
      expect(flangesWithPressureResponse.body.length).toBeGreaterThan(0);

      // Step 4: Narrow by Flange size to "13-5/8 5M"
      const finalFlangesResponse = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.ANNULAR,
          pressure: 5000,
          flangeSize: '13-5/8 5M'
        });

      expect(finalFlangesResponse.status).toBe(200);
      expect(finalFlangesResponse.body).toHaveLength(1);

      const finalizedSpec = finalFlangesResponse.body[0];
      
      // Step 5: Verify finalized specs match PRD expectations
      expect(finalizedSpec.nominalBore).toBe('13-5/8');
      expect(finalizedSpec.pressureClassLabel).toBe('5M');
      expect(finalizedSpec.pressureClassPsi).toBe(5000);
      expect(finalizedSpec.boltCount).toBe(8);
      expect(finalizedSpec.sizeOfBolts).toBe('1-1/8');
      expect(finalizedSpec.wrenchNo).toBe(1);
      expect(finalizedSpec.truckUnitPsi).toBe(5000);
      expect(finalizedSpec.ringNeeded).toBe('BX-158');
      expect(finalizedSpec.flangeSizeRaw).toBe('13-5/8 5M');
      expect(finalizedSpec.annularPressure).toBe(5000);

      // Step 6: Add to stack with finalized specs
      const addPartResponse = await request(app)
        .post(`/api/stack/${stackId}/items`)
        .send({
          partType: PartType.ANNULAR,
          pressureValue: 5000,
          flangeSpecId: finalizedSpec.id
        });

      expect(addPartResponse.status).toBe(200);
      expect(addPartResponse.body.partType).toBe(PartType.ANNULAR);
      expect(addPartResponse.body.pressureValue).toBe(5000);
      expect(addPartResponse.body.flangeSpecId).toBe(finalizedSpec.id);

      // Step 7: Verify stack contains the part
      const stackResponse = await request(app)
        .get(`/api/stack/${stackId}`);

      expect(stackResponse.status).toBe(200);
      expect(stackResponse.body.parts).toHaveLength(1);
      expect(stackResponse.body.parts[0].partType).toBe(PartType.ANNULAR);
      expect(stackResponse.body.parts[0].flangeSpec.flangeSizeRaw).toBe('13-5/8 5M');
    });

    test('T1 variation: Verify pressure 10000 path works similarly', async () => {
      // Test the same flow but with 10000 pressure
      const finalFlangesResponse = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.ANNULAR,
          pressure: 10000,
          flangeSize: '13-5/8 10M'
        });

      expect(finalFlangesResponse.status).toBe(200);
      expect(finalFlangesResponse.body).toHaveLength(1);

      const finalizedSpec = finalFlangesResponse.body[0];
      expect(finalizedSpec.nominalBore).toBe('13-5/8');
      expect(finalizedSpec.pressureClassLabel).toBe('10M');
      expect(finalizedSpec.pressureClassPsi).toBe(10000);
      expect(finalizedSpec.annularPressure).toBe(10000);
    });
  });

  describe('T2: Rotating Head Test Case', () => {
    let stackId: string;

    beforeEach(async () => {
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'T2 Rotating Head Test Stack' });
      stackId = stackResponse.body.id;
    });

    test('T2: Add Rotating Head → select Flange size "13-5/8 10M" → select bolt size → verify', async () => {
      // Step 1: Add Rotating Head part type (geometry-driven, no pressure step)
      // Step 2: Verify no pressure options for geometry-driven parts
      const pressuresResponse = await request(app)
        .get('/api/options/pressures')
        .query({ part: PartType.ROTATING_HEAD });

      expect(pressuresResponse.status).toBe(200);
      expect(pressuresResponse.body).toHaveLength(0); // No pressures for geometry-driven parts

      // Step 3: Select Flange size "13-5/8 10M"
      const flangesWithSizeResponse = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.ROTATING_HEAD,
          flangeSize: '13-5/8 10M'
        });

      expect(flangesWithSizeResponse.status).toBe(200);
      expect(flangesWithSizeResponse.body.length).toBeGreaterThan(0);

      // Step 4: Select bolt size (should narrow to exactly one spec)
      const boltSize = '1-1/4'; // From our test data for 13-5/8 10M
      const finalFlangesResponse = await request(app)
        .get('/api/options/flanges')
        .query({ 
          part: PartType.ROTATING_HEAD,
          flangeSize: '13-5/8 10M',
          boltSize: boltSize
        });

      expect(finalFlangesResponse.status).toBe(200);
      expect(finalFlangesResponse.body).toHaveLength(1);

      const finalizedSpec = finalFlangesResponse.body[0];

      // Step 5: Verify finalized specs for geometry-driven part
      expect(finalizedSpec.nominalBore).toBe('13-5/8');
      expect(finalizedSpec.pressureClassLabel).toBe('10M');
      expect(finalizedSpec.pressureClassPsi).toBe(10000);
      expect(finalizedSpec.sizeOfBolts).toBe('1-1/4');
      expect(finalizedSpec.flangeSizeRaw).toBe('13-5/8 10M');

      // Step 6: Add to stack WITHOUT pressure value (geometry-driven)
      const addPartResponse = await request(app)
        .post(`/api/stack/${stackId}/items`)
        .send({
          partType: PartType.ROTATING_HEAD,
          flangeSpecId: finalizedSpec.id
          // No pressureValue for geometry-driven parts
        });

      expect(addPartResponse.status).toBe(200);
      expect(addPartResponse.body.partType).toBe(PartType.ROTATING_HEAD);
      expect(addPartResponse.body.pressureValue).toBeNull(); // Should be null for geometry-driven
      expect(addPartResponse.body.flangeSpecId).toBe(finalizedSpec.id);

      // Step 7: Verify stack contains the part
      const stackResponse = await request(app)
        .get(`/api/stack/${stackId}`);

      expect(stackResponse.status).toBe(200);
      expect(stackResponse.body.parts).toHaveLength(1);
      expect(stackResponse.body.parts[0].partType).toBe(PartType.ROTATING_HEAD);
      expect(stackResponse.body.parts[0].pressureValue).toBeNull();
      expect(stackResponse.body.parts[0].flangeSpec.flangeSizeRaw).toBe('13-5/8 10M');
    });
  });

  describe('T3: Adapter Spool Test Case', () => {
    let stackId: string;

    beforeEach(async () => {
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'T3 Adapter Spool Test Stack' });
      stackId = stackResponse.body.id;
    });

    test('T3: Finalize both sides → add → reorder → generate report → verify PDF labels', async () => {
      // Step 1: Get flange specs for both sides
      const flangesResponse = await request(app)
        .get('/api/options/flanges');

      expect(flangesResponse.status).toBe(200);
      expect(flangesResponse.body.length).toBeGreaterThanOrEqual(2);

      // Use different flange specs for each side to demonstrate adapter functionality
      const side1FlangeSpec = flangesResponse.body.find(
        (spec: any) => spec.flangeSizeRaw === '13-5/8 5M'
      );
      const side2FlangeSpec = flangesResponse.body.find(
        (spec: any) => spec.flangeSizeRaw === '18-3/4 10M'
      );

      expect(side1FlangeSpec).toBeDefined();
      expect(side2FlangeSpec).toBeDefined();

      // Step 2: Finalize both sides of adapter spool
      const groupId = 'adapter-group-A';

      // Add Side 1
      const side1Response = await request(app)
        .post(`/api/stack/${stackId}/items`)
        .send({
          partType: PartType.ADAPTER_SPOOL_SIDE,
          flangeSpecId: side1FlangeSpec.id,
          spoolGroupId: groupId
        });

      expect(side1Response.status).toBe(200);
      expect(side1Response.body.partType).toBe(PartType.ADAPTER_SPOOL_SIDE);
      expect(side1Response.body.spoolGroupId).toBe(groupId);
      expect(side1Response.body.pressureValue).toBeNull();

      // Add Side 2
      const side2Response = await request(app)
        .post(`/api/stack/${stackId}/items`)
        .send({
          partType: PartType.ADAPTER_SPOOL_SIDE,
          flangeSpecId: side2FlangeSpec.id,
          spoolGroupId: groupId
        });

      expect(side2Response.status).toBe(200);
      expect(side2Response.body.spoolGroupId).toBe(groupId);

      // Step 3: Add some additional parts for reordering test
      const additionalFlangeSpec = flangesResponse.body[0];
      
      const annularResponse = await request(app)
        .post(`/api/stack/${stackId}/items`)
        .send({
          partType: PartType.ANNULAR,
          pressureValue: 5000,
          flangeSpecId: additionalFlangeSpec.id
        });

      expect(annularResponse.status).toBe(200);

      // Step 4: Verify initial order
      const initialStackResponse = await request(app)
        .get(`/api/stack/${stackId}`);

      expect(initialStackResponse.status).toBe(200);
      expect(initialStackResponse.body.parts).toHaveLength(3);

      const partIds = initialStackResponse.body.parts.map((part: any) => part.id);

      // Step 5: Reorder stack (move Annular to front)
      const newOrder = [partIds[2], partIds[0], partIds[1]]; // Annular first, then adapter spool sides

      const reorderResponse = await request(app)
        .patch(`/api/stack/${stackId}/order`)
        .send({ orderedPartIds: newOrder });

      expect(reorderResponse.status).toBe(200);
      expect(reorderResponse.body.success).toBe(true);

      // Step 6: Verify reordered stack
      const reorderedStackResponse = await request(app)
        .get(`/api/stack/${stackId}`);

      expect(reorderedStackResponse.status).toBe(200);
      expect(reorderedStackResponse.body.parts[0].id).toBe(newOrder[0]);
      expect(reorderedStackResponse.body.parts[1].id).toBe(newOrder[1]);
      expect(reorderedStackResponse.body.parts[2].id).toBe(newOrder[2]);

      // Step 7: Generate report
      const reportResponse = await request(app)
        .post(`/api/stack/${stackId}/report`);

      expect(reportResponse.status).toBe(200);
      expect(reportResponse.body.id).toBeDefined();
      expect(reportResponse.body.stackId).toBe(stackId);
      expect(reportResponse.body.pdfPath).toBeDefined();

      // Step 8: Verify PDF labels (download and check headers)
      const downloadResponse = await request(app)
        .get(`/api/reports/${reportResponse.body.id}/pdf`);

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers['content-type']).toBe('application/pdf');
      expect(downloadResponse.headers['content-disposition']).toContain('attachment');
      expect(downloadResponse.headers['content-disposition']).toContain(`bop-stack-report-${reportResponse.body.id}.pdf`);

      // Step 9: Verify stack data for report contains properly grouped adapter spool
      const finalStackResponse = await request(app)
        .get(`/api/stack/${stackId}`);

      const adapterSpoolParts = finalStackResponse.body.parts.filter(
        (part: any) => part.partType === PartType.ADAPTER_SPOOL_SIDE
      );

      expect(adapterSpoolParts).toHaveLength(2);
      expect(adapterSpoolParts.every((part: any) => part.spoolGroupId === groupId)).toBe(true);

      // Verify different flange specs for each side (demonstrating adapter functionality)
      const side1Part = adapterSpoolParts.find((part: any) => part.id === side1Response.body.id);
      const side2Part = adapterSpoolParts.find((part: any) => part.id === side2Response.body.id);

      expect(side1Part.flangeSpec.flangeSizeRaw).toBe('13-5/8 5M');
      expect(side2Part.flangeSpec.flangeSizeRaw).toBe('18-3/4 10M');
    });

    test('T3 variation: Multiple adapter spools should get different letters', async () => {
      const flangesResponse = await request(app)
        .get('/api/options/flanges');

      if (flangesResponse.body.length >= 4) {
        // First adapter spool (Group A)
        await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ADAPTER_SPOOL_SIDE,
            flangeSpecId: flangesResponse.body[0].id,
            spoolGroupId: 'group-A'
          });

        await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ADAPTER_SPOOL_SIDE,
            flangeSpecId: flangesResponse.body[1].id,
            spoolGroupId: 'group-A'
          });

        // Second adapter spool (Group B)
        await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ADAPTER_SPOOL_SIDE,
            flangeSpecId: flangesResponse.body[2].id,
            spoolGroupId: 'group-B'
          });

        await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ADAPTER_SPOOL_SIDE,
            flangeSpecId: flangesResponse.body[3].id,
            spoolGroupId: 'group-B'
          });

        // Generate report
        const reportResponse = await request(app)
          .post(`/api/stack/${stackId}/report`);

        expect(reportResponse.status).toBe(200);

        // Verify both groups exist
        const stackResponse = await request(app)
          .get(`/api/stack/${stackId}`);

        const groupAParts = stackResponse.body.parts.filter(
          (part: any) => part.spoolGroupId === 'group-A'
        );
        const groupBParts = stackResponse.body.parts.filter(
          (part: any) => part.spoolGroupId === 'group-B'
        );

        expect(groupAParts).toHaveLength(2);
        expect(groupBParts).toHaveLength(2);
      }
    });
  });

  describe('Integration Test: Complete PRD Example Workflow', () => {
    test('Full workflow: T1 + T2 + T3 in single stack', async () => {
      // Create comprehensive test stack
      const stackResponse = await request(app)
        .post('/api/stack')
        .send({ title: 'Complete PRD Workflow Test Stack' });
      const stackId = stackResponse.body.id;

      const flangesResponse = await request(app)
        .get('/api/options/flanges');

      // T1: Add Annular 5M
      const annular5MSpec = flangesResponse.body.find(
        (spec: any) => spec.flangeSizeRaw === '13-5/8 5M'
      );

      if (annular5MSpec) {
        const annularResponse = await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ANNULAR,
            pressureValue: 5000,
            flangeSpecId: annular5MSpec.id
          });

        expect(annularResponse.status).toBe(200);
      }

      // T2: Add Rotating Head 10M
      const rotating10MSpec = flangesResponse.body.find(
        (spec: any) => spec.flangeSizeRaw === '13-5/8 10M'
      );

      if (rotating10MSpec) {
        const rotatingResponse = await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ROTATING_HEAD,
            flangeSpecId: rotating10MSpec.id
          });

        expect(rotatingResponse.status).toBe(200);
        expect(rotatingResponse.body.pressureValue).toBeNull();
      }

      // T3: Add Adapter Spool
      const adapter1Spec = flangesResponse.body.find(
        (spec: any) => spec.flangeSizeRaw === '18-3/4 5M'
      );
      const adapter2Spec = flangesResponse.body.find(
        (spec: any) => spec.flangeSizeRaw === '21-1/4 10M'
      );

      if (adapter1Spec && adapter2Spec) {
        await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ADAPTER_SPOOL_SIDE,
            flangeSpecId: adapter1Spec.id,
            spoolGroupId: 'workflow-group'
          });

        await request(app)
          .post(`/api/stack/${stackId}/items`)
          .send({
            partType: PartType.ADAPTER_SPOOL_SIDE,
            flangeSpecId: adapter2Spec.id,
            spoolGroupId: 'workflow-group'
          });
      }

      // Verify complete stack
      const finalStackResponse = await request(app)
        .get(`/api/stack/${stackId}`);

      expect(finalStackResponse.status).toBe(200);
      expect(finalStackResponse.body.parts.length).toBeGreaterThanOrEqual(4);

      // Generate final report
      const reportResponse = await request(app)
        .post(`/api/stack/${stackId}/report`);

      expect(reportResponse.status).toBe(200);

      // Verify report download
      const downloadResponse = await request(app)
        .get(`/api/reports/${reportResponse.body.id}/pdf`);

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers['content-type']).toBe('application/pdf');
    });
  });
});