import { afterAll, beforeAll, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { createCombatContentTestDatabase } from '../../../../../packages/db/src/test-support/combat-content-test-database'
import { starterItemDefinitions, starterItemGrant } from '@aurevane/game-core/content/starter-items'
import { assertRuntimeItemPublication } from '../combat/runtime-item-validation'
import {
  createRpcCharacterItemsRepository,
  type ItemRpc,
} from './supabase-character-items-repository'
import { loadCharacterItems } from './character-items-service'
let db: Awaited<ReturnType<typeof createCombatContentTestDatabase>>
const user = '00000000-0000-4000-8000-000000009001'
let sequence = 0
const rpc: ItemRpc = async (name, parameters) => {
  try {
    return {
      data: (
        await db.query<{ result: unknown }>(
          `select public.${name}(${Object.keys(parameters)
            .map((key, index) => `${key} => $${index + 1}`)
            .join(',')}) result`,
          Object.values(parameters).map((value) =>
            typeof value === 'object' && value !== null ? JSON.stringify(value) : value,
          ),
        )
      ).rows[0]!.result,
      error: null,
    }
  } catch (error) {
    return { data: null, error: error as { code?: string; message?: string } }
  }
}
const repository = createRpcCharacterItemsRepository(rpc)
async function character() {
  const id = `00000000-0000-4000-8000-${String(9100 + sequence++).padStart(12, '0')}`
  await db.query(
    `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at) values($1,$2,$3,1,$4,$4,'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
    [id, user, sequence === 1 ? 0 : 1, `starter${sequence}`],
  )
  return id
}
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
    user,
    'starter@example.test',
  ])
}, 60000)
afterAll(async () => db?.close())
it('validates every genuine starter through current publication and all immutable registered art', () => {
  for (const item of starterItemDefinitions())
    expect(assertRuntimeItemPublication(item), item.id).toEqual(item)
})
it('makes genuine sources editable in Master before any inventory is opened', async () => {
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [user],
  )
  const { RpcCombatContentAuthoringStore } =
    await import('../master/supabase-combat-content-authoring-store')
  const { createSelectedCharacterRpc } = await import('../master/selected-character-rpc')
  const store = new RpcCombatContentAuthoringStore(
    createSelectedCharacterRpc(rpc, {
      getActor: async () => ({ userId: user }),
      loadSelection: async () => null,
    }),
    user,
  )
  const list = await store.listRecords({ kind: 'item', limit: 100 })
  expect(list.records).toHaveLength(47)
  const record = await store.readRecord('iron-shortsword')
  expect(record).toMatchObject({
    builtin: { contentVersion: 1 },
    builtinRestoreVersion: 1,
    builtinDefinition: { id: 'iron-shortsword', contentVersion: 1 },
  })
  expect(record!.current).toBeNull()
  await db.exec('begin')
  await db.exec('savepoint master_edit')
  const source = starterItemDefinitions().find((item) => item.id === 'iron-shortsword')!
  const committed = await store.commitRecord(source.id, record!.revision, {
    ...source,
    name: 'Owner Shortsword',
    qualityPoints: 13,
  })
  expect(committed.current).toMatchObject({
    contentVersion: 2,
    definition: { name: 'Owner Shortsword', qualityPoints: 13 },
  })
  const { createCombatContentResolver, RpcPublishedCombatContentSource } =
    await import('../combat/combat-content-resolver')
  const resolver = createCombatContentResolver(new RpcPublishedCombatContentSource(rpc))
  expect(await resolver.resolveCurrentItemDefinition!(source.id)).toEqual(
    committed.current!.definition,
  )
  expect(await resolver.resolvePinnedItemDefinition!(source.id, 1)).toEqual(source)
  expect((await store.readRecord(source.id))!.builtinRestoreVersion).toBe(1)
  await db.exec('rollback')
})
it('initializes all 47 current sources and grants once across first reads, refresh and a stale grant replay', async () => {
  const id = await character()
  const [first, concurrent] = await Promise.all([
    loadCharacterItems(user, id, repository),
    loadCharacterItems(user, id, repository),
  ])
  expect(concurrent).toEqual(first)
  expect(first!.stacks).toHaveLength(47)
  expect(first.revision).toBe(1)
  expect(first.stacks.find((x) => x.itemId === 'ashwood-plank')!.quantity).toBe(12)
  expect(first.stacks.find((x) => x.itemId === 'ironvein-ore')!.quantity).toBe(40)
  expect(first.stacks.find((x) => x.itemId === 'glimmer-dust')!.quantity).toBe(99)
  const reads = await Promise.all([
    loadCharacterItems(user, id, repository),
    loadCharacterItems(user, id, repository),
  ])
  expect(reads).toEqual([first, first])
  await repository.grant(user, id, 0, starterItemGrant.key, starterItemGrant.items)
  expect(await loadCharacterItems(user, id, repository)).toEqual(first)
  const state = await repository.read(user, id)
  expect(state.snapshot.grants).toEqual([
    { key: starterItemGrant.key, items: starterItemGrant.items },
  ])
}, 60000)
it('keeps receipt-bearing inventory readable after disable and archive, retaining owned stacks without regrant', async () => {
  await db.exec('begin')
  try {
    const id = await character()
    const first = await loadCharacterItems(user, id, repository)
    await db.query(
      "update app_private.combat_content_records set lifecycle='archived' where content_key='wayfarer-hood'",
    )
    await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
      JSON.stringify([
        {
          ...starterItemDefinitions().find((x) => x.id === 'mender-salve')!,
          contentVersion: 2,
          enabled: false,
        },
      ]),
    ])
    const view = await loadCharacterItems(user, id, repository)
    expect(view.stacks).toHaveLength(47)
    expect(view.revision).toBe(first.revision)
    expect(view.stacks.find((x) => x.itemId === 'wayfarer-hood')!.item).toBeNull()
    expect(view.stacks.find((x) => x.itemId === 'mender-salve')!.item!.enabled).toBe(false)
  } finally {
    await db.exec('rollback')
  }
}, 60000)
it('first grants only available enabled current defaults and records the actual bounded payload', async () => {
  await db.exec('begin')
  try {
    await db.query(
      "update app_private.combat_content_records set lifecycle='archived' where content_key='wayfarer-hood'",
    )
    await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
      JSON.stringify([
        {
          ...starterItemDefinitions().find((x) => x.id === 'mender-salve')!,
          contentVersion: 2,
          enabled: false,
        },
      ]),
    ])
    const id = await character()
    expect((await loadCharacterItems(user, id, repository)).stacks).toHaveLength(45)
    const state = await repository.read(user, id)
    expect(state.snapshot.grants[0]!.items).toEqual(
      starterItemGrant.items.filter((x) => !['wayfarer-hood', 'mender-salve'].includes(x.itemId)),
    )
    await db.query(
      "update app_private.combat_content_records set lifecycle='active' where content_key='wayfarer-hood'",
    )
    expect((await loadCharacterItems(user, id, repository)).stacks).toHaveLength(45)
  } finally {
    await db.exec('rollback')
  }
}, 60000)
it('defers an automatic over-capacity grant without a receipt or partial stacks while explicit grants still reject atomically', async () => {
  await db.exec('begin')
  try {
    const id = await character()
    await repository.grant(user, id, 0, 'staff-filled', [
      { itemId: 'iron-shortsword', quantity: 40 },
    ])
    const view = await loadCharacterItems(user, id, repository)
    expect(view.stacks).toHaveLength(40)
    expect(view.revision).toBe(1)
    expect(view.notices).toContain('starter-items-deferred-capacity')
    expect((await repository.read(user, id)).snapshot.grants).toHaveLength(1)
    await db.exec('savepoint explicit_grant')
    await expect(
      repository.grant(user, id, 1, 'explicit-overflow', starterItemGrant.items),
    ).rejects.toThrow('full')
    await db.exec('rollback to savepoint explicit_grant')
    expect((await loadCharacterItems(user, id, repository)).stacks).toHaveLength(40)
  } finally {
    await db.exec('rollback')
  }
}, 60000)
it('returns an empty readable inventory and no receipt when all defaults are archived', async () => {
  await db.exec('begin')
  try {
    await db.query(
      "update app_private.combat_content_records set lifecycle='archived' where content_kind='item'",
    )
    const id = await character()
    const view = await loadCharacterItems(user, id, repository)
    expect(view.stacks).toEqual([])
    expect(view.notices).toContain('starter-items-unavailable')
    expect((await repository.read(user, id)).snapshot.grants).toEqual([])
  } finally {
    await db.exec('rollback')
  }
}, 60000)

it.each(['pending', 'active'])(
  'defers first grants during %s battles and grants after battle without marking a premature receipt',
  async (lifecycle) => {
    await db.exec('begin')
    try {
      const id = await character(),
        battle = crypto.randomUUID()
      await db.exec('set local session_replication_role=replica')
      await db.query(
        "insert into app_private.battle_sessions(id,owner_user_id,battle_id,rules_version,content_version,lifecycle,current_snapshot) values($1,$2,'test.starters',1,1,$3,'{}')",
        [battle, user, lifecycle],
      )
      await db.query(
        "insert into app_private.battle_participants(battle_session_id,combatant_id,participant_role,user_id,character_id) values($1,'player','player',$2,$3)",
        [battle, user, id],
      )
      await db.exec('set local session_replication_role=origin')
      const view = await loadCharacterItems(user, id, repository)
      expect(view.stacks).toEqual([])
      expect(view.notices).toContain('starter-items-deferred-battle')
      expect(view.battleLocked).toBe(true)
      expect((await repository.read(user, id)).snapshot.grants).toEqual([])
      await db.exec('set local session_replication_role=replica')
      await db.query('delete from app_private.battle_sessions where id=$1', [battle])
      await db.exec('set local session_replication_role=origin')
      expect((await loadCharacterItems(user, id, repository)).stacks).toHaveLength(47)
    } finally {
      await db.exec('rollback')
    }
  },
  60000,
)
it('defers a first grant whose current lower stack maximum needs more than forty slots', async () => {
  await db.exec('begin')
  try {
    // A new current source can lower its maximum before any such stacks exist.
    await db.query('delete from app_private.character_item_stacks where item_id=$1', [
      'glimmer-dust',
    ])
    await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
      JSON.stringify([
        {
          ...starterItemDefinitions().find((x) => x.id === 'glimmer-dust')!,
          contentVersion: 2,
          maximumStack: 1,
        },
      ]),
    ])
    const id = await character(),
      view = await loadCharacterItems(user, id, repository)
    expect(view.stacks).toEqual([])
    expect(view.revision).toBe(0)
    expect(view.notices).toContain('starter-items-deferred-capacity')
    expect((await repository.read(user, id)).snapshot.grants).toEqual([])
  } finally {
    await db.exec('rollback')
  }
}, 60000)
