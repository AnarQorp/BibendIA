import { describe,expect,it } from 'vitest';
import { assertIsolatedTestDatabase } from '../../src/persistence/test-database-guard.js';
const target='postgres://test:local@127.0.0.1:32768/bibendia_invites_test';
const configured=(value=target)=>({BIBENDIA_TEST_DATABASE_URL:value,DATABASE_URL:value,API_DATABASE_URL:value,WORKER_DATABASE_URL:value,MIGRATOR_DATABASE_URL:value});
describe('fail-closed integration database boundary',()=>{
 it('requires an independently explicit target, not just inherited process URLs',()=>{expect(()=>assertIsolatedTestDatabase({DATABASE_URL:target})).toThrow('TEST_DATABASE_EXPLICIT_TARGET_REQUIRED');});
 it('rejects the development DB/default port, ordinary postgres port and non-test/non-loopback targets',()=>{for(const bad of [target.replace('32768','55432'),target.replace('32768','5432'),target.replace('bibendia_invites_test','bibendia'),target.replace('127.0.0.1','database.example.invalid')])expect(()=>assertIsolatedTestDatabase(configured(bad))).toThrow('TEST_DATABASE_NOT_ISOLATED');});
 it('requires every API/worker/migrator URL to match before a connection',()=>{expect(()=>assertIsolatedTestDatabase({...configured(),WORKER_DATABASE_URL:target.replace('32768','55432')})).toThrow('TEST_DATABASE_PROCESS_TARGET_MISMATCH');});
 it('allows only the explicit consistent disposable target',()=>{expect(()=>assertIsolatedTestDatabase(configured())).not.toThrow();});
});
