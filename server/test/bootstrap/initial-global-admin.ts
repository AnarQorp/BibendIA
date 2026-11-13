import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertIsolatedTestDatabase } from '../../src/persistence/test-database-guard.js';
import { createPool } from '../../src/persistence/pool.js';
import { inAuthorizedPlatformTransaction } from '../../src/auth/platform-authorization.js';

assertIsolatedTestDatabase(process.env);
const pool=createPool('migrator'); // Explicit disposable test administrator, fixtures only.
const target='8f52f8df-4934-4614-ac19-7f73bdd6204e';
const ledger='initial_global_admin_receipt_8f52f8df';
const script=fileURLToPath(new URL('../../operations/initial-global-admin-8f52f8df.sql',import.meta.url));
const db=new URL(process.env.BIBENDIA_TEST_DATABASE_URL!);
const container=process.env.BIBENDIA_INITIAL_ADMIN_TEST_CONTAINER ?? '';
assert.match(container,/^bibendia-initial-admin-test-\d+$/,'Use the dedicated disposable-container gate');
const operator='bibendia_initial_admin_test_login', runtime='bibendia_initial_api_test_login';
const password='disposable-test-only';
let passed=0;
async function check(name:string,work:()=>Promise<void>){await work();passed++;console.log(`PASS: ${name}`);}
async function run(user=operator,reference='synthetic-owner-authorization') {
  return new Promise<{code:number|null;output:string}>((resolve,reject)=>{
    // Use psql already shipped inside the disposable PostgreSQL image: no host install.
    const child=spawn('docker',['exec','-i','--env','PGUSER','--env','PGPASSWORD','--env','PGDATABASE','--env','PGHOST','--env','PGPORT',container,
      'psql','-X','--no-password','--set',`owner_authorization_ref=${reference}`,'--file','-'],{
      env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGDATABASE:db.pathname.slice(1),PGUSER:user,
        PGPASSWORD:user===db.username?decodeURIComponent(db.password):password,PGOPTIONS:'',PGSERVICE:''},
      stdio:['pipe','pipe','pipe'],
    });
    let output='';child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{output+=b;});
    child.stdin.on('error',()=>{});child.stdin.end(readFileSync(script));
    child.on('error',reject);child.on('close',code=>resolve({code,output}));
  });
}
async function grant(){return (await pool.query("SELECT * FROM platform_access_grants WHERE user_id=$1 AND role='PLATFORM_ADMIN' AND scope_type='global'",[target])).rows;}
async function receipts(){return (await pool.query(`SELECT * FROM ${ledger}`)).rows;}
async function policies(){return (await pool.query("SELECT * FROM pg_policies WHERE schemaname='public' AND tablename<>$1 ORDER BY tablename,policyname",[ledger])).rows;}
async function snapshotBusiness(){
  const tables=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('platform_access_grants',$1) ORDER BY tablename",[ledger])).rows;
  const result:Record<string,unknown>={};
  for(const {tablename} of tables)result[tablename]=(await pool.query(`SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),'')) digest FROM public."${tablename.replaceAll('"','""')}" t`)).rows[0];
  return result;
}
async function resetOperationFixture(){await pool.query(`DELETE FROM ${ledger}`);await pool.query("DELETE FROM platform_access_grants WHERE user_id=$1 AND role='PLATFORM_ADMIN' AND scope_type='global'",[target]);}
async function expectFailure(fragment:string,user=operator,reference?:string){const result=await run(user,reference);assert.notEqual(result.code,0,result.output);assert.ok(result.output.includes(fragment),result.output);}
try {
  await pool.query(`CREATE ROLE ${operator} LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT PASSWORD '${password}'`);
  await pool.query(`GRANT bibendia_migrator TO ${operator}`);
  await pool.query(`CREATE ROLE ${runtime} LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT PASSWORD '${password}'`);
  await pool.query(`GRANT bibendia_api TO ${runtime}`);
  const unrelated=randomUUID();
  await pool.query("INSERT INTO users(id,status) VALUES($1,'active')",[unrelated]);
  await pool.query("INSERT INTO platform_access_grants(user_id,role,scope_type) VALUES($1,'SUPPORT_READONLY','global')",[unrelated]);
  await check('runtime identity cannot assume migration authority',async()=>{await expectFailure('permission denied to set role',runtime);});
  await check('superuser execution is rejected, not used as RLS bypass',async()=>{await expectFailure('OPERATOR_MIGRATION_IDENTITY_REQUIRED',db.username);});
  await check('unsafe runtime membership in migration authority is rejected',async()=>{
    await pool.query('GRANT bibendia_migrator TO bibendia_api');
    try{await expectFailure('OPERATOR_MIGRATION_IDENTITY_REQUIRED');}finally{await pool.query('REVOKE bibendia_migrator FROM bibendia_api');}
  });
  await check('missing user is rejected without creating an identity',async()=>{await expectFailure('TARGET_ACTIVE_USER_REQUIRED');assert.equal((await pool.query('SELECT 1 FROM users WHERE id=$1',[target])).rowCount,0);});
  await pool.query("INSERT INTO users(id,status) VALUES($1,'active')",[target]);
  await check('unbound user is rejected',async()=>{await expectFailure('TARGET_CANONICAL_IDENTITY_REQUIRED');});
  await pool.query("INSERT INTO external_identities(user_id,issuer,subject) VALUES($1,'https://synthetic.example.invalid/','synthetic-internal-user')",[target]);
  await check('suspended user and absent owner reference fail closed',async()=>{
    await pool.query("UPDATE users SET status='suspended' WHERE id=$1",[target]);await expectFailure('TARGET_ACTIVE_USER_REQUIRED');
    await pool.query("UPDATE users SET status='active' WHERE id=$1",[target]);await expectFailure('OWNER_AUTHORIZATION_REFERENCE_REQUIRED',operator,'');
  });
  await check('incompatible schema is rejected',async()=>{
    await pool.query("INSERT INTO schema_migrations(name) VALUES('999_synthetic_unknown.sql')");
    try{await expectFailure('COMPATIBLE_SCHEMA_041_REQUIRED');}finally{await pool.query("DELETE FROM schema_migrations WHERE name='999_synthetic_unknown.sql'");}
  });
  const policyBefore=await policies(),businessBefore=await snapshotBusiness();
  const otherGrants=(await pool.query('SELECT * FROM platform_access_grants ORDER BY id')).rows;
  const rlsBefore=(await pool.query("SELECT oid,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY oid")).rows;
  await check('concurrent execution creates exactly one fixed global grant and one atomic receipt',async()=>{
    const results=await Promise.all([run(),run()]);for(const r of results)assert.equal(r.code,0,r.output);
    const rows=await grant(),audit=await receipts();assert.equal(rows.length,1);assert.equal(audit.length,1);
    assert.equal(rows[0].tenant_id,null);assert.equal(rows[0].role,'PLATFORM_ADMIN');assert.equal(rows[0].status,'active');
    assert.equal(audit[0].executed_by,operator);assert.equal(audit[0].outcome,'created');assert.equal(audit[0].grant_id,rows[0].id);
    assert.equal(audit[0].owner_authorization_ref,'synthetic-owner-authorization');
    assert.deepEqual(await policies(),policyBefore);assert.deepEqual(await snapshotBusiness(),businessBefore);
    assert.deepEqual((await pool.query('SELECT * FROM platform_access_grants WHERE user_id<>$1 ORDER BY id',[target])).rows,otherGrants);
    assert.deepEqual((await pool.query("SELECT oid,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=ANY($1::oid[]) ORDER BY oid",[rlsBefore.map(r=>r.oid)])).rows,rlsBefore);
  });
  await check('replay leaves grant and audit byte-for-byte unchanged',async()=>{
    const before=await grant(),audit=await receipts();const r=await run();assert.equal(r.code,0,r.output);
    assert.deepEqual(await grant(),before);assert.deepEqual(await receipts(),audit);
  });
  await check('new authority is recognized by unchanged global application authorization',async()=>{
    const result=await inAuthorizedPlatformTransaction(pool,{principal:{kind:'platform_user',audience:'platform',userId:target,issuer:'https://synthetic.example.invalid/',subject:'synthetic-internal-user',sessionId:randomUUID(),authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),assurance:'mfa'},capability:'platform:tenant:create',requireGlobal:true,correlationId:randomUUID()},async(_c,ctx)=>ctx.global);
    assert.equal(result,true);
  });
  await check('runtime cannot read private audit or use temporary operational policy',async()=>{
    const c=await pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE bibendia_api');
      assert.equal((await c.query('SELECT * FROM platform_access_grants')).rowCount,0);
      await assert.rejects(c.query(`SELECT * FROM ${ledger}`),/permission denied/);
    }finally{await c.query('ROLLBACK');c.release();}
  });
  await check('FORCE RLS prevents even migrator UPDATE or DELETE of the receipt',async()=>{
    const before=await receipts(),c=await pool.connect();
    try{await c.query('BEGIN');await c.query('SET LOCAL ROLE bibendia_migrator');
      assert.equal((await c.query(`UPDATE ${ledger} SET owner_authorization_ref='must-not-change'`)).rowCount,0);
      assert.equal((await c.query(`DELETE FROM ${ledger}`)).rowCount,0);
    }finally{await c.query('ROLLBACK');c.release();}
    assert.deepEqual(await receipts(),before);
  });
  await check('replay cannot restore a later revoked grant',async()=>{
    await pool.query("UPDATE platform_access_grants SET status='revoked' WHERE user_id=$1",[target]);const before=await grant(),audit=await receipts();
    await expectFailure('RECORDED_GRANT_CHANGED_REQUIRES_SEPARATE_AUTHORIZATION');assert.deepEqual(await grant(),before);assert.deepEqual(await receipts(),audit);assert.deepEqual(await policies(),policyBefore);
  });
  await resetOperationFixture();
  await check('existing inactive grant is not updated or replaced',async()=>{
    await pool.query("INSERT INTO platform_access_grants(user_id,role,scope_type,status) VALUES($1,'PLATFORM_ADMIN','global','revoked')",[target]);
    const before=await grant();await expectFailure('EXISTING_GRANT_NOT_CURRENTLY_ACTIVE');assert.deepEqual(await grant(),before);assert.equal((await receipts()).length,0);
  });
  await resetOperationFixture();
  await check('audit failure rolls back new grant and temporary policies atomically',async()=>{
    await pool.query(`CREATE FUNCTION public.synthetic_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE'; END$$`);
    await pool.query(`CREATE TRIGGER synthetic_receipt_failure BEFORE INSERT ON ${ledger} FOR EACH ROW EXECUTE FUNCTION public.synthetic_receipt_failure()`);
    try{await expectFailure('SYNTHETIC_AUDIT_FAILURE');assert.equal((await grant()).length,0);assert.equal((await receipts()).length,0);assert.deepEqual(await policies(),policyBefore);}
    finally{await pool.query(`DROP TRIGGER synthetic_receipt_failure ON ${ledger}`);await pool.query('DROP FUNCTION public.synthetic_receipt_failure()');}
  });
  await check('already-active grant is audited without altering any existing grant',async()=>{
    await pool.query("INSERT INTO platform_access_grants(user_id,role,scope_type) VALUES($1,'PLATFORM_ADMIN','global')",[target]);
    const before=await grant();const r=await run();assert.equal(r.code,0,r.output);assert.deepEqual(await grant(),before);assert.equal((await receipts())[0].outcome,'already_present');
  });
  assert.deepEqual(await snapshotBusiness(),businessBefore);assert.deepEqual(await policies(),policyBefore);
  console.log(`PASS: ${passed} isolated operator checks; production never contacted`);
} finally {await pool.end();}
