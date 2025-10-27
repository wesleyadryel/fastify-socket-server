import { EventParameter } from './index';

export const defaultSubscribers = [
  {
    eventListener: 'TEST-EVENT',
    replicable: true,
    includeSender: true,
    description: 'Default test subscriber for development'
  },

  
  // {
  //   eventListener: 'chat:message',
  //   replicable: true,
  //   includeSender: false,
  //   description: 'Chat message event subscriber',
  //   parameters: [
  //     {
  //       name: 'message',
  //       type: 'string' as const,
  //       required: true,
  //       sanitize: true,
  //       maxLength: 1000
  //     },
  //     {
  //       name: 'userUuid',
  //       type: 'string' as const,
  //       required: true,
  //       sanitize: true,
  //       pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  //     },
  //     {
  //       name: 'roomId',
  //       type: 'string' as const,
  //       required: false,
  //       sanitize: true,
  //       maxLength: 100
  //     }
  //   ]
  // },
];

export interface DefaultSubscriberConfig {
  eventListener: string;
  replicable: boolean;
  includeSender: boolean;
  description?: string;
  parameters?: EventParameter[];
}

