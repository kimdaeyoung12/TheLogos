// PostgreSQL-in-WASM integration test, NOT a hosted Supabase end-to-end test.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const migrationDir = 'supabase/migrations/';
const files = (await readdir(new URL(migrationDir, root))).filter(x => x.endsWith('.sql')).sort();
const patch = '20261024010000_retreat_prayer_explicit_service_grants.sql';
assert(files.includes(patch));
const defaults = `alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated,service_role;
  alter default privileges in schema public grant usage,select on sequences to anon,authenticated,service_role;`;
const optOut = `alter default privileges in schema public revoke select,insert,update,delete on tables from anon,authenticated,service_role;
  alter default privileges in schema public revoke usage,select on sequences from anon,authenticated,service_role;`;

async function apply(db, file) {
  let sql = await read(migrationDir + file);
  if (file === files[0]) {
    // PGlite has pgcrypto but no pg_cron background worker. The fixture above
    // provides only cron catalog/schedule so migration assertions can execute.
    const cronExtension = 'create extension if not exists pg_cron with schema pg_catalog;';
    assert.equal(sql.split(cronExtension).length, 2);
    sql = sql.replace(cronExtension, '-- pg_cron catalog supplied by platform-fixture.sql');
  }
  try { await db.exec(sql); }
  catch (error) { throw new Error(`Migration ${file}: ${error.message}`, { cause: error }); }
}
async function query(db, sql) { return (await db.query(sql)).rows; }
async function acl(db) {
  return query(db, `select c.relname,c.relacl::text,
    (select jsonb_agg(jsonb_build_array(attname,attacl::text) order by attnum)
     from pg_attribute where attrelid=c.oid and attnum>0 and not attisdropped) as columns
    from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','S') order by c.relname`);
}
async function browserAcl(db) {
  return query(db, `select r.role,c.relname,a.attname,p.op,
    has_column_privilege(r.role,c.oid,a.attname,p.op) as allowed
    from pg_class c join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
    cross join (values('anon'),('authenticated')) r(role)
    cross join (values('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(op)
    where c.relnamespace='public'::regnamespace and c.relkind='r'
    order by r.role,c.relname,a.attname,p.op`);
}
async function expect42501(db, sql, name) {
  await assert.rejects(db.exec(`begin; set local role service_role; ${sql}; rollback;`),
    e => e.code === '42501', name);
  await db.exec('rollback');
}

for (const scenario of ['new-deployment', 'db-reset', 'existing-upgrade']) {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(await read('tests/db/platform-fixture.sql'));
    console.log(`${scenario}: ${(await query(db, 'select version()'))[0].version}`);
    if (scenario === 'existing-upgrade') await db.exec(defaults);
    if (scenario === 'db-reset') {
      // Establish old defaults, remove them BEFORE rebuilding public objects.
      await db.exec(defaults);
      await db.exec('create table public.reset_probe(id int); drop schema public cascade; create schema public; grant usage on schema public to anon,authenticated,service_role,supabase_auth_admin;');
      await db.exec(optOut);
    }
    for (const file of files.filter(f => f < patch)) await apply(db, file);
    if (scenario === 'existing-upgrade') {
      const before = await acl(db);
      await db.exec(optOut);
      assert.deepEqual(await acl(db), before, 'opt-out must preserve existing ACLs');
    } else {
      // Baseline failures prove why each added table grant is needed.
      await expect42501(db, 'select id,status from public.prayer_requests limit 0', 'prayer SELECT baseline');
      await expect42501(db, 'insert into public.prayer_requests default values', 'prayer INSERT baseline');
      await expect42501(db, 'select user_id from public.admin_profiles limit 0', 'profile SELECT baseline');
      await expect42501(db, 'insert into public.admin_profiles default values', 'profile INSERT baseline');
      await expect42501(db, 'update public.admin_profiles set active=false where false', 'profile UPDATE baseline');
      await expect42501(db, 'delete from public.admin_profiles where false', 'profile DELETE baseline');
      await expect42501(db, "insert into public.admin_audit(action) values('baseline')", 'audit INSERT baseline');
      // Existing catalog test did not detect these missing service grants.
      await db.exec(await read('supabase/tests/retreat_prayer_security.test.sql'));
      console.log(`${scenario}: 7 missing-privilege operations reproduced; old security test still passes`);
    }
    const beforeBrowser = await browserAcl(db);
    const beforeAcl = await acl(db);
    const beforePolicies = await query(db, 'select * from pg_policies order by schemaname,tablename,policyname');
    await apply(db, patch);
    assert.deepEqual(await browserAcl(db), beforeBrowser, 'patch changed browser ACLs');
    assert.deepEqual(await query(db, 'select * from pg_policies order by schemaname,tablename,policyname'), beforePolicies, 'patch changed RLS policies');
    if (scenario === 'existing-upgrade') assert.deepEqual(await acl(db), beforeAcl, 'existing grants should already suffice');
    const once = await acl(db);
    await apply(db, patch);
    assert.deepEqual(await acl(db), once, 'patch must be idempotent');
    for (const file of files.filter(f => f > patch)) await apply(db, file);
    // No accidental service access to unrelated tables on a clean rebuild.
    if (scenario !== 'existing-upgrade') {
      assert.deepEqual(await query(db, `select c.relname,p.op from pg_class c
        cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE')) p(op)
        where c.relnamespace='public'::regnamespace and c.relkind='r'
        and has_table_privilege('service_role',c.oid,p.op) order by c.relname,p.op`),
        ['admin_audit:INSERT','admin_invite_nonces:DELETE','admin_invite_nonces:INSERT','admin_invite_nonces:SELECT',
         'admin_profiles:DELETE','admin_profiles:INSERT','admin_profiles:SELECT','admin_profiles:UPDATE',
         'prayer_requests:INSERT','prayer_requests:SELECT'].map(s => { const [relname,op]=s.split(':');return {relname,op}; }));
    }
    for (const test of ['retreat_prayer_security.test.sql','retreat_prayer_event_quota.test.sql','retreat_prayer_grants.test.sql']) {
      try { await db.exec(await read('supabase/tests/' + test)); }
      catch(e) { throw new Error(`${scenario}/${test}: ${e.message}`, {cause:e}); }
    }
    console.log(`PASS ${scenario}: migrations, grants, RLS, Edge SQL, quota, unchanged browser ACLs, idempotence`);
  } finally { await db.close(); }
}
