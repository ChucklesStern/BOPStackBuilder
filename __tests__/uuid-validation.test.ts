/**
 * UUID Validation Tests
 */

import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../server/routes';

describe('UUID Validation', () => {
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

  describe('Path Parameter Validation', () => {
    test('should reject invalid UUID in stack ID parameter', async () => {
      const response = await request(app)
        .get('/api/stack/invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid UUID format');
      expect(response.body.error).toContain('id');
      expect(response.body.received).toBe('invalid-uuid');
    });

    test('should reject invalid UUID in report ID parameter', async () => {
      const response = await request(app)
        .get('/api/reports/not-a-uuid/pdf');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid UUID format');
      expect(response.body.error).toContain('reportId');
    });

    test('should accept valid UUID in stack ID parameter', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440002';
      
      const response = await request(app)
        .get(`/api/stack/${validUUID}`);

      // Should pass UUID validation and proceed to actual route logic
      // (may return 404 if stack doesn't exist, but shouldn't be 400)
      expect(response.status).not.toBe(400);
    });

    test('should reject malformed UUID with correct length', async () => {
      const malformedUUID = '550e8400-e29b-41d4-a716-44665544000g'; // 'g' is not valid hex
      
      const response = await request(app)
        .get(`/api/stack/${malformedUUID}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid UUID format');
    });

    test('should reject UUID with wrong version', async () => {
      const wrongVersionUUID = '550e8400-e29b-41d4-6716-446655440002'; // version 6 instead of 4
      
      const response = await request(app)
        .post(`/api/stack/${wrongVersionUUID}/items`)
        .send({
          partType: 'ANNULAR',
          pressureValue: 5000,
          flangeSpecId: '550e8400-e29b-41d4-a716-446655440001'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid UUID format');
    });
  });

  describe('Request Body UUID Validation', () => {
    test('should reject invalid flangeSpecId in part creation', async () => {
      const validStackId = '550e8400-e29b-41d4-a716-446655440002';
      
      const response = await request(app)
        .post(`/api/stack/${validStackId}/items`)
        .send({
          partType: 'ANNULAR',
          pressureValue: 5000,
          flangeSpecId: 'invalid-uuid' // Invalid UUID
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid part data');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.some((detail: any) => 
        detail.path.includes('flangeSpecId') && detail.message.includes('Invalid UUID')
      )).toBe(true);
    });

    test('should reject invalid UUID in report creation', async () => {
      const invalidStackId = 'not-a-uuid';
      
      const response = await request(app)
        .post(`/api/stack/${invalidStackId}/report`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid UUID format');
    });
  });

  describe('Multiple UUID Parameters', () => {
    test('should validate both stackId and partId in deletion endpoint', async () => {
      const invalidStackId = 'invalid-stack-id';
      const validPartId = '550e8400-e29b-41d4-a716-446655440003';
      
      const response = await request(app)
        .delete(`/api/stack/${invalidStackId}/items/${validPartId}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid UUID format');
      expect(response.body.error).toContain('stackId');
    });

    test('should validate second UUID parameter when first is valid', async () => {
      const validStackId = '550e8400-e29b-41d4-a716-446655440002';
      const invalidPartId = 'invalid-part-id';
      
      const response = await request(app)
        .delete(`/api/stack/${validStackId}/items/${invalidPartId}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid UUID format');
      expect(response.body.error).toContain('partId');
    });
  });
});