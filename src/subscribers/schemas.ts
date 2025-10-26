export const subscriberSchemas = {
  createSubscriber: {
    description: 'Create one or multiple event subscribers',
    summary: 'Create Subscribers',
    tags: ['Event Subscribers'],
    body: {
      oneOf: [
        {
          type: 'object',
          properties: {
            eventListener: { type: 'string', description: 'Event listener name' },
            replicable: { type: 'boolean', description: 'Whether the event should be replicated to other clients' },
            includeSender: { type: 'boolean', description: 'Whether the sender should also receive the replicated event' },
            description: { type: 'string', description: 'Optional description' }
          },
          required: ['eventListener']
        },
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              eventListener: { type: 'string', description: 'Event listener name' },
              replicable: { type: 'boolean', description: 'Whether the event should be replicated to other clients' },
              includeSender: { type: 'boolean', description: 'Whether the sender should also receive the replicated event' },
              description: { type: 'string', description: 'Optional description' }
            },
            required: ['eventListener']
          }
        }
      ]
    },
    response: {
      200: {
        oneOf: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              subscriber: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  eventListener: { type: 'string' },
                  replicable: { type: 'boolean' },
                  includeSender: { type: 'boolean' },
                  description: { type: 'string', nullable: true },
                  createdAt: { type: 'string' }
                }
              }
            }
          },
          {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              subscribers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    eventListener: { type: 'string' },
                    replicable: { type: 'boolean' },
                    includeSender: { type: 'boolean' },
                    description: { type: 'string', nullable: true },
                    createdAt: { type: 'string' }
                  }
                }
              }
            }
          }
        ]
      }
    }
  },

  createSubscriberWithValidation: {
    description: 'Create subscriber with parameter validation schema',
    summary: 'Create Subscriber with Validation',
    tags: ['Event Subscribers'],
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          subscriber: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              eventListener: { type: 'string' },
              replicable: { type: 'boolean' },
              includeSender: { type: 'boolean' },
              description: { type: 'string', nullable: true },
              parameters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    required: { type: 'boolean' },
                    sanitize: { type: 'boolean' }
                  }
                }
              },
              createdAt: { type: 'string' }
            }
          }
        }
      }
    }
  },

  getAllSubscribers: {
    description: 'Get all event subscribers',
    summary: 'Get All Subscribers',
    tags: ['Event Subscribers'],
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          subscribers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                eventListener: { type: 'string' },
                replicable: { type: 'boolean' },
                includeSender: { type: 'boolean' },
                description: { type: 'string', nullable: true },
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      type: { type: 'string' },
                      required: { type: 'boolean' },
                      sanitize: { type: 'boolean' }
                    }
                  }
                },
                createdAt: { type: 'string' }
              }
            }
          }
        }
      }
    }
  },

  getSubscriberById: {
    description: 'Get subscriber by ID',
    summary: 'Get Subscriber by ID',
    tags: ['Event Subscribers'],
    params: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          subscriber: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              eventListener: { type: 'string' },
              replicable: { type: 'boolean' },
              includeSender: { type: 'boolean' },
              description: { type: 'string', nullable: true },
              parameters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    required: { type: 'boolean' },
                    sanitize: { type: 'boolean' }
                  }
                }
              },
              createdAt: { type: 'string' }
            }
          }
        }
      }
    }
  },

  updateSubscriber: {
    description: 'Update subscriber by ID',
    summary: 'Update Subscriber',
    tags: ['Event Subscribers'],
    params: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          subscriber: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              eventListener: { type: 'string' },
              replicable: { type: 'boolean' },
              includeSender: { type: 'boolean' },
              description: { type: 'string', nullable: true },
              parameters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    required: { type: 'boolean' },
                    sanitize: { type: 'boolean' }
                  }
                }
              },
              createdAt: { type: 'string' }
            }
          }
        }
      }
    }
  },

  deleteSubscriber: {
    description: 'Delete subscriber by ID',
    summary: 'Delete Subscriber',
    tags: ['Event Subscribers'],
    params: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
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

  deleteAllSubscribers: {
    description: 'Delete all subscribers',
    summary: 'Delete All Subscribers',
    tags: ['Event Subscribers'],
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          deletedCount: { type: 'number' }
        }
      }
    }
  },

  getSubscriberByEvent: {
    description: 'Get subscriber by event listener name',
    summary: 'Get Subscriber by Event',
    tags: ['Event Subscribers'],
    params: {
      type: 'object',
      properties: {
        eventListener: { type: 'string' }
      },
      required: ['eventListener']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          subscriber: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              eventListener: { type: 'string' },
              replicable: { type: 'boolean' },
              includeSender: { type: 'boolean' },
              description: { type: 'string', nullable: true },
              parameters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    required: { type: 'boolean' },
                    sanitize: { type: 'boolean' }
                  }
                }
              },
              createdAt: { type: 'string' }
            }
          }
        }
      }
    }
  },

  emitServerEvent: {
    description: 'Emit an event to socket clients from the server',
    summary: 'Emit Server Event',
    tags: ['Server Events'],
    body: {
      type: 'object',
      properties: {
        eventName: { type: 'string', description: 'Name of the event to emit' },
        data: { type: 'object', description: 'Data to send with the event' },
        roomId: { type: 'string', description: 'Specific room ID (optional - if not provided, emits to all clients)' },
        emitToUser: {
          type: 'object',
          properties: {
            userUuid: { type: 'string', description: 'Target user by userUuid' }
          }
        },
        includeSender: { type: 'boolean', description: 'Whether to include the sender in the broadcast' }
      },
      required: ['eventName', 'data']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          eventName: { type: 'string' },
          roomId: { type: 'string', nullable: true },
          emitToUser: { type: 'object', nullable: true },
          clientsCount: { type: 'number' }
        }
      }
    }
  }
};

