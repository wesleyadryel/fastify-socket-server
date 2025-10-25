import app from '../src/server/index';
import { generateTestToken } from './jwt-util';

const API_TOKEN = process.env.API_TOKEN || 'test-api-token';

describe('Subscriber API', () => {
  let subscriberId: string;

  it('should create a new subscriber', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/subscribers',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: {
        eventListener: 'testEvent',
        replicable: true,
        description: 'Test subscriber for testing purposes'
      }
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.eventListener).toBe('testEvent');
    expect(data.replicable).toBe(true);
    expect(data.description).toBe('Test subscriber for testing purposes');
    expect(data.id).toBeDefined();
    expect(data.message).toBe('Subscriber created successfully');
    expect(data.wasUpdated).toBe(false);
    
    subscriberId = data.id;
  });

  it('should get all subscribers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/subscribers',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('should get subscriber by ID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/subscribers/${subscriberId}`,
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.id).toBe(subscriberId);
    expect(data.eventListener).toBe('testEvent');
  });

  it('should update subscriber', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/subscribers/${subscriberId}`,
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: {
        description: 'Updated test subscriber',
        replicable: false
      }
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.id).toBe(subscriberId);
    expect(data.description).toBe('Updated test subscriber');
    expect(data.replicable).toBe(false);
  });

  it('should get subscribers by event', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/subscribers/event/testEvent',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].eventListener).toBe('testEvent');
  });

  it('should delete subscriber', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/subscribers/${subscriberId}`,
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.success).toBe(true);
  });

  it('should return 404 for non-existent subscriber', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/subscribers/non-existent-id',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    expect(response.statusCode).toBe(404);
  });

  it('should replace existing subscriber with same eventListener', async () => {
    const firstResponse = await app.inject({
      method: 'POST',
      url: '/subscribers',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: {
        eventListener: 'duplicateEvent',
        replicable: true,
        description: 'First subscriber'
      }
    });

    expect(firstResponse.statusCode).toBe(200);
    const firstData = JSON.parse(firstResponse.body);
    expect(firstData.message).toBe('Subscriber created successfully');
    expect(firstData.wasUpdated).toBe(false);

    const secondResponse = await app.inject({
      method: 'POST',
      url: '/subscribers',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: {
        eventListener: 'duplicateEvent',
        replicable: false,
        description: 'Second subscriber (should replace first)'
      }
    });

    expect(secondResponse.statusCode).toBe(200);
    const secondData = JSON.parse(secondResponse.body);
    expect(secondData.message).toBe('Subscriber updated (replaced existing subscriber with same eventListener)');
    expect(secondData.wasUpdated).toBe(true);
    expect(secondData.description).toBe('Second subscriber (should replace first)');
    expect(secondData.replicable).toBe(false);

    const subscribersResponse = await app.inject({
      method: 'GET',
      url: '/subscribers/event/duplicateEvent',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    expect(subscribersResponse.statusCode).toBe(200);
    const subscribers = JSON.parse(subscribersResponse.body);
    expect(subscribers.length).toBe(1);
    expect(subscribers[0].description).toBe('Second subscriber (should replace first)');
  });

  it('should delete all subscribers', async () => {
    await app.inject({
      method: 'POST',
      url: '/subscribers',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: {
        eventListener: 'event1',
        replicable: true,
        description: 'First subscriber'
      }
    });

    await app.inject({
      method: 'POST',
      url: '/subscribers',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: {
        eventListener: 'event2',
        replicable: false,
        description: 'Second subscriber'
      }
    });

    const beforeResponse = await app.inject({
      method: 'GET',
      url: '/subscribers',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    expect(beforeResponse.statusCode).toBe(200);
    const beforeData = JSON.parse(beforeResponse.body);
    expect(beforeData.length).toBeGreaterThan(0);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/subscribers',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    expect(deleteResponse.statusCode).toBe(200);
    const deleteData = JSON.parse(deleteResponse.body);
    expect(deleteData.success).toBe(true);
    expect(deleteData.deletedCount).toBeGreaterThan(0);
    expect(deleteData.message).toContain('Successfully deleted');

    const afterResponse = await app.inject({
      method: 'GET',
      url: '/subscribers',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    expect(afterResponse.statusCode).toBe(200);
    const afterData = JSON.parse(afterResponse.body);
    expect(afterData.length).toBe(0);
  });
});
