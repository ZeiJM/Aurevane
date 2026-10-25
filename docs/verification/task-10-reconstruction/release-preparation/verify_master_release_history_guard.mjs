import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { PGlite } from './aurevane-master-complete-20261025/node_modules/.pnpm/@electric-sql+pglite@0.5.8/node_modules/@electric-sql/pglite/dist/index.js';

const root = new URL('./', import.meta.url).pathname;
const manifest = JSON.parse(await readFile(root + 'master-provisional-fix3-migration-manifest.json', 'utf8'));
const aliases = JSON.parse(await readFile(root + 'master-release-guard-alias-fixtures.json', 'utf8'));
const scenarios = [
  ['exact history accepted', '', null],
  ['added history rejected', "insert into supabase_migrations.schema_migrations values ('extra','unexpected',array['select 1']);", 'MASTER_HISTORY_COUNT_CHANGED'],
  ['rewritten history rejected', "update supabase_migrations.schema_migrations set name='changed' where version='fixture-0';", 'MASTER_HISTORY_CONTENT_CHANGED'],
  ['alias body mismatch rejected after fresh hash', "update supabase_migrations.schema_migrations set statements=array['select 1'] where version='20261014045202';", 'MASTER_LEGACY_ALIAS_CHANGED', true],
];
const receipts = [];
for (const [name, mutation, expected, refreshHash] of scenarios) {
  const db = new PGlite();
  try {
    await db.exec('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]); create table public.guard_probe(id integer);');
    for (const row of aliases) await db.query('insert into supabase_migrations.schema_migrations values ($1,$2,$3)', [row.version,row.name,row.statements]);
    for (let i=0; i<137; i++) await db.query("insert into supabase_migrations.schema_migrations values ($1,'fixture',array['select 1'])", ['fixture-'+i]);
    const getHash = async () => (await db.query("select encode(sha256(convert_to(jsonb_agg(to_jsonb(m) order by version)::text,'UTF8')),'hex') digest from supabase_migrations.schema_migrations m")).rows[0].digest;
    let hash = await getHash();
    if (mutation) await db.exec(mutation);
    if (refreshHash) hash = await getHash();
    const fixtureManifest = root + 'master-release-history-test-manifest.json';
    const fixtureSql = root + 'master-release-history-test.sql';
    await writeFile(fixtureManifest, JSON.stringify({ ...manifest, observedHostedHistorySha256: hash }));
    const generated = spawnSync('python',[root+'prepare_master_release_sql.py','--git-dir',root+'aurevane/.git','--manifest',fixtureManifest,'--output',fixtureSql],{encoding:'utf8'});
    if (generated.status !== 0) throw new Error(generated.stderr);
    const batch = await readFile(fixtureSql,'utf8');
    const split = batch.indexOf('create temporary table av_master_facts(');
    if (split<0) throw new Error('Missing generated capture boundary');
    const prefix = batch.slice(0,split);
    let error;
    try { await db.exec(prefix + 'insert into public.guard_probe values (1); commit;'); }
    catch (caught) { error=caught; await db.exec('rollback;'); }
    if (expected ? !error?.message.includes(expected) : error) throw new Error(`${name}: ${error?.message ?? 'expected rejection missing'}`);
    const count=(await db.query('select count(*)::integer n from public.guard_probe')).rows[0].n;
    if (count !== (expected ? 0:1)) throw new Error(`${name}: execution crossed failed preflight`);
    receipts.push({name,passed:true,expectedRejection:expected,actualRejection:error?.message ?? null});
  } finally { await db.close(); }
}
await writeFile(root+'master-release-history-guard-verification.json',JSON.stringify({verifiedAt:new Date().toISOString(),engine:'PGlite 0.5.8; local preflight verification only',receipts},null,2)+'\n');
console.log(JSON.stringify({passed:receipts.length,total:scenarios.length,nativePostgres:false,hostedExecuted:false}));
