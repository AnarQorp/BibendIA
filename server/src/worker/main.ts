import { createPool } from '../persistence/pool.js';
import { claimOutboxBatch } from './outbox.js';

const tenantId = process.env.TENANT_ID;
if (!tenantId) throw new Error('TENANT_ID is required');
const pool = createPool();
try {
  const events = await claimOutboxBatch(pool, tenantId);
  process.stdout.write(`Claimed ${events.length} outbox event(s)\n`);
} finally {
  await pool.end();
}
