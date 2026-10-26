import { afterAll, beforeAll, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
const migration = '20261026065354_world_stale_rpc_conflict_code.sql'
const owner = '00000000-0000-4000-8000-000000000001'
const character = '00000000-0000-4000-8000-000000000011'
const signature = 'public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text)'
const old = "raise exception 'WORLD_STALE_VERSION' using errcode='40001';"
let db: PGlite
let predecessor: { definition: string; acl: unknown }
const initial = {
  version: 1,
  position: { sectorId: 'verdant-expanse', x: 5, y: 4 },
  safe: false,
  route: [],
  nextStepAt: null,
  discoveries: {},
  completedObjectives: [],
}
beforeAll(async () => {
  db = await createCombatContentTestDatabase(async (database, name) => {
    if (name === migration)
      predecessor = (
        await database.query<{ definition: string; acl: unknown }>(
          'select pg_get_functiondef($1::regprocedure) definition,proacl::text acl from pg_proc where oid=$1::regprocedure',
          [signature],
        )
      ).rows[0]!
  })
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now());
 insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
 values('${character}','${owner}',0,1,'Test Player','test-player','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`)
  await db.query(
    'insert into app_private.character_world_state(character_id,state) values($1,$2)',
    [character, initial],
  )
}, 60000)
afterAll(async () => {
  await db?.close()
})
it('changes only the intentional stale SQLSTATE while preserving the function ACL and complete authority body', async () => {
  const after = (
    await db.query<{ definition: string; acl: unknown }>(
      'select pg_get_functiondef($1::regprocedure) definition,proacl::text acl from pg_proc where oid=$1::regprocedure',
      [signature],
    )
  ).rows[0]!
  expect(after.definition).toBe(
    predecessor.definition.replace(
      old,
      "raise exception 'WORLD_STALE_VERSION' using errcode='PT409';",
    ),
  )
  expect(after.acl).toEqual(predecessor.acl)
})
it('returns PT409 with unchanged stale message and facts, while a valid commit and idempotent replay still work', async () => {
  await db.exec('begin')
  try {
    const before = (
      await db.query(
        'select to_jsonb(w) value from app_private.character_world_state w where character_id=$1',
        [character],
      )
    ).rows
    await db.exec('savepoint stale')
    await expect(
      db.query("select public.commit_world_state_v1($1,$2,0,$3,'stop',$4)", [
        owner,
        character,
        '00000000-0000-4000-8000-000000000091',
        initial,
      ]),
    ).rejects.toMatchObject({ code: 'PT409', message: 'WORLD_STALE_VERSION' })
    await db.exec('rollback to savepoint stale')
    expect(
      (
        await db.query(
          'select to_jsonb(w) value from app_private.character_world_state w where character_id=$1',
          [character],
        )
      ).rows,
    ).toEqual(before)
    const args = [owner, character, 1, '00000000-0000-4000-8000-000000000092', 'stop', initial]
    const sql = 'select public.commit_world_state_v1($1,$2,$3,$4,$5,$6) value'
    const first = (await db.query<{ value: { version: number } }>(sql, args)).rows[0]!.value
    expect(first.version).toBe(2)
    expect((await db.query<{ value: { version: number } }>(sql, args)).rows[0]!.value).toEqual(
      first,
    )
  } finally {
    await db.exec('rollback')
  }
})
