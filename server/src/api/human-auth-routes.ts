import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import type { PiiProtection } from '../security/pii-protection.js';
import { redeemInvitation } from '../modules/invitations/invitations.js';
import {
  OidcAuthenticationAdapter, discoverWorkshopTenants, resolveCanonicalOidcUser, parseCookies, resolveHumanAuthority, verifyOidcIdToken,
  type HumanSurfaceConfig,
} from '../auth/oidc-authentication-adapter.js';

type OidcTransaction = {
  v: 1; state: string; nonce: string; verifier: string; audience: 'workshop' | 'platform'; expiresAt: string; invitationToken?:string; tenantId?:string;
};

const callbackQuery = z.object({ code: z.string().min(8), state: z.string().min(16) }).strict();

export function registerHumanAuthRoutes(app: FastifyInstance, pool: pg.Pool, adapter: OidcAuthenticationAdapter,pii:PiiProtection): void {
  app.addHook('onSend',async(request,reply,payload)=>{if(request.url.startsWith('/auth/'))reply.header('cache-control','no-store').header('referrer-policy','no-referrer');return payload;});
  app.get('/auth/invitation', {config:{auth:{mode:'public'}}},async(request,reply)=>{
    const surface=surfaceForRequest(request,adapter);
    if(!surface || surface.audience!=='workshop')return reply.code(404).send({error:'AUTH_SURFACE_NOT_CONFIGURED'});
    const nonce=randomBytes(18).toString('base64');
    return reply.header('cache-control','no-store').header('referrer-policy','no-referrer').header('content-security-policy',`default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`).type('text/html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Invitación BibendIA</title><p id="status">Iniciando acceso seguro…</p><script nonce="${nonce}">const token=new URLSearchParams(location.hash.slice(1)).get('token');history.replaceState(null,'','/auth/invitation');if(!token){document.getElementById('status').textContent='Invitación no válida';}else{fetch('/auth/invitation/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();location.replace(data.authorizationUrl);}).catch(()=>{document.getElementById('status').textContent='No se ha podido iniciar el acceso';});}</script></html>`);
  });
  app.post('/auth/invitation/start', {config:{auth:{mode:'public'}}},async(request,reply)=>{
    const surface=surfaceForRequest(request,adapter);
    if(!surface || surface.audience!=='workshop')return reply.code(404).send({error:'AUTH_SURFACE_NOT_CONFIGURED'});
    const body=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict().parse(request.body);
    const transaction=beginLogin(surface,adapter,reply,{invitationToken:body.token});
    return reply.send({authorizationUrl:transaction});
  });
  app.get('/auth/login', { config: { auth: { mode: 'public' } } }, async (request, reply) => {
    const surface = surfaceForRequest(request, adapter);
    if (!surface) return reply.code(404).send({ error: 'AUTH_SURFACE_NOT_CONFIGURED' });
    const query=z.object({tenantId:z.uuid().optional()}).strict().parse(request.query);
    return reply.redirect(beginLogin(surface,adapter,reply,{tenantId:query.tenantId}));
  });

  app.get('/auth/callback', { config: { auth: { mode: 'public' } } }, async (request, reply) => {
    const surface = surfaceForRequest(request, adapter);
    if (!surface) return reply.code(404).send({ error: 'AUTH_SURFACE_NOT_CONFIGURED' });
    const parsed = callbackQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'OIDC_CALLBACK_INVALID' });
    const transactionValue = parseCookies(request.headers.cookie)[transactionCookie(surface)];
    const transaction = transactionValue
      ? adapter.open<OidcTransaction>(transactionValue, `oidc:${surface.audience}`) : null;
    clearCookie(reply, transactionCookie(surface));
    if (!transaction || transaction.v !== 1 || transaction.audience !== surface.audience ||
        transaction.state !== parsed.data.state || Date.parse(transaction.expiresAt) <= Date.now()) {
      return reply.code(401).send({ error: 'OIDC_TRANSACTION_INVALID' });
    }
    try {
      const tokens = await exchangeCode(adapter.config.issuer, surface, parsed.data.code, transaction.verifier);
      const identity = await verifyOidcIdToken(tokens.id_token, surface, adapter.config.issuer, transaction.nonce);
      let userId:string|null,tenantId=transaction.tenantId??surface.authorizationTenantId;
      if(transaction.invitationToken){
        if(surface.audience!=='workshop')throw new Error('INVITATION_INVALID');
        const accepted=await redeemInvitation(pool,transaction.invitationToken,identity,request.id,pii);
        userId=accepted.user_id;tenantId=accepted.tenant_id;
      }else{
        userId=await resolveCanonicalOidcUser(pool,identity.issuer,identity.subject);
        if(identity.userId && identity.userId!==userId)throw new Error('OIDC_IDENTITY_CONFLICT');
        if(userId && surface.audience==='workshop'){
          const tenants=await discoverWorkshopTenants(pool,userId,identity.issuer,identity.subject);
          if(!transaction.tenantId && !tenants.includes(tenantId)){if(tenants.length!==1)return reply.code(403).send({error:'WORKSHOP_SELECTION_REQUIRED'});tenantId=tenants[0];}
        }
      }
      if(!userId)return reply.code(403).send({error:'HUMAN_AUTHORITY_REQUIRED'});
      const authority = await resolveHumanAuthority(pool, userId, identity.issuer, identity.subject, surface.audience, tenantId);
      if (!authority) return reply.code(403).send({ error: 'HUMAN_AUTHORITY_REQUIRED' });
      const sealed = adapter.sealSession({
        userId, tenantId, issuer: identity.issuer, subject: identity.subject,
        audience: surface.audience, assurance: identity.assurance, authenticatedAt: identity.authenticatedAt,
      });
      setCookie(reply, surface.cookieName, sealed.value, adapter.config.sessionTtlSeconds);
      return reply.redirect(surface.origin);
    } catch (error) {
      request.log.warn({ code: 'OIDC_CALLBACK_REJECTED' }, 'OIDC callback rejected');
      return reply.code(401).send({ error: 'OIDC_AUTHENTICATION_FAILED' });
    }
  });

  app.post('/auth/logout', { config: { auth: { mode: 'public' } } }, async (request, reply) => {
    const surface = surfaceForRequest(request, adapter);
    if (!surface) return reply.code(404).send({ error: 'AUTH_SURFACE_NOT_CONFIGURED' });
    clearCookie(reply, surface.cookieName);
    clearCookie(reply, transactionCookie(surface));
    const logout = new URL('/v2/logout', `${adapter.config.issuer}/`);
    logout.search = new URLSearchParams({ client_id: surface.clientId, returnTo: surface.origin }).toString();
    return reply.send({ ok: true, logoutUrl: logout.toString() });
  });

  app.get('/auth/session', { config: { auth: { mode: 'public' } } }, async (request, reply) => {
    const surface = surfaceForRequest(request, adapter);
    if (!surface) return reply.code(404).send({ error: 'AUTH_SURFACE_NOT_CONFIGURED' });
    const principal = await adapter.authenticate({
      method: request.method, url: request.url, path: '/auth/session', cookie: request.headers.cookie,
      headers: request.headers,
    }, surface.audience);
    if (!principal || principal.kind === 'service') return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    return sessionResponse(pool, principal, surface.authorizationTenantId);
  });
}

async function sessionResponse(pool: pg.Pool, principal: NonNullable<FastifyRequest['principal']>, authorizationTenantId: string) {
  if (principal.kind === 'service') return { error: 'PRINCIPAL_NOT_ALLOWED' };
  const authority = principal.audience==='workshop' ? {tenantIds:await discoverWorkshopTenants(pool,principal.userId,principal.issuer,principal.subject)} : await resolveHumanAuthority(pool, principal.userId, principal.issuer, principal.subject, principal.audience, authorizationTenantId);
  return {
    principal: { kind: principal.kind, audience: principal.audience, userId: principal.userId, assurance: principal.assurance },
    tenantIds: authority?.tenantIds ?? [], activeTenantId:principal.kind==='workshop_user' ? (principal.tenantId??authorizationTenantId) : undefined, expiresAt: principal.expiresAt,
  };
}

function surfaceForRequest(request: FastifyRequest, adapter: OidcAuthenticationAdapter): HumanSurfaceConfig | null {
  const hostname = request.hostname.toLowerCase();
  for (const surface of [adapter.config.workshop, adapter.config.platform]) {
    if (new URL(surface.origin).hostname.toLowerCase() === hostname) return surface;
  }
  return null;
}

async function exchangeCode(issuer: string, surface: HumanSurfaceConfig, code: string, verifier: string): Promise<{ id_token: string }> {
  const response = await fetch(new URL('/oauth/token', `${issuer}/`), {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', client_id: surface.clientId, client_secret: surface.clientSecret,
      code, code_verifier: verifier, redirect_uri: `${surface.origin}/auth/callback`,
    }),
  });
  if (!response.ok) throw new Error('OIDC_TOKEN_EXCHANGE_FAILED');
  return z.object({ id_token: z.string().min(20) }).passthrough().parse(await response.json());
}

function transactionCookie(surface: HumanSurfaceConfig) { return `${surface.cookieName}_oidc`; }

function setCookie(reply: FastifyReply, name: string, value: string, maxAge: number) {
  appendCookie(reply, `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`);
}

function clearCookie(reply: FastifyReply, name: string) {
  appendCookie(reply, `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
}

function appendCookie(reply: FastifyReply, value: string) {
  const current = reply.getHeader('set-cookie');
  reply.header('set-cookie', current ? [...(Array.isArray(current) ? current : [String(current)]), value] : value);
}

function beginLogin(surface:HumanSurfaceConfig,adapter:OidcAuthenticationAdapter,reply:FastifyReply,extra:{invitationToken?:string;tenantId?:string}){
 const transaction:OidcTransaction={v:1,audience:surface.audience,state:randomBytes(24).toString('base64url'),nonce:randomBytes(24).toString('base64url'),verifier:randomBytes(48).toString('base64url'),expiresAt:new Date(Date.now()+600_000).toISOString(),...extra};
 setCookie(reply,transactionCookie(surface),adapter.seal(transaction,`oidc:${surface.audience}`),600);
 const authorize=new URL('/authorize',`${adapter.config.issuer}/`);
 authorize.search=new URLSearchParams({response_type:'code',client_id:surface.clientId,redirect_uri:`${surface.origin}/auth/callback`,scope:'openid profile email',state:transaction.state,nonce:transaction.nonce,code_challenge:createHash('sha256').update(transaction.verifier).digest('base64url'),code_challenge_method:'S256',...(surface.requireMfa?{max_age:'0'}:{})}).toString();
 return authorize.toString();
}
