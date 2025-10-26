import app from '../src/server/index';

describe('Server Tests', () => {
  afterAll(async () => {
    await app.close();
  });


  describe('Subscribers API', () => {
    const API_TOKEN = process.env.API_TOKEN || 'test-api-token';
    let subscriberId: string;

    it('should create a subscriber', async () => {
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
          description: 'Test subscriber'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.success).toBe(true);
      expect(data.subscriber).toHaveProperty('id');
      expect(data.subscriber.eventListener).toBe('testEvent');
      subscriberId = data.subscriber.id;
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
      expect(data.success).toBe(true);
      expect(Array.isArray(data.subscribers)).toBe(true);
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
      expect(data.subscriber.id).toBe(subscriberId);
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
  });

  describe('Rooms API', () => {
    const API_TOKEN = process.env.API_TOKEN || 'test-api-token';

    it('should get all rooms', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/rooms',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data) || typeof data === 'object').toBe(true);
    });
  });
});

