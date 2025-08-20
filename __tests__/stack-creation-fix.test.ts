import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../server/routes';

describe('Stack Creation Fix - Debugging Issue', () => {
  let app: express.Express;
  let stackId: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    registerRoutes(app);
  });

  afterEach(async () => {
    // Clean up created stack
    if (stackId) {
      await request(app).delete(`/api/stack/${stackId}`);
    }
  });

  it('should create stack and immediately allow adding parts', async () => {
    // Step 1: Create a new stack
    const createStackResponse = await request(app)
      .post('/api/stack')
      .send({ title: 'Test B.O.P Stack' });

    expect(createStackResponse.status).toBe(200);
    stackId = createStackResponse.body.id;
    console.log('DEBUG: Stack created with ID:', stackId);

    // Step 2: Immediately try to add a part to the newly created stack
    const addPartResponse = await request(app)
      .post(`/api/stack/${stackId}/items`)
      .send({
        partType: 'DOUBLE_RAMS',
        flangeSpecId: '550e8400-e29b-41d4-a716-446655440001',
        pressureValue: 3000
      });

    console.log('DEBUG: Add part response status:', addPartResponse.status);
    console.log('DEBUG: Add part response body:', addPartResponse.body);

    expect(addPartResponse.status).toBe(200);
    expect(addPartResponse.body).toHaveProperty('id');
    expect(addPartResponse.body.partType).toBe('DOUBLE_RAMS');

    // Step 3: Verify the stack now contains the part
    const getStackResponse = await request(app)
      .get(`/api/stack/${stackId}`);

    expect(getStackResponse.status).toBe(200);
    expect(getStackResponse.body.parts).toHaveLength(1);
    expect(getStackResponse.body.parts[0].partType).toBe('DOUBLE_RAMS');
    
    console.log('DEBUG: Stack with parts verified successfully');
  });

  it('should handle the exact scenario from the debug logs', async () => {
    // Simulate the exact flow: Create stack, then add DOUBLE_RAMS part
    console.log('DEBUG: Testing exact scenario from debug logs');

    // Create stack
    const createResponse = await request(app)
      .post('/api/stack')
      .send({ title: 'B.O.P Stack' });

    stackId = createResponse.body.id;
    console.log('DEBUG: Stack created, currentStack should now exist:', stackId);

    // Add the exact part from the debug logs
    const partData = {
      partType: 'DOUBLE_RAMS',
      flangeSpecId: '550e8400-e29b-41d4-a716-446655440001',
      pressureValue: 3000
    };

    console.log('DEBUG: Adding part with data:', partData);

    const addResponse = await request(app)
      .post(`/api/stack/${stackId}/items`)
      .send(partData);

    expect(addResponse.status).toBe(200);
    console.log('DEBUG: Part added successfully, no "No current stack available" error');
  });
});