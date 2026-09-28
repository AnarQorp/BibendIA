export function operationalLog(
  level: 'info' | 'error', service: 'api' | 'worker', identity: { version: string; commit: string },
  code: string, attributes: Record<string, string | number | boolean | undefined> = {},
): void {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, service, version: identity.version, commit: identity.commit, code, ...attributes });
  (level === 'error' ? process.stderr : process.stdout).write(`${entry}\n`);
}
