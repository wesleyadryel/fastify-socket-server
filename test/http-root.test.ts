import app from '../src/server/index';

describe('GET /', () => {
  it('should respond with Hello World!', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Hello World');
  });
});
