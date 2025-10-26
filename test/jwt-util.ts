import { jwtManager } from '../src/jwt'

export function generateTestToken(userUuid = 'test-user', extra: Record<string, any> = {}) {
  return jwtManager.sign({ 
    identifiers: {
      userUuid,
      ...extra
    }
  });
}
