/** Fail before constructing a pool: tests must never inherit the development fallback. */
export function assertIsolatedTestDatabase(env:NodeJS.ProcessEnv):void {
  const expected=env.BIBENDIA_TEST_DATABASE_URL;
  if(!expected)throw new Error('TEST_DATABASE_EXPLICIT_TARGET_REQUIRED');
  let url:URL;
  try{url=new URL(expected);}catch{throw new Error('TEST_DATABASE_TARGET_INVALID');}
  if(!['postgres:','postgresql:'].includes(url.protocol) || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) ||
     !url.port || ['5432','55432'].includes(url.port) || !/^\/bibendia_[a-z0-9_]*test$/.test(url.pathname) || url.search || url.hash){
    throw new Error('TEST_DATABASE_NOT_ISOLATED');
  }
  for(const name of ['DATABASE_URL','API_DATABASE_URL','WORKER_DATABASE_URL','MIGRATOR_DATABASE_URL']){
    if(env[name]!==expected)throw new Error('TEST_DATABASE_PROCESS_TARGET_MISMATCH');
  }
}
