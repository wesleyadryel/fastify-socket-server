import { jwtManager } from '../src/jwt'

export function generateTestToken(userId = 'test-user', extra: Record<string, any> = {}) {
  return jwtManager.sign({ userId, ...extra });
}
