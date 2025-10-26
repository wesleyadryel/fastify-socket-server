// Room API Schemas
export const roomSchemas = {
  createRoom: {
    description: 'Create a new room',
    summary: 'Create Room',
    tags: ['Room Management'],
    body: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Custom room ID (optional)' },
        name: { type: 'string', description: 'Room name' },
        description: { type: 'string', description: 'Room description' },
        allowSelfJoin: { type: 'boolean', description: 'Allow users to join without approval' },
        maxMembers: { type: 'number', description: 'Maximum number of members' },
        isPrivate: { type: 'boolean', description: 'Is room private' },
        userUuid: { type: 'string', description: 'User UUID for room creator (optional)' }
      },
      required: ['name']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              allowSelfJoin: { type: 'boolean' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
              maxMembers: { type: 'number' },
              isPrivate: { type: 'boolean' },
              members: { type: 'array', items: { type: 'string' } }
            }
          },
          message: { type: 'string' }
        }
      },
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              allowSelfJoin: { type: 'boolean' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
              maxMembers: { type: 'number' },
              isPrivate: { type: 'boolean' },
              members: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  },

  getAllRooms: {
    description: 'Get all rooms',
    summary: 'Get All Rooms',
    tags: ['Room Management'],
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                allowSelfJoin: { type: 'boolean' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                maxMembers: { type: 'number' },
                isPrivate: { type: 'boolean' },
                members: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
  },

  getRoom: {
    description: 'Get a specific room by ID',
    summary: 'Get Room',
    tags: ['Room Management'],
    params: {
      type: 'object',
      properties: {
        roomId: { type: 'string', description: 'Room ID' }
      },
      required: ['roomId']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              allowSelfJoin: { type: 'boolean' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
              maxMembers: { type: 'number' },
              isPrivate: { type: 'boolean' },
              members: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  },

  deleteRoom: {
    description: 'Delete a room',
    summary: 'Delete Room',
    tags: ['Room Management'],
    params: {
      type: 'object',
      properties: {
        roomId: { type: 'string', description: 'Room ID' }
      },
      required: ['roomId']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' }
        }
      }
    }
  },

  getRoomMembers: {
    description: 'Get room members',
    summary: 'Get Room Members',
    tags: ['Room Management'],
    params: {
      type: 'object',
      properties: {
        roomId: { type: 'string', description: 'Room ID' }
      },
      required: ['roomId']
    },
    querystring: {
      type: 'object',
      properties: {
        forceCreate: { 
          type: 'boolean', 
          description: 'Force create room if it does not exist',
          default: false
        }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              members: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  },

  addRoomMember: {
    description: 'Add member to room',
    summary: 'Add Room Member',
    tags: ['Room Management'],
    params: {
      type: 'object',
      properties: {
        roomId: { type: 'string', description: 'Room ID' }
      },
      required: ['roomId']
    },
    body: {
      type: 'object',
      properties: {
        forceCreate: { 
          type: 'boolean', 
          description: 'Force create room if it does not exist',
          default: false
        },
        userUuid: { type: ['string', 'number'] , description: 'User UUID to add' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' }
        }
      }
    }
  },

  removeRoomMember: {
    description: 'Remove member from room',
    summary: 'Remove Room Member',
    tags: ['Room Management'],
    params: {
      type: 'object',
      properties: {
        roomId: { type: 'string', description: 'Room ID' },
        userUuid: { type: 'string', description: 'User UUID to remove' }
      },
      required: ['roomId', 'userUuid']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' }
        }
      }
    }
  },

  checkRoomAccess: {
    description: 'Check if user can join room',
    summary: 'Check Room Access',
    tags: ['Room Management'],
    params: {
      type: 'object',
      properties: {
        roomId: { type: 'string', description: 'Room ID' }
      },
      required: ['roomId']
    },
    body: {
      type: 'object',
      properties: {
        userUuid: { type: 'string', description: 'User UUID' }
      },
      required: ['userUuid']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              canJoin: { type: 'boolean' },
              reason: { type: 'string' }
            }
          }
        }
      }
    }
  }
};
