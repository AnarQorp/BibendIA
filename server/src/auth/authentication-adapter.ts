import type { AuthAudience, PrincipalContext } from './principal.js';

export type AuthenticationRequest = {
  method: string;
  url: string;
  path: string;
  contentType?: string;
  authorization?: string;
  cookie?: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  body?: unknown;
  rawBody?: string;
};

export interface AuthenticationAdapter {
  authenticate(request: AuthenticationRequest, expectedAudience: AuthAudience): Promise<PrincipalContext | null>;
}

/** Production-safe default while the OIDC/provider adapters are not configured. */
export class DenyAllAuthenticationAdapter implements AuthenticationAdapter {
  async authenticate(): Promise<null> { return null; }
}
