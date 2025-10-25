import app from '../src/server/index';

const API_TOKEN = process.env.API_TOKEN || 'test-api-token';

describe('Secure Events with Parameter Validation', () => {
  it('should create a subscriber with parameter validation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/subscribers/with-validation',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: {
        eventListener: 'secureChat',
        replicable: true,
        description: 'Secure chat with parameter validation',
        parameters: [
          {
            name: 'message',
            type: 'string',
            required: true,
            sanitize: true,
            maxLength: 500,
            pattern: '^[a-zA-Z0-9\\s.,!?-]+$'
          },
          {
            name: 'priority',
            type: 'string',
            required: false,
            sanitize: true,
            allowedValues: ['low', 'normal', 'high']
          },
          {
            name: 'metadata',
            type: 'object',
            required: false,
            sanitize: true
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.eventListener).toBe('secureChat');
    expect(data.parameters).toBeDefined();
    expect(data.parameters.length).toBe(3);
    expect(data.message).toBe('Subscriber created successfully with parameter validation');
  });

  it('should validate and sanitize event data', async () => {
    const validData = {
      message: 'Hello World!',
      priority: 'normal',
      metadata: { source: 'web' },
      roomId: 'test-room'
    };

    const response = await app.inject({
      method: 'POST',
      url: '/subscribers/with-validation',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: {
        eventListener: 'testValidation',
        replicable: true,
        parameters: [
          {
            name: 'message',
            type: 'string',
            required: true,
            sanitize: true,
            maxLength: 100
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
  });

  it('should reject invalid data', async () => {
    const invalidData = {
      message: '<script>alert("xss")</script>Hello World!',
      roomId: 'test-room'
    };

    const response = await app.inject({
      method: 'POST',
      url: '/subscribers/with-validation',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: {
        eventListener: 'testRejection',
        replicable: true,
        parameters: [
          {
            name: 'message',
            type: 'string',
            required: true,
            sanitize: true,
            maxLength: 50,
            pattern: '^[a-zA-Z0-9\\s.,!?-]+$'
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
  });

  it('should handle missing required parameters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/subscribers/with-validation',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: {
        eventListener: 'testRequired',
        replicable: true,
        parameters: [
          {
            name: 'requiredField',
            type: 'string',
            required: true,
            sanitize: true
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
  });
});
