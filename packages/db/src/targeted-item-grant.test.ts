import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import { itemFixture } from '../../game-core/src/content/items-test-fixtures'

const owner = '00000000-0000-4000-8000-000000008001'
const player = '00000000-0000-4000-8000-000000008002'
const actor = '00000000-0000-4000-8000-000000008011'
const target = '00000000-0000-4000-8000-000000008012'
const missing = '00000000-0000-4000-8000-000000008099'
const requestKey = '00000000-0000-4000-8000-000000008021'
const helm = itemFixture()
const material = itemFixture({
  id: 'target.ore',
  inventoryCategory: 'materials',
  itemClass: 'material',
  equipment: null,
  qualityPoints: 0,
  maximumStack: 99,
})
let db: PGlite
type TargetView = {
  target: { characterId: string; name: string }
  revision: number
  catalogueToken: string
  battleLocked: boolean
}
const call = async <T>(name: string, args: unknown[]) =>
  (
    await db.query<{ value: T }>(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) value`,
      args,
    )
  ).rows[0]!.value
const search = (query: string, user = owner, selected: string | null = actor) =>
  call<{ characters: { characterId: string; name: string }[] }>(
    'search_master_item_grant_characters_v1',
    [user, selected, query],
  )
const read = (id = target, user = owner, selected: string | null = actor) =>
  call<TargetView>('read_master_item_grant_target_v1', [user, selected, id])
const grant = (
  view: TargetView,
  overrides: {
    item?: string
    quantity?: number
    revision?: number
    token?: string
    key?: string
    id?: string
    user?: string
    selected?: string | null
  } = {},
) =>
  call('grant_master_item_to_character_v1', [
    overrides.user ?? owner,
    overrides.selected === undefined ? actor : overrides.selected,
    overrides.id ?? target,
    overrides.item ?? helm.id,
    overrides.quantity ?? 1,
    overrides.revision ?? view.revision,
    overrides.token ?? view.catalogueToken,
    overrides.key ?? requestKey,
  ])
async function fails(work: () => Promise<unknown>, message: string) {
  await db.exec('savepoint rejected')
  await expect(work()).rejects.toThrow(message)
  await db.exec('rollback to savepoint rejected; release savepoint rejected')
}
const facts = async () =>
  (
    await db.query<{ value: unknown }>(
      `select jsonb_build_object('inventory',(select jsonb_agg(to_jsonb(i)) from app_private.character_item_inventory i),'stacks',(select jsonb_agg(to_jsonb(s)) from app_private.character_item_stacks s),'grants',(select jsonb_agg(to_jsonb(g)) from app_private.character_item_grants g),'audit',(select jsonb_agg(to_jsonb(a)) from app_private.player_support_audit a)) value`,
    )
  ).rows[0]!.value
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'owner-target@example.test',now()),($2,'recipient@example.test',now())",
    [owner, player],
  )
  for (const [id, user, name] of [
    [actor, owner, 'Grant Actor'],
    [target, player, 'Recipient One'],
  ])
    await db.query(
      `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at) values($1,$2,0,1,$3,lower($3),'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
      [id, user, name],
    )
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [owner],
  )
}, 60000)
afterAll(async () => db?.close())
beforeEach(async () => {
  await db.exec('begin')
  await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
    JSON.stringify([helm, material]),
  ])
})
afterEach(async () => {
  await db.exec('rollback')
})

it('looks up names with bounded literal case-insensitive search and returns no account identity', async () => {
  expect(await search('  RECIPIENT  ')).toEqual({
    characters: [{ characterId: target, name: 'Recipient One' }],
  })
  expect(await search('%_')).toEqual({ characters: [] })
  await fails(() => search(' '), 'ITEM_GRANT_SEARCH_INVALID')
  await fails(() => search('a'.repeat(81)), 'ITEM_GRANT_SEARCH_INVALID')
  expect((await db.query('select * from app_private.character_item_inventory')).rows).toEqual([])
})
it('limits lookup to twenty deterministic character matches', async () => {
  for (let i = 0; i < 23; i++) {
    const id = `00000000-0000-4000-8000-${String(8500 + i).padStart(12, '0')}`
    await db.query('insert into auth.users(id) values($1)', [id])
    await db.query(
      `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at) select $1,$1,0,1,$2,lower($2),presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at from public.characters where id=$3`,
      [id, `Lookup ${String(i).padStart(2, '0')}`, actor],
    )
  }
  const result = await search('lookup')
  expect(result.characters).toHaveLength(20)
  expect(result.characters.map((row) => row.name)).toEqual(
    Array.from({ length: 20 }, (_, i) => `Lookup ${String(i).padStart(2, '0')}`),
  )
})
it('requires protected Owner authority and a valid selected owned actor for every operation', async () => {
  const view = await read()
  await db.query(
    "insert into app_private.master_panel_character_access(character_id,user_id,roles,updated_by) values($1,$2,array['content-staff'],$3)",
    [target, player, owner],
  )
  for (const [user, selected] of [
    [player, target],
    [owner, target],
    [owner, missing],
    [owner, null],
  ] as const) {
    await fails(() => search('recipient', user, selected), 'MASTER_ITEM_GRANT_OWNER_REQUIRED')
    await fails(() => read(target, user, selected), 'MASTER_ITEM_GRANT_OWNER_REQUIRED')
    await fails(() => grant(view, { user, selected }), 'MASTER_ITEM_GRANT_OWNER_REQUIRED')
  }
  expect((await db.query('select * from app_private.character_item_stacks')).rows).toEqual([])
})
it('derives recipient ownership and grants once with immutable actor/recipient audit', async () => {
  const view = await read()
  expect(view).toMatchObject({
    target: { characterId: target, name: 'Recipient One' },
    revision: 0,
    battleLocked: false,
  })
  expect(await grant(view)).toEqual({ target: view.target, revision: 1 })
  expect(await grant(view)).toEqual({ target: view.target, revision: 1 })
  expect(
    (await db.query('select character_id,item_id,quantity from app_private.character_item_stacks'))
      .rows,
  ).toEqual([{ character_id: target, item_id: helm.id, quantity: 1 }])
  const audit = (await db.query('select * from app_private.player_support_audit')).rows
  expect(audit).toHaveLength(1)
  expect(audit[0]).toMatchObject({
    actor_user_id: owner,
    actor_character_id: actor,
    character_id: target,
    before_facts: { kind: 'item-target-grant', revision: 0 },
    after_facts: { itemId: helm.id, quantity: 1, contentVersion: helm.contentVersion, revision: 1 },
  })
  await fails(
    () => db.query("update app_private.player_support_audit set after_facts='{}'"),
    'SUPPORT_AUDIT_IMMUTABLE',
  )
  const before = await facts()
  await fails(() => grant(view, { item: material.id }), 'ITEM_GRANT_CONFLICT')
  await fails(() => grant(view, { id: actor }), 'ITEM_GRANT_CONFLICT')
  expect(await facts()).toEqual(before)
})
it('retains revision/catalogue CAS, item availability and exact quantity bounds without partial changes', async () => {
  const view = await read()
  const before = await facts()
  await fails(() => grant(view, { revision: 12 }), 'ITEM_STALE_REVISION')
  await fails(() => grant(view, { token: '0'.repeat(32) }), 'ITEM_STALE_CATALOGUE')
  for (const quantity of [0, 100, 2])
    await fails(() => grant(view, { quantity }), 'ITEM_TEST_GRANT_INVALID')
  await fails(() => grant(view, { item: 'missing.item' }), 'ITEM_DEFINITION_UNAVAILABLE')
  expect(await facts()).toEqual(before)
  await grant(view, { item: material.id, quantity: 99 })
  expect((await db.query('select quantity from app_private.character_item_stacks')).rows).toEqual([
    { quantity: 99 },
  ])
})
it('checks category capacity atomically using the canonical inventory writer', async () => {
  await db.query("select public.grant_character_items_v1($1,$2,0,'full',$3::jsonb)", [
    player,
    target,
    JSON.stringify([{ itemId: helm.id, quantity: 40 }]),
  ])
  const view = await read(),
    before = await facts()
  await fails(() => grant(view), 'ITEM_CAPACITY')
  expect(await facts()).toEqual(before)
})
it('rejects a changed source catalogue token and grants the new immutable version only after refresh', async () => {
  const stale = await read()
  await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
    JSON.stringify([{ ...helm, contentVersion: helm.contentVersion + 1 }]),
  ])
  const before = await facts()
  await fails(() => grant(stale), 'ITEM_STALE_CATALOGUE')
  expect(await facts()).toEqual(before)
  await grant(await read())
  expect(
    (await db.query('select acquired_content_version from app_private.character_item_stacks')).rows,
  ).toEqual([{ acquired_content_version: helm.contentVersion + 1 }])
})
it('rejects unavailable current Items without issuing receipts or changing inventory', async () => {
  await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
    JSON.stringify([{ ...helm, enabled: false, contentVersion: helm.contentVersion + 1 }]),
  ])
  const view = await read(),
    before = await facts()
  await fails(() => grant(view), 'ITEM_TEST_GRANT_INVALID')
  expect(await facts()).toEqual(before)
})
it.each(['pending', 'active'])(
  'blocks fresh grants during a %s battle and keeps frozen state intact',
  async (lifecycle) => {
    const view = await read(),
      battle = crypto.randomUUID()
    await db.exec('set local session_replication_role=replica')
    await db.query(
      "insert into app_private.battle_sessions(id,owner_user_id,battle_id,rules_version,content_version,lifecycle,current_snapshot) values($1,$2,'target-items',1,1,$3,'{\"frozen\":true}')",
      [battle, player, lifecycle],
    )
    await db.query(
      "insert into app_private.battle_participants(battle_session_id,combatant_id,participant_role,user_id,character_id) values($1,'player','player',$2,$3)",
      [battle, player, target],
    )
    await db.exec('set local session_replication_role=origin')
    expect(await read()).toMatchObject({ battleLocked: true })
    const before = await facts()
    await fails(() => grant(view), 'ITEM_BATTLE_ACTIVE')
    expect(await facts()).toEqual(before)
    expect(
      (
        await db.query('select current_snapshot from app_private.battle_sessions where id=$1', [
          battle,
        ])
      ).rows[0],
    ).toEqual({ current_snapshot: { frozen: true } })
  },
)
it('rejects missing, physically deleted and deletion-pending recipients before mutation', async () => {
  const view = await read()
  await fails(() => read(missing), 'ITEM_GRANT_TARGET_UNAVAILABLE')
  await fails(() => grant(view, { id: missing }), 'ITEM_GRANT_TARGET_UNAVAILABLE')
  await db.query(
    "insert into app_private.character_deletion_requests(character_id,user_id,requested_at,delete_after) values($1,$2,now(),now()+interval '1 day')",
    [target, player],
  )
  expect(await search('recipient')).toEqual({ characters: [] })
  const before = await facts()
  await fails(() => read(), 'ITEM_DELETION_PENDING')
  await fails(() => grant(view), 'ITEM_DELETION_PENDING')
  expect(await facts()).toEqual(before)
  await db.query('delete from public.characters where id=$1', [target])
  await fails(() => grant(view), 'ITEM_GRANT_TARGET_UNAVAILABLE')
})
it('hides account deletion recipients and rejects both recipient and actor deletion states', async () => {
  const view = await read()
  await db.query(
    "insert into app_private.account_deletion_requests(user_id,requested_at,delete_after) values($1,now(),now()+interval '1 day')",
    [player],
  )
  expect(await search('recipient')).toEqual({ characters: [] })
  const before = await facts()
  await fails(() => grant(view), 'ITEM_DELETION_PENDING')
  expect(await facts()).toEqual(before)
  await db.query(
    "insert into app_private.character_deletion_requests(character_id,user_id,requested_at,delete_after) values($1,$2,now(),now()+interval '1 day')",
    [actor, owner],
  )
  await fails(() => search('recipient'), 'MASTER_ITEM_GRANT_OWNER_REQUIRED')
  await fails(() => read(), 'MASTER_ITEM_GRANT_OWNER_REQUIRED')
  await fails(() => grant(view), 'MASTER_ITEM_GRANT_OWNER_REQUIRED')
})
it('exposes the new RPCs to service role only and leaves self-test grants available', async () => {
  for (const signature of [
    'search_master_item_grant_characters_v1(uuid,uuid,text)',
    'read_master_item_grant_target_v1(uuid,uuid,uuid)',
    'grant_master_item_to_character_v1(uuid,uuid,uuid,text,integer,bigint,text,uuid)',
  ]) {
    for (const role of ['anon', 'authenticated', 'service_role'])
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege($1,$2,'EXECUTE') allowed",
            [role, `public.${signature}`],
          )
        ).rows[0]!.allowed,
      ).toBe(role === 'service_role')
  }
  const view = await call<{ catalogueToken: string }>('read_character_items_view_v1', [
    owner,
    actor,
  ])
  await call('grant_master_test_item_v1', [
    owner,
    actor,
    helm.id,
    1,
    0,
    view.catalogueToken,
    requestKey,
  ])
  expect(
    (await db.query('select character_id from app_private.character_item_stacks')).rows,
  ).toEqual([{ character_id: actor }])
  await db.query(
    "insert into app_private.master_panel_character_access(character_id,user_id,roles,updated_by) values($1,$2,array['content-staff'],$3)",
    [target, player, owner],
  )
  const staffView = await call<{ catalogueToken: string }>('read_character_items_view_v1', [
    player,
    target,
  ])
  await call('grant_master_test_item_v1', [
    player,
    target,
    helm.id,
    1,
    0,
    staffView.catalogueToken,
    requestKey,
  ])
  expect(
    (
      await db.query(
        'select character_id from app_private.character_item_stacks where character_id=$1',
        [target],
      )
    ).rows,
  ).toEqual([{ character_id: target }])
})
