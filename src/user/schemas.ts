export const userSchemas = {
  getUserByToken: {
    summary: 'Get user data by JWT token (path parameter)',
    tags: ['User Management'],
    params: {
      type: 'object',
      properties: {
        token: { type: 'string' }
      },
      required: ['token']
    },
    response: {
      200: {
        type: 'object',
        additionalProperties: true
      }
    }
  },

  getUser: {
    description: 'Get user data by query parameters (token, userUuid, or userSource)',
    summary: 'Get User Data',
    tags: ['User Management'],
    querystring: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        userUuid: { type: 'string' },
        userSource: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        additionalProperties: true
      },
      400: {
        type: 'object',
        additionalProperties: true
      },
      404: {
        type: 'object',
        additionalProperties: true
      }
    }
  },

  deleteUser: {
    description: 'Disconnect user and remove from Redis by body parameters (token, userSource, or userUuid)',
    summary: 'Disconnect User',
    tags: ['User Management'],
    body: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        userSource: { type: 'string' },
        userUuid: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        additionalProperties: true
      },
      400: {
        type: 'object',
        additionalProperties: true
      },
      404: {
        type: 'object',
        additionalProperties: true
      }
    }
  },

  getSocketClient: {
    description: 'Get socket client object by user UUID using direct Redis lookup',
    summary: 'Get Socket Client by UUID',
    tags: ['User Management'],
    querystring: {
      type: 'object',
      properties: {
        userUuid: { type: 'string' }
      },
      required: ['userUuid']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          socketId: { type: ['string', 'null'] },
          isConnected: { type: 'boolean' },
          rooms: { type: 'array', items: { type: 'string' } },
          userData: { type: 'object', additionalProperties: true }
        }
      },
      404: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' }
        }
      }
    }
  }
};

