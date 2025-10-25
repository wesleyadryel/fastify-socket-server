import app from '../src/server/index';

const API_TOKEN = process.env.API_TOKEN || 'test-api-token';

describe('Duplicate Subscriber Prevention', () => {
  it('should prevent duplicate subscribers and replace existing one', async () => {
    const eventListener = 'testDuplicateEvent';

    // Create first subscriber
    const firstResponse = await app.inject({
      method: 'POST',
      url: '/subscribers',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: {
        eventListener,
        replicable: true,
        description: 'First subscriber'
      }
    });

    expect(firstResponse.statusCode).toBe(200);
    const firstData = JSON.parse(firstResponse.body);
    expect(firstData.message).toBe('Subscriber created successfully');
    expect(firstData.wasUpdated).toBe(false);
    expect(firstData.replicable).toBe(true);

    // Try to create second subscriber with same eventListener
    const secondResponse = await app.inject({
      method: 'POST',
      url: '/subscribers',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: {
        eventListener,
        replicable: false,
        description: 'Second subscriber (should replace first)'
      }
    });

    expect(secondResponse.statusCode).toBe(200);
    const secondData = JSON.parse(secondResponse.body);
    expect(secondData.message).toBe('Subscriber updated (replaced existing subscriber with same eventListener)');
    expect(secondData.wasUpdated).toBe(true);
    expect(secondData.replicable).toBe(false);
    expect(secondData.description).toBe('Second subscriber (should replace first)');

    // Verify only one subscriber exists for this event
    const subscribersResponse = await app.inject({
      method: 'GET',
      url: `/subscribers/event/${eventListener}`,
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    expect(subscribersResponse.statusCode).toBe(200);
    const subscribers = JSON.parse(subscribersResponse.body);
    expect(subscribers.length).toBe(1);
    expect(subscribers[0].description).toBe('Second subscriber (should replace first)');
    expect(subscribers[0].replicable).toBe(false);
  });
});
