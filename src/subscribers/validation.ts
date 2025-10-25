import { z } from 'zod';
import { EventParameter } from './index';

export class EventDataValidator {
  static sanitizeString(value: string, param: EventParameter): string {
    if (!param.sanitize) return value;
    
    let sanitized = value;
    
    if (param.maxLength) {
      sanitized = sanitized.substring(0, param.maxLength);
    }
    
    if (param.pattern) {
      const regex = new RegExp(param.pattern);
      if (!regex.test(sanitized)) {
        throw new Error(`Parameter ${param.name} does not match required pattern`);
      }
    }
    
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
    
    return sanitized;
  }
  
  static sanitizeNumber(value: number, param: EventParameter): number {
    if (!param.sanitize) return value;
    
    if (param.allowedValues && !param.allowedValues.includes(value)) {
      throw new Error(`Parameter ${param.name} value not in allowed values`);
    }
    
    return Number(value);
  }
  
  static sanitizeBoolean(value: boolean, param: EventParameter): boolean {
    if (!param.sanitize) return value;
    
    return Boolean(value);
  }
  
  static sanitizeObject(value: any, param: EventParameter): any {
    if (!param.sanitize) return value;
    
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Parameter ${param.name} must be an object`);
    }
    
    const sanitized: any = {};
    for (const [key, val] of Object.entries(value)) {
      if (typeof key === 'string' && key.length <= 50) {
        if (typeof val === 'string') {
          sanitized[key] = this.sanitizeString(val, { ...param, name: key });
        } else {
          sanitized[key] = val;
        }
      }
    }
    
    return sanitized;
  }
  
  static sanitizeArray(value: any[], param: EventParameter): any[] {
    if (!param.sanitize) return value;
    
    if (!Array.isArray(value)) {
      throw new Error(`Parameter ${param.name} must be an array`);
    }
    
    if (param.maxLength && value.length > param.maxLength) {
      return value.slice(0, param.maxLength);
    }
    
    return value.map((item, index) => {
      if (typeof item === 'string') {
        return this.sanitizeString(item, { ...param, name: `${param.name}[${index}]` });
      }
      return item;
    });
  }
  
  static validateAndSanitizeData(data: any, parameters: EventParameter[]): any {
    const sanitizedData: any = {};
    
    for (const param of parameters) {
      const value = data[param.name];
      
      if (param.required && (value === undefined || value === null)) {
        throw new Error(`Required parameter ${param.name} is missing`);
      }
      
      if (value === undefined || value === null) {
        continue;
      }
      
      try {
        switch (param.type) {
          case 'string':
            if (typeof value !== 'string') {
              throw new Error(`Parameter ${param.name} must be a string`);
            }
            sanitizedData[param.name] = this.sanitizeString(value, param);
            break;
            
          case 'number':
            if (typeof value !== 'number') {
              throw new Error(`Parameter ${param.name} must be a number`);
            }
            sanitizedData[param.name] = this.sanitizeNumber(value, param);
            break;
            
          case 'boolean':
            if (typeof value !== 'boolean') {
              throw new Error(`Parameter ${param.name} must be a boolean`);
            }
            sanitizedData[param.name] = this.sanitizeBoolean(value, param);
            break;
            
          case 'object':
            sanitizedData[param.name] = this.sanitizeObject(value, param);
            break;
            
          case 'array':
            sanitizedData[param.name] = this.sanitizeArray(value, param);
            break;
        }
      } catch (error: any) {
        throw new Error(`Validation failed for parameter ${param.name}: ${error.message}`);
      }
    }
    
    return sanitizedData;
  }
  
  static createZodSchema(parameters: EventParameter[]): z.ZodSchema {
    const schemaObject: Record<string, z.ZodSchema> = {};
    
    for (const param of parameters) {
      let schema: z.ZodSchema;
      
      switch (param.type) {
        case 'string':
          schema = z.string();
          if (param.maxLength) {
            schema = (schema as z.ZodString).max(param.maxLength);
          }
          if (param.pattern) {
            schema = (schema as z.ZodString).regex(new RegExp(param.pattern));
          }
          if (param.allowedValues) {
            schema = schema.refine(val => param.allowedValues!.includes(val));
          }
          break;
          
        case 'number':
          schema = z.number();
          if (param.allowedValues) {
            schema = schema.refine(val => param.allowedValues!.includes(val));
          }
          break;
          
        case 'boolean':
          schema = z.boolean();
          break;
          
        case 'object':
          schema = z.object({}).passthrough();
          break;
          
        case 'array':
          schema = z.array(z.any());
          if (param.maxLength) {
            schema = (schema as z.ZodArray<any>).max(param.maxLength);
          }
          break;
          
        default:
          schema = z.any();
      }
      
      if (!param.required) {
        schema = schema.optional();
      }
      
      schemaObject[param.name] = schema;
    }
    
    return z.object(schemaObject);
  }
}
