import { buildApi } from './app.js';
import { createPool } from '../persistence/pool.js';

const pool = createPool();
const app = buildApi(pool);
const port = Number(process.env.PORT ?? 3100);
await app.listen({ host: '0.0.0.0', port });

const shutdown = async () => {
  await app.close();
  await pool.end();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
