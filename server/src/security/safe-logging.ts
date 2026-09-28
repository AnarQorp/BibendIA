const SECRET_KEYS = /(authorization|cookie|token|secret|signature)/i;
const PII_KEYS = /(^from$|name|phone|email|plate|caller|transcript|recording|notes|symptoms|content|rawbody)/i;

export function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForLog);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    SECRET_KEYS.test(key) ? '[REDACTED_SECRET]' : PII_KEYS.test(key) ? '[REDACTED_PII]' : redactForLog(item),
  ]));
}

export function safeErrorAttributes(error: unknown): { errorType: string; errorCode?: string } {
  if (!(error instanceof Error)) return { errorType: 'UnknownError' };
  const candidate = error as Error & { code?: unknown };
  return {
    errorType: error.constructor.name,
    ...(typeof candidate.code === 'string' && /^[A-Z0-9_]{2,80}$/.test(candidate.code) ? { errorCode: candidate.code } : {}),
  };
}
