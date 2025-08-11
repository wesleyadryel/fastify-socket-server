import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
const JWT_EXPIRES_IN = '1h';

export interface JwtPayload {
  userId: string;
  [key: string]: any;
}

export const jwtManager = {
  sign(payload: JwtPayload, options?: jwt.SignOptions) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, ...options });
  },
  verify(token: string): JwtPayload {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  },
  decode(token: string) {
    return jwt.decode(token) as JwtPayload | null;
  },
};
