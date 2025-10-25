import { randomUUID } from 'crypto';

export interface EventParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  sanitize: boolean;
  maxLength?: number;
  pattern?: string;
  allowedValues?: any[];
}

export interface Subscriber {
  id: string;
  eventListener: string;
  replicable: boolean;
  description?: string;
  parameters?: EventParameter[];
  validationSchema?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriberManager {
  subscribers: Map<string, Subscriber>;
  eventHandlers: Map<string, Set<string>>; // eventListener -> Set of subscriber IDs
}

class SubscriberService {
  private manager: SubscriberManager;

  constructor() {
    this.manager = {
      subscribers: new Map(),
      eventHandlers: new Map(),
    };
  }

  createSubscriber(data: Omit<Subscriber, 'id' | 'createdAt' | 'updatedAt'>): Subscriber {
    const existingSubscriber = this.findSubscriberByEventListener(data.eventListener);
    
    if (existingSubscriber) {
      const updatedSubscriber = this.updateSubscriber(existingSubscriber.id, data);
      if (!updatedSubscriber) {
        throw new Error('Failed to update existing subscriber');
      }
      return updatedSubscriber;
    }

    const id = randomUUID();
    const now = new Date();
    
    const subscriber: Subscriber = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    this.manager.subscribers.set(id, subscriber);
    this.registerEventHandler(subscriber.eventListener, id);

    return subscriber;
  }

  updateSubscriber(id: string, data: Partial<Omit<Subscriber, 'id' | 'createdAt' | 'updatedAt'>>): Subscriber | null {
    const subscriber = this.manager.subscribers.get(id);
    if (!subscriber) {
      return null;
    }

    const updatedSubscriber: Subscriber = {
      ...subscriber,
      ...data,
      updatedAt: new Date(),
    };

    if (data.eventListener && data.eventListener !== subscriber.eventListener) {
      this.unregisterEventHandler(subscriber.eventListener, id);
      this.registerEventHandler(data.eventListener, id);
    }

    this.manager.subscribers.set(id, updatedSubscriber);
    return updatedSubscriber;
  }

  deleteSubscriber(id: string): boolean {
    const subscriber = this.manager.subscribers.get(id);
    if (!subscriber) {
      return false;
    }

    this.unregisterEventHandler(subscriber.eventListener, id);
    this.manager.subscribers.delete(id);
    return true;
  }

  getSubscriber(id: string): Subscriber | null {
    return this.manager.subscribers.get(id) || null;
  }

  getAllSubscribers(): Subscriber[] {
    return Array.from(this.manager.subscribers.values());
  }

  getSubscribersByEvent(eventListener: string): Subscriber[] {
    const subscriberIds = this.manager.eventHandlers.get(eventListener);
    if (!subscriberIds) {
      return [];
    }

    return Array.from(subscriberIds)
      .map(id => this.manager.subscribers.get(id))
      .filter((subscriber): subscriber is Subscriber => subscriber !== undefined);
  }

  findSubscriberByEventListener(eventListener: string): Subscriber | null {
    for (const subscriber of this.manager.subscribers.values()) {
      if (subscriber.eventListener === eventListener) {
        return subscriber;
      }
    }
    return null;
  }

  private registerEventHandler(eventListener: string, subscriberId: string): void {
    if (!this.manager.eventHandlers.has(eventListener)) {
      this.manager.eventHandlers.set(eventListener, new Set());
    }
    this.manager.eventHandlers.get(eventListener)!.add(subscriberId);
  }

  private unregisterEventHandler(eventListener: string, subscriberId: string): void {
    const handlers = this.manager.eventHandlers.get(eventListener);
    if (handlers) {
      handlers.delete(subscriberId);
      if (handlers.size === 0) {
        this.manager.eventHandlers.delete(eventListener);
      }
    }
  }

  getEventHandlers(): Map<string, Set<string>> {
    return new Map(this.manager.eventHandlers);
  }

  deleteAllSubscribers(): number {
    const count = this.manager.subscribers.size;
    
    this.manager.subscribers.clear();
    this.manager.eventHandlers.clear();
    
    return count;
  }
}

export const subscriberService = new SubscriberService();
