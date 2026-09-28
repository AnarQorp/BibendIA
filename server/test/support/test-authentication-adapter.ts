import type { AuthenticationAdapter, AuthenticationRequest } from '../../src/auth/authentication-adapter.js';
import type { AuthAudience, PrincipalContext } from '../../src/auth/principal.js';

const authenticatedAt = '2026-09-21T00:00:00.000Z';
const expiresAt = '2026-09-21T01:00:00.000Z';

export class TestAuthenticationAdapter implements AuthenticationAdapter {
  constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TestAuthenticationAdapter is forbidden in production');
    }
  }

  async authenticate(request: AuthenticationRequest, _expectedAudience: AuthAudience): Promise<PrincipalContext | null> {
    if (request.authorization === 'Bearer explode') throw new Error('deterministic test failure');
    if (request.authorization === 'Bearer workshop') return {
      kind: 'workshop_user', audience: 'workshop', userId: 'user-workshop', issuer: 'test-issuer',
      subject: 'workshop-subject', sessionId: 'workshop-session', authenticatedAt, expiresAt, assurance: 'single_factor',
    };
    if (request.authorization === 'Bearer platform') return {
      kind: 'platform_user', audience: 'platform', userId: 'user-platform', issuer: 'test-issuer',
      subject: 'platform-subject', sessionId: 'platform-session', authenticatedAt, expiresAt, assurance: 'mfa',
    };
    if (request.authorization === 'Bearer provider') return {
      kind: 'service', audience: 'provider', serviceId: '00000000-0000-4000-8000-000000000099', externalAccountId: 'elevenlabs-test', serviceType: 'voice_provider', authenticatedAt, expiresAt,
    };
    return null;
  }
}
