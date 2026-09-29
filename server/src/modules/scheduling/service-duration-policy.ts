import { z } from 'zod';
import type { ServiceRequest } from './model.js';

export const serviceIntentSchema = z.enum(['inspection', 'oil_service', 'brakes_or_noise', 'generic_fault']);
export type ServiceIntent = ServiceRequest['intent'];
export type DurationPolicySource = 'service_intent' | 'workshop_fallback' | 'legacy_client_supplied';

const duration = z.number().int().min(15).max(480);
export const workshopServiceDurationPolicySchema = z.object({
  version: z.string().trim().min(1).max(100),
  rules: z.object({
    inspection: duration.optional(),
    oil_service: duration.optional(),
    brakes_or_noise: duration.optional(),
    generic_fault: duration.optional(),
  }).strict(),
  fallbackMinutes: duration.nullable(),
}).strict();

export type WorkshopServiceDurationPolicy = z.infer<typeof workshopServiceDurationPolicySchema>;

export class ServiceDurationPolicyError extends Error {
  constructor(readonly code: 'SERVICE_DURATION_POLICY_INVALID' | 'SERVICE_DURATION_UNRESOLVED') { super(code); }
}

export function resolveServiceDuration(input: {
  policy: unknown;
  serviceIntent?: ServiceIntent;
  legacyDurationMinutes?: number;
}): { estimatedDurationMinutes: number; source: DurationPolicySource; policyVersion: string } {
  if (!input.serviceIntent && input.legacyDurationMinutes !== undefined) {
    return { estimatedDurationMinutes: duration.parse(input.legacyDurationMinutes), source: 'legacy_client_supplied', policyVersion: 'legacy' };
  }
  const parsed = workshopServiceDurationPolicySchema.safeParse(input.policy);
  if (!parsed.success) throw new ServiceDurationPolicyError('SERVICE_DURATION_POLICY_INVALID');
  if (!input.serviceIntent) throw new ServiceDurationPolicyError('SERVICE_DURATION_UNRESOLVED');
  const exact = parsed.data.rules[input.serviceIntent];
  if (exact !== undefined) return { estimatedDurationMinutes: exact, source: 'service_intent', policyVersion: parsed.data.version };
  if (parsed.data.fallbackMinutes !== null) {
    return { estimatedDurationMinutes: parsed.data.fallbackMinutes, source: 'workshop_fallback', policyVersion: parsed.data.version };
  }
  throw new ServiceDurationPolicyError('SERVICE_DURATION_UNRESOLVED');
}
