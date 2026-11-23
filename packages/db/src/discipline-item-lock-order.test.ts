import { afterAll, beforeAll, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import { readFileSync } from 'node:fs'

const account =
  '  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));\n'
const buildAnchor = '  select * into v_build\n  from app_private.character_active_builds build'
const catalogueAnchor = '  perform app_private.lock_current_discipline_selection_v1();\n'
const changes = [
  [
    'public.save_character_discipline_skill_loadout_v1(uuid,uuid,bigint,jsonb,uuid,text)',
    buildAnchor,
    account + '\n' + buildAnchor,
  ],
  [
    'public.save_character_build_loadout_v1(uuid,uuid,smallint,text,bigint,uuid,text)',
    buildAnchor,
    account + '\n' + buildAnchor,
  ],
  ...['v2', 'v3'].map(
    (version) =>
      [
        `public.change_character_disciplines_${version}(uuid,uuid,bigint,boolean,text,boolean,text,uuid,text)`,
        catalogueAnchor,
        catalogueAnchor + account,
      ] as const,
  ),
  [
    'app_private.refresh_character_primary_profile_v1(uuid,uuid)',
    catalogueAnchor.slice(1),
    catalogueAnchor.slice(1) +
      " if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0)) then raise exception using errcode='PT409',message='COMBAT_CONTENT_ADMISSION_RETRY'; end if;\n",
  ],
] as const
type Definition = { definition: string; acl: string | null; owner: number }
let db: PGlite
const predecessors = new Map<string, Definition>()
beforeAll(async () => {
  db = await createCombatContentTestDatabase(async (database, name) => {
    if (name === '20261103130149_discipline_item_lock_order.sql') {
      for (const [signature] of changes)
        predecessors.set(
          signature,
          (
            await database.query<Definition>(
              'select pg_get_functiondef(oid) definition,proacl::text acl,proowner owner from pg_proc where oid=$1::regprocedure',
              [signature],
            )
          ).rows[0]!,
        )
    }
  })
}, 60000)
afterAll(async () => db?.close())

it.each(changes)(
  'orders the shared account lock without changing authority, replay, CAS or privileges: %s',
  async (signature, anchor, replacement) => {
    const before = predecessors.get(signature)!
    const after = (
      await db.query<Definition>(
        'select pg_get_functiondef(oid) definition,proacl::text acl,proowner owner from pg_proc where oid=$1::regprocedure',
        [signature],
      )
    ).rows[0]!
    expect(after.definition).toBe(before.definition.replace(anchor, replacement))
    expect(after.acl).toBe(before.acl)
    expect(after.owner).toBe(before.owner)
  },
)

it('keeps nested loadout and Master callers outside the new account lock before their first build row', async () => {
  for (const [caller, outer] of [
    [
      'public.activate_character_build_loadout_v1(uuid,uuid,smallint,bigint,uuid,text)',
      'perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,false)',
    ],
    [
      'public.edit_master_player_v1(uuid,uuid,text,uuid,jsonb,boolean,uuid)',
      'pg_try_advisory_xact_lock(pg_catalog.hashtextextended(v_character.user_id::text,0))',
    ],
  ]) {
    const body = (
      await db.query<{ body: string }>('select pg_get_functiondef($1::regprocedure) body', [caller])
    ).rows[0]!.body
    expect(body.indexOf(outer), caller).toBeGreaterThan(-1)
    expect(body.indexOf(outer), caller).toBeLessThan(
      body.indexOf('from app_private.character_active_builds'),
    )
    expect(body).toContain('public.save_character_discipline_skill_loadout_v1(')
  }
})

it('serially preserves actual Skill/Support receipts, stale rejection, foreign refusal and inventory isolation', async () => {
  const user = '00000000-0000-4000-8000-000000008701'
  const character = '00000000-0000-4000-8000-000000008711'
  await db.exec(`begin;
    insert into auth.users(id,email,email_confirmed_at) values('${user}','skill-lock@example.test',now());
    insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
    values('${character}','${user}',0,1,'Skill Lock','skill-lock','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`)
  try {
    await db.exec(
      readFileSync(
        new URL('../../../.github/scripts/support-discipline-race-fixture.sql', import.meta.url),
        'utf8',
      ),
    )
    await db.exec("set local aurevane.support_race_gate='local-sequential-gate'")
    const key = '00000000-0000-4000-8000-000000008721'
    const skills = (actor = user, version = 1, fingerprint = 'skills:lock-order') =>
      db.query<{ build_version: number; replayed: boolean }>(
        "select * from public.save_character_discipline_skill_loadout_v1($1,$2,$3,'[]'::jsonb,$4,$5)",
        [actor, character, version, key, fingerprint],
      )
    expect((await skills()).rows[0]).toMatchObject({ build_version: 2, replayed: false })
    expect(
      (
        await db.query('select 1 from app_private.character_item_inventory where character_id=$1', [
          character,
        ])
      ).rows,
    ).toEqual([])
    await db.query(
      "select * from public.save_character_support_action_v1($1,$2,2,'basic.recover.mp',gen_random_uuid(),'support:lock-order')",
      [user, character],
    )
    expect((await skills()).rows[0]).toMatchObject({ build_version: 2, replayed: true })
    for (const [operation, message] of [
      [
        () => skills(user, 1, 'changed:fingerprint'),
        'CHARACTER_SKILL_LOADOUT_IDEMPOTENCY_CONFLICT',
      ],
      [() => skills('00000000-0000-4000-8000-000000008702'), 'CHARACTER_BUILD_NOT_FOUND'],
      [
        () =>
          db.query(
            "select * from public.save_character_discipline_skill_loadout_v1($1,$2,1,'[]'::jsonb,gen_random_uuid(),'stale:skills')",
            [user, character],
          ),
        'CHARACTER_BUILD_VERSION_CONFLICT',
      ],
    ] as const) {
      await db.exec('savepoint rejected')
      await expect(operation()).rejects.toThrow(message)
      await db.exec('rollback to savepoint rejected; release savepoint rejected')
    }
    expect(
      (
        await db.query<{
          snapshot: { buildVersion: number; supportActionId: string; disciplineSkills: unknown[] }
        }>('select public.get_character_committed_build_snapshot_v2($1,$2) snapshot', [
          user,
          character,
        ])
      ).rows[0]!.snapshot,
    ).toMatchObject({ buildVersion: 3, supportActionId: 'basic.recover.mp', disciplineSkills: [] })
  } finally {
    await db.exec('rollback')
  }
})

it('keeps training character writers out of the account/build lock graph and refresh row reads nonblocking', async () => {
  const training = (
    await db.query<{ name: string; body: string }>(
      "select proname name,prosrc body from pg_proc where pronamespace='public'::regnamespace and proname in ('claim_training_report_v1','materialize_training_report_v2','set_wayfarers_practice_plan_v1','stop_passive_training_v1')",
    )
  ).rows
  expect(training).toHaveLength(4)
  for (const row of training) {
    expect(row.body, row.name).not.toMatch(
      /character_active_builds|advisory_xact_lock|change_character_disciplines|refresh_character_primary_profile/,
    )
    expect(row.body, row.name).toMatch(/public.characters[\s\S]*for update/)
  }
  const triggers = (
    await db.query<{ name: string; body: string }>(
      "select p.proname name,p.prosrc body from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgrelid='public.characters'::regclass and not t.tgisinternal and (t.tgtype::int & 16)<>0",
    )
  ).rows
  for (const row of triggers)
    expect(row.body, row.name).not.toMatch(
      /character_active_builds|advisory_xact_lock|change_character_disciplines|refresh_character_primary_profile/,
    )
  const refresh = (
    await db.query<{ body: string }>(
      "select prosrc body from pg_proc where oid='app_private.refresh_character_primary_profile_v1(uuid,uuid)'::regprocedure",
    )
  ).rows[0]!.body
  expect(refresh.match(/for update nowait/g)).toHaveLength(3)
  expect(refresh).not.toMatch(/for update(?! nowait)/)
  expect(refresh.indexOf('pg_try_advisory_xact_lock(')).toBeGreaterThan(-1)
  expect(refresh.indexOf('pg_try_advisory_xact_lock(')).toBeLessThan(
    refresh.indexOf('for update nowait'),
  )
  expect(refresh).toContain("errcode='PT409',message='COMBAT_CONTENT_ADMISSION_RETRY'")
})
