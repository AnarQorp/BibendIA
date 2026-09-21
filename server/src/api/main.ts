import { buildApi } from './app.js';
import { createPool } from '../persistence/pool.js';

const pool = createPool('api');
const allowedOrigins = [process.env.WORKSHOP_ORIGIN, process.env.PLATFORM_ORIGIN].filter((value): value is string => Boolean(value));
if (process.env.NODE_ENV === 'production' && allowedOrigins.length !== 2) {
  throw new Error('WORKSHOP_ORIGIN and PLATFORM_ORIGIN are required in production');
}
const app = buildApi(pool, { allowedOrigins: allowedOrigins.length ? allowedOrigins : undefined });
const port = Number(process.env.PORT ?? 3100);
await app.listen({ host: '0.0.0.0', port });

const shutdown = async () => {
  await app.close();
  await pool.end();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
