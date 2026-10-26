import { afterAll, beforeAll, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
const migration = '20261026072745_domain_rpc_conflict_codes.sql'
const owner = '00000000-0000-4000-8000-000000000001'
const pattern = "errcode[[:space:]]*=[[:space:]]*'40001'"
interface Definition {
  signature: string
  definition: string
  acl: string | null
  owner: number
  count: number
}
let db: PGlite
let predecessors: Definition[]
beforeAll(async () => {
  db = await createCombatContentTestDatabase(async (database, name) => {
    if (name === migration)
      predecessors = (
        await database.query<Definition>(
          `select format('%I.%I(%s)',n.nspname,p.proname,oidvectortypes(p.proargtypes)) signature, pg_get_functiondef(p.oid) definition,proacl::text acl,proowner owner,(select count(*)::int from regexp_matches(p.prosrc,$1,'gi')) count from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prosrc ~* $1 order by signature`,
          [pattern],
        )
      ).rows
  })
  await db.exec(
    `insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now()); insert into app_private.master_panel_role_assignments(user_id,role) values('${owner}','game-owner');`,
  )
}, 60000)
afterAll(async () => {
  await db?.close()
})
it('changes only intentional domain SQLSTATE assignments and preserves every audited full function body, owner and ACL', async () => {
  expect(predecessors).toHaveLength(35)
  expect(predecessors.reduce((count, row) => count + row.count, 0)).toBe(65)
  for (const before of predecessors) {
    const after = (
      await db.query<Definition>(
        'select pg_get_functiondef($1::regprocedure) definition,proacl::text acl,proowner owner from pg_proc where oid=$1::regprocedure',
        [before.signature],
      )
    ).rows[0]!
    expect(after.definition, before.signature).toBe(
      before.definition.replace(/errcode\s*=\s*'40001'/gi, "errcode='PT409'"),
    )
    expect(after.acl, before.signature).toBe(before.acl)
    expect(after.owner, before.signature).toBe(before.owner)
  }
  const remaining = await db.query(
    `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prosrc ~* $1`,
    [pattern],
  )
  expect(remaining.rows).toEqual([])
})
it('Master catalogue and record CAS return one PT409 rejection without writes, while invalid input keeps its original error', async () => {
  await db.exec('begin')
  try {
    const state = () =>
      db.query<{ value: string }>(
        "select md5(jsonb_build_object('records',(select jsonb_agg(to_jsonb(r) order by content_key) from app_private.combat_content_records r),'versions',(select count(*) from app_private.combat_content_versions),'drafts',(select count(*) from app_private.combat_content_drafts),'requests',(select count(*) from app_private.combat_content_record_requests))::text) value",
      )
    const before = (await state()).rows
    await db.exec('savepoint catalogue')
    await expect(
      db.query('select app_private.lock_combat_content_catalogue_v1($1)', ['0'.repeat(32)]),
    ).rejects.toMatchObject({ code: 'PT409', message: 'COMBAT_CONTENT_CATALOGUE_CONFLICT' })
    await db.exec('rollback to savepoint catalogue')
    await expect(
      db.query('select public.write_combat_content_record_v1($1,null,$2,$3)', [
        owner,
        'vanguard.forceful-strike',
        { action: 'save', expectedRevision: 999, definition: {} },
      ]),
    ).rejects.toMatchObject({ code: 'PT409', message: 'COMBAT_CONTENT_RECORD_CONFLICT' })
    await db.exec('rollback to savepoint catalogue')
    expect((await state()).rows).toEqual(before)
    await expect(
      db.query('select public.write_combat_content_record_v1($1,null,$2,$3)', [
        owner,
        'vanguard.forceful-strike',
        { action: 'invented' },
      ]),
    ).rejects.toMatchObject({ code: '22023', message: 'COMBAT_CONTENT_COMMAND_INVALID' })
    await db.exec('rollback to savepoint catalogue')
    expect((await state()).rows).toEqual(before)
  } finally {
    await db.exec('rollback')
  }
})
