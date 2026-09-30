import { createServer } from 'node:http';
import { createPool } from '../persistence/pool.js';
import { loadWorkerRuntimeConfig } from '../runtime/config.js';
import { checkDatabaseReadiness } from '../runtime/readiness.js';
import { operationalLog } from '../runtime/logging.js';
import { piiProtectionFromEnvironment } from '../security/pii-protection.js';
import { NodeSmtpTransport, PublicLeadNotificationAdapter } from '../adapters/smtp/public-lead-smtp.js';
import { WorkerDispatcher, workerCapability, type WorkerAdapterRegistry } from './runtime.js';

const config = loadWorkerRuntimeConfig();
const pool = createPool('worker');
let stopping = false;
const adapters = buildAdapters();
const dispatcher = new WorkerDispatcher(pool, config, adapters);
const capability = workerCapability(config, adapters);

const server = createServer(async (request, response) => {
  response.setHeader('content-type', 'application/json');
  if (request.url === '/health/live') return end(response, 200, { status: 'live', service: 'worker', version: config.version, commit: config.commit });
  if (request.url === '/health/ready') {
    const database = await checkDatabaseReadiness(pool, 'bibendia_worker');
    if (!capability.operational) return end(response, 503, { status: 'not_ready', service: 'worker', code: capability.code });
    return database.ready
      ? end(response, 200, { status: 'ready', service: 'worker', mode: config.mode, version: config.version, commit: config.commit, schemaVersion: database.schemaVersion })
      : end(response, 503, { status: 'not_ready', service: 'worker', code: database.code });
  }
  return end(response, 404, { error: 'NOT_FOUND' });
});

server.listen(config.healthPort, '0.0.0.0', () => {
  operationalLog('info', 'worker', config, 'WORKER_RUNTIME_STARTED', { mode: config.mode, port: config.healthPort, workerId: config.workerId, adapterCount: adapters.size });
  dispatcher.start();
});

const shutdown = (signal: string) => {
  if (stopping) return;
  stopping = true;
  operationalLog('info', 'worker', config, 'SHUTDOWN_STARTED', { signal, workerId: config.workerId });
  const deadline = setTimeout(() => process.exit(1), config.shutdownTimeoutMs).unref();
  server.close(async (error) => {
    try { await dispatcher.stop(); await pool.end(); clearTimeout(deadline); process.exitCode = error ? 1 : 0; }
    catch { process.exitCode = 1; }
  });
};
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

function end(response: import('node:http').ServerResponse, status: number, body: object): void {
  response.statusCode = status;
  response.end(JSON.stringify(body));
}

function buildAdapters(): WorkerAdapterRegistry {
  if (!config.smtp) return new Map();
  const smtp = config.smtp;
  const transport = new NodeSmtpTransport({
    host: smtp.host, port: smtp.port, tlsMode: smtp.tlsMode, user: smtp.user,
    passwordRef: 'worker-smtp-password', sender: smtp.sender, destination: smtp.destination, timeoutMs: smtp.timeoutMs,
  }, { async resolve(reference) {
    if (reference !== 'worker-smtp-password') throw new Error('SECRET_REFERENCE_NOT_ALLOWED');
    return smtp.password;
  } });
  const adapter = new PublicLeadNotificationAdapter(pool, piiProtectionFromEnvironment(), transport, smtp.sender, smtp.destination);
  return new Map([['public_lead.notification_requested', adapter]]);
}
