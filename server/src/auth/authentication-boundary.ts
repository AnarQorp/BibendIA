import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticationAdapter } from './authentication-adapter.js';
import type { AuthAudience, PrincipalContext, PrincipalKind } from './principal.js';

export type RouteAuthPolicy =
  | { mode: 'public' }
  | { mode: 'authenticated'; audience: AuthAudience; principalKinds: readonly PrincipalKind[] };

declare module 'fastify' {
  interface FastifyContextConfig { auth?: RouteAuthPolicy }
  interface FastifyRequest { principal: PrincipalContext | null; rawBody?: string | Buffer }
}

const reject = (reply: FastifyReply, status: number, code: string) =>
  reply.code(status).send({ error: code });

export function registerAuthenticationBoundary(app: FastifyInstance, adapter: AuthenticationAdapter): void {
  app.decorateRequest('principal', null);
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.is404) return;
    const policy = request.routeOptions.config.auth;
    if (!policy) return reject(reply, 500, 'ROUTE_SECURITY_POLICY_MISSING');
    if (policy.mode === 'public') return;

    let principal: PrincipalContext | null = null;
    try {
      principal = await adapter.authenticate({
        method: request.method,
        url: request.url,
        path: request.routeOptions.url ?? request.url,
        contentType: request.headers['content-type'],
        authorization: request.headers.authorization,
        cookie: request.headers.cookie,
        headers: request.headers,
        body: request.body,
        rawBody: typeof request.rawBody === 'string' ? request.rawBody : request.rawBody?.toString('utf8'),
      }, policy.audience);
    } catch {
      request.log.warn('authentication rejected');
      return reject(reply, 401, 'AUTHENTICATION_REQUIRED');
    }

    if (!principal) return reject(reply, 401, 'AUTHENTICATION_REQUIRED');
    if (principal.audience !== policy.audience || !policy.principalKinds.includes(principal.kind)) {
      return reject(reply, 403, 'PRINCIPAL_NOT_ALLOWED');
    }
    request.principal = principal;
  });
}
