import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '999y';

export interface JwtPayload {
  identifiers: {
    userId: string;
    userSource?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export const jwtManager = {
  sign(payload: JwtPayload, options?: any) {
    return jwt.sign(payload, JWT_SECRET, { 
      ...options,
      expiresIn: JWT_EXPIRES_IN
    });
  },
  verify(token: string): JwtPayload {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  },
  decode(token: string) {
    return jwt.decode(token) as JwtPayload | null;
  },
};
