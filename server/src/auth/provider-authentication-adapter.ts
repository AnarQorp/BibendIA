import { timingSafeEqual } from 'node:crypto';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import twilio from 'twilio';
import type { AuthAudience, ServicePrincipal } from './principal.js';
import type { AuthenticationAdapter, AuthenticationRequest } from './authentication-adapter.js';

type ProviderCredential = {
  servicePrincipalId: string;
  externalAccountId: string;
  secret: string;
};

export type ProviderIngressConfig = {
  publicApiBaseUrl: string;
  twilio?: ProviderCredential;
  elevenLabsWebhook?: ProviderCredential;
  elevenLabsTool?: ProviderCredential;
};

/**
 * Verifies only provider transport credentials. Tenant authority is deliberately absent here:
 * it is resolved later from the authenticated service principal's database binding.
 */
export class ProviderAuthenticationAdapter implements AuthenticationAdapter {
  // The SDK requires a non-empty API key even though constructEvent performs only local HMAC
  // verification and makes no API request. This sentinel is never accepted as provider authority.
  readonly #elevenLabs = new ElevenLabsClient({ apiKey: 'webhook-verification-only' });

  constructor(
    private readonly fallback: AuthenticationAdapter,
    private readonly config: ProviderIngressConfig,
  ) {}

  async authenticate(request: AuthenticationRequest, expectedAudience: AuthAudience) {
    if (expectedAudience !== 'provider') return this.fallback.authenticate(request, expectedAudience);

    if (request.path === '/v1/providers/twilio/voice/events') {
      return this.authenticateTwilio(request);
    }
    if (request.path === '/v1/providers/elevenlabs/conversations/events') {
      return this.authenticateElevenLabsWebhook(request);
    }
    if (request.path === '/v1/providers/elevenlabs/tools/create-appointment'
      || request.path === '/v1/providers/elevenlabs/tools/find-slots'
      || request.path === '/v1/providers/elevenlabs/tools/hold-slot') {
      return this.authenticateElevenLabsTool(request);
    }
    return null;
  }

  private authenticateTwilio(request: AuthenticationRequest): ServicePrincipal | null {
    const credential = this.config.twilio;
    const signature = header(request, 'x-twilio-signature');
    const body = asTwilioParams(request.body);
    if (!credential || !signature || !body || body.AccountSid !== credential.externalAccountId) return null;
    const url = new URL(request.url, ensureTrailingSlash(this.config.publicApiBaseUrl)).toString();
    if (!twilio.validateRequest(credential.secret, signature, url, body)) return null;
    return principal(credential, 'telephony_provider');
  }

  private async authenticateElevenLabsWebhook(request: AuthenticationRequest): Promise<ServicePrincipal | null> {
    const credential = this.config.elevenLabsWebhook;
    const signature = header(request, 'elevenlabs-signature');
    if (!credential || !signature || request.rawBody === undefined) return null;
    try {
      await this.#elevenLabs.webhooks.constructEvent(request.rawBody, signature, credential.secret);
      return principal(credential, 'voice_provider');
    } catch {
      return null;
    }
  }

  private authenticateElevenLabsTool(request: AuthenticationRequest): ServicePrincipal | null {
    const credential = this.config.elevenLabsTool;
    if (!credential || !constantTimeBearerMatch(request.authorization, credential.secret)) return null;
    return principal(credential, 'voice_provider');
  }
}

function principal(credential: ProviderCredential, serviceType: ServicePrincipal['serviceType']): ServicePrincipal {
  const authenticatedAt = new Date();
  return {
    kind: 'service', audience: 'provider', serviceId: credential.servicePrincipalId,
    externalAccountId: credential.externalAccountId,
    serviceType, authenticatedAt: authenticatedAt.toISOString(),
    expiresAt: new Date(authenticatedAt.getTime() + 5 * 60_000).toISOString(),
  };
}

function header(request: AuthenticationRequest, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
}

function asTwilioParams(value: unknown): Record<string, string | string[]> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.some(([, item]) => typeof item !== 'string'
    && (!Array.isArray(item) || item.some((part) => typeof part !== 'string')))) return null;
  return Object.fromEntries(entries) as Record<string, string | string[]>;
}

function constantTimeBearerMatch(authorization: string | undefined, expected: string): boolean {
  if (!authorization?.startsWith('Bearer ')) return false;
  const actual = Buffer.from(authorization.slice(7));
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
