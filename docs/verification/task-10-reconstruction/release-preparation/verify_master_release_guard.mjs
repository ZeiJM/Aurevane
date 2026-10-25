import { readFile, writeFile } from 'node:fs/promises';
import { PGlite } from './aurevane-master-complete-20261025/node_modules/.pnpm/@electric-sql+pglite@0.5.8/node_modules/@electric-sql/pglite/dist/index.js';

const { capture, compare } = JSON.parse(await readFile(new URL('./master-release-guard-fragments.json', import.meta.url), 'utf8'));
const cases = [
  ['unchanged', '', null],
  ['allowed logical new-column backfill', 'alter table app_private.combat_content_versions add column eligible boolean default true; update app_private.combat_content_versions set eligible=false;', null],
  ['logical old fact mutation', "update app_private.combat_content_versions set fact='changed';", 'MASTER_PROTECTED_FACTS_CHANGED'],
  ['physical old fact mutation', "update app_private.player_facts set fact='changed';", 'MASTER_PROTECTED_FACTS_CHANGED'],
  ['physical no-op write', 'update app_private.player_facts set fact=fact;', 'MASTER_PROTECTED_FACTS_CHANGED'],
  ['physical truncate and reinsert', "truncate app_private.player_facts; insert into app_private.player_facts values (1,'retained');", 'MASTER_PROTECTED_TABLE_REWRITTEN'],
  ['logical old type mutation', 'alter table app_private.combat_content_versions alter column fact type varchar(30);', 'MASTER_OLD_COLUMN_TYPE_CHANGED'],
  ['old table replacement', 'alter table app_private.player_facts rename to player_facts_old; create table app_private.player_facts(id integer, fact text);', 'MASTER_TABLE_IDENTITY_CHANGED'],
];
const receipts = [];
for (const [name, change, expected] of cases) {
  const db = new PGlite();
  try {
    await db.exec("create schema app_private; create table app_private.player_facts(id integer primary key, fact text); insert into app_private.player_facts values (1,'retained'); create table app_private.combat_content_versions(id integer primary key, fact text); insert into app_private.combat_content_versions values (1,'original');");
    let error;
    try { await db.exec('begin isolation level repeatable read;' + capture + change + compare + 'commit;'); }
    catch (caught) { error = caught; await db.exec('rollback;'); }
    if (expected ? !error?.message.includes(expected) : error) throw new Error(`${name}: ${error?.message ?? 'expected rejection missing'}`);
    if (expected) {
      const rows = await db.query('select fact from app_private.player_facts where id=1');
      if (rows.rows[0]?.fact !== 'retained') throw new Error(`${name}: rollback did not preserve original`);
      const logical = await db.query('select fact from app_private.combat_content_versions where id=1');
      if (logical.rows[0]?.fact !== 'original') throw new Error(`${name}: logical fact not restored`);
    }
    receipts.push({ name, passed: true, expectedRejection: expected, actualRejection: error?.message ?? null });
  } finally { await db.close(); }
}
await writeFile(new URL('./master-release-guard-verification.json', import.meta.url), JSON.stringify({ verifiedAt: new Date().toISOString(), engine: 'PGlite 0.5.8; local guard verification only', receipts }, null, 2) + '\n');
console.log(JSON.stringify({ passed: receipts.length, total: cases.length, nativePostgres: false }));
