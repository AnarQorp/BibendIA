export type AuthAudience = 'workshop' | 'platform' | 'provider' | 'internal';
export type HumanAssurance = 'single_factor' | 'mfa';

type HumanPrincipal = {
  userId: string;
  issuer: string;
  subject: string;
  sessionId: string;
  authenticatedAt: string;
  expiresAt: string;
  assurance: HumanAssurance;
};

export type WorkshopPrincipal = HumanPrincipal & {
  kind: 'workshop_user';
  audience: 'workshop';
};

export type PlatformPrincipal = HumanPrincipal & {
  kind: 'platform_user';
  audience: 'platform';
};

export type ServicePrincipal = {
  kind: 'service';
  audience: 'provider' | 'internal';
  serviceId: string;
  externalAccountId: string;
  serviceType: 'voice_provider' | 'telephony_provider' | 'worker' | 'scheduler' | 'integration';
  authenticatedAt: string;
  expiresAt: string;
};

export type PrincipalContext = WorkshopPrincipal | PlatformPrincipal | ServicePrincipal;
export type PrincipalKind = PrincipalContext['kind'];
