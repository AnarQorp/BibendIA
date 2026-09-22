import { buildApi } from './app.js';
import { createPool } from '../persistence/pool.js';
import { loadApiRuntimeConfig } from '../runtime/config.js';
import { checkDatabaseReadiness } from '../runtime/readiness.js';

const config = loadApiRuntimeConfig();
const pool = createPool('api');
const app = buildApi(pool, {
  allowedOrigins: config.allowedOrigins, providerIngress: config.providerIngress, piiProtection: config.piiProtection,
  readiness: () => checkDatabaseReadiness(pool, 'bibendia_api'),
  runtime: { service: 'api', version: config.version, commit: config.commit },
});
await app.listen({ host: '0.0.0.0', port: config.port });

let stopping = false;
const shutdown = async (signal: string) => {
  if (stopping) return;
  stopping = true;
  app.log.info({ signal }, 'shutdown started');
  const deadline = setTimeout(() => process.exit(1), config.shutdownTimeoutMs).unref();
  try { await app.close(); await pool.end(); clearTimeout(deadline); process.exitCode = 0; }
  catch { process.exitCode = 1; }
};
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
