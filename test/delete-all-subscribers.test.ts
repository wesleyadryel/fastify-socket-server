import app from '../src/server/index';

const API_TOKEN = process.env.API_TOKEN || 'test-api-token';

describe('Delete All Subscribers', () => {
  it('should delete all subscribers successfully', async () => {
    const subscribers = [
      { eventListener: 'event1', replicable: true, description: 'First event' },
      { eventListener: 'event2', replicable: false, description: 'Second event' },
      { eventListener: 'event3', replicable: true, description: 'Third event' }
    ];

    for (const subscriber of subscribers) {
      await app.inject({
        method: 'POST',
        url: '/subscribers',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        payload: subscriber
      });
    }

    const beforeResponse = await app.inject({
      method: 'GET',
      url: '/subscribers',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    expect(beforeResponse.statusCode).toBe(200);
    const beforeData = JSON.parse(beforeResponse.body);
    expect(beforeData.length).toBe(3);

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
    expect(deleteData.deletedCount).toBe(3);
    expect(deleteData.message).toBe('Successfully deleted 3 subscribers');

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

  it('should handle deleting all subscribers when none exist', async () => {
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
    expect(deleteData.deletedCount).toBe(0);
    expect(deleteData.message).toBe('Successfully deleted 0 subscribers');
  });
});
