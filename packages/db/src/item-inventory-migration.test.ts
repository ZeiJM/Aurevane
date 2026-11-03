import { readFileSync } from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, afterEach, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import { itemFixture } from '../../game-core/src/content/items-test-fixtures'
import {
  gateWorldMutationDefinition,
  WORLD_MUTATION_GATE_SIGNATURES,
} from '../../../apps/web/e2e/world-contention-gate'
import { defaultBasicSkills } from '../../game-core/src/combat/combat-basic-actions'
import type { ItemInventorySnapshot } from '../../game-core/src/character/item-inventory'
const user = '00000000-0000-4000-8000-000000009001',
  other = '00000000-0000-4000-8000-000000009002',
  character = '00000000-0000-4000-8000-000000009011'
let db: PGlite
const helm = itemFixture({ qualityPoints: 50 })
const body = itemFixture({
  id: 'test.body',
  equipment: { slot: 'body', hands: 1 },
  qualityPoints: 50,
})
const material = itemFixture({
  id: 'test.ore',
  inventoryCategory: 'materials',
  itemClass: 'material',
  qualityPoints: 0,
  equipment: null,
  maximumStack: 99,
})
const ability = defaultBasicSkills().find((x) => x.id === 'basic.recover')!.ability!
const potion = itemFixture({
  id: 'test.potion',
  inventoryCategory: 'battle-items',
  itemClass: 'battle-item',
  equipment: { slot: 'hand', hands: 1 },
  qualityPoints: 10,
  maximumStack: 99,
  ability,
  actions: { use: { behaviorId: ability.behaviors[0]!.id, name: 'Drink' } },
  battleUses: 2,
})
const seed = (definitions: unknown[]) =>
  db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [JSON.stringify(definitions)])
async function read(as = user) {
  return (
    await db.query<{ snapshot: ItemInventorySnapshot }>(
      'select public.read_character_item_inventory_v1($1,$2) snapshot',
      [as, character],
    )
  ).rows[0]!.snapshot
}
const grant = (key: string, items: unknown[], revision = 0) =>
  db.query('select public.grant_character_items_v1($1,$2,$3,$4,$5::jsonb)', [
    user,
    character,
    revision,
    key,
    JSON.stringify(items),
  ])
const equip = (
  revision: number,
  equipment: object,
  support: object = { kind: 'basic', actionId: 'basic.recover' },
  replace: string[] = [],
) =>
  db.query(
    'select public.set_character_item_equipment_v1($1,$2,$3,$4::jsonb,$5::jsonb,$6::text[])',
    [user, character, revision, JSON.stringify(equipment), JSON.stringify(support), replace],
  )
async function fails(fn: () => Promise<unknown>, message: string) {
  await db.exec('savepoint rejected')
  if (
    message.endsWith('_STALE_REVISION') ||
    message.endsWith('_STALE_CATALOGUE') ||
    message === 'ITEM_PREPARATION_STALE' ||
    message === 'ITEM_STARTUP_CAPTURE_CHANGED'
  ) {
    await expect(fn()).rejects.toMatchObject({ code: 'PT409', message })
  } else {
    await expect(fn()).rejects.toThrow(message)
  }
  await db.exec('rollback to savepoint rejected; release savepoint rejected')
}
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${user}','items@example.test',now()),('${other}','other-items@example.test',now());
 insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
 values('${character}','${user}',0,1,'Item Tester','item-tester','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`)
}, 60000)
afterAll(async () => db?.close())
beforeEach(async () => {
  await db.exec('begin')
  await seed([helm, body, material, potion])
})
afterEach(async () => {
  await db.exec('rollback')
})
it('prepares exact versioned equipment and validates it inside the actual creation transaction', async () => {
  await grant('battle-equipment', [{ itemId: helm.id, quantity: 1 }])
  const owned = await read()
  await equip(1, { head: owned.stacks[0]!.id })
  const captured = (
    await db.query<{ value: unknown }>(
      'select public.read_character_battle_equipment_v1($1,$2) value',
      [user, character],
    )
  ).rows[0]!.value
  expect(captured).toEqual({
    schemaVersion: 1,
    inventoryRevision: 2,
    selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
    equipment: [{ position: 'head', ownedStackId: owned.stacks[0]!.id, item: helm }],
  })
  const body = (
    await db.query<{ body: string }>(
      "select pg_get_functiondef('app_private.guard_player_battle_admission_v1()'::regprocedure) body",
    )
  ).rows[0]!.body
  expect(body).toContain('assert_character_item_admission_v1')
  expect(body.indexOf('assert_character_item_admission_v1')).toBeLessThan(
    body.indexOf('for update nowait'),
  )
  const build = (
    await db.query<{ value: Record<string, unknown> }>(
      'select public.get_character_committed_build_snapshot_v2($1,$2) value',
      [user, character],
    )
  ).rows[0]!.value
  const initial = {
    tactical: {
      battle: {
        battleId: 'item-admission',
        rulesVersion: 1,
        contentVersion: 1,
        rng: { algorithm: 'xorshift32-v1', seed: 7, state: 7, draws: 0 },
        lifecycle: 'active',
        currentTurn: { combatantId: `character:${character}` },
        combatants: [
          { id: `character:${character}`, teamId: 'player' },
          { id: 'enemy', teamId: 'enemy' },
        ],
      },
    },
    buildAuthority: {
      combatants: [
        {
          ...build,
          combatantId: `character:${character}`,
          characterId: character,
          extensions: { ...(build.extensions as object), equipmentSkills: [captured] },
        },
      ],
    },
  }
  const participants = [
    { combatant_id: `character:${character}`, participant_role: 'player', character_id: character },
    { combatant_id: 'enemy', participant_role: 'opponent', character_id: null },
  ]
  const create = (snapshot: unknown) =>
    db.query<Record<string, unknown>>(
      'select * from public.create_battle_session_v2($1,$2,$3,$4,$5,1,1,$6,$7,$6,$8,$9)',
      [
        user,
        '00000000-0000-4000-8000-000000009099',
        'item-admission',
        user,
        'item-admission',
        snapshot,
        participants,
        [],
        { schemaVersion: 1, commandVisibility: { kind: 'public' }, eventVisibilityOverrides: [] },
      ],
    )
  for (const patch of [
    { inventoryRevision: 1 },
    { equipment: [] },
    { equipment: [{ position: 'head', ownedStackId: 'foreign-stack', item: helm }] },
  ]) {
    const forged = structuredClone(initial)
    forged.buildAuthority.combatants[0]!.extensions.equipmentSkills[0] = {
      ...(captured as object),
      ...patch,
    }
    await fails(
      () => create(forged),
      patch.inventoryRevision ? 'ITEM_STALE_REVISION' : 'ITEM_PREPARATION_STALE',
    )
    expect(
      (
        await db.query('select * from app_private.battle_participants where character_id=$1', [
          character,
        ])
      ).rows,
    ).toEqual([])
  }

  const changed = structuredClone(initial)
  changed.buildAuthority.combatants[0]!.extensions.equipmentSkills = []
  await fails(
    () =>
      db.query(
        'select * from public.create_battle_session_v2($1,$2,$3,$4,$5,1,1,$6,$7,$8,$9,$10)',
        [
          user,
          '00000000-0000-4000-8000-000000009099',
          'item-admission',
          user,
          'item-admission',
          changed,
          participants,
          initial,
          [],
          { schemaVersion: 1, commandVisibility: { kind: 'public' }, eventVisibilityOverrides: [] },
        ],
      ),
    'ITEM_STARTUP_CAPTURE_CHANGED',
  )
  await db.exec('savepoint catalogue_change')
  await seed([
    { ...helm, contentVersion: 2, qualityPoints: 60, media: { artworkId: 'changed.art' } },
  ])
  await fails(() => create(initial), 'ITEM_PREPARATION_STALE')
  await db.exec('rollback to savepoint catalogue_change; release savepoint catalogue_change')
  const admitted = await create(initial)
  expect(admitted.rows).toHaveLength(1)
  await fails(() => equip(2, {}, undefined, ['head']), 'ITEM_BATTLE_ACTIVE')
  expect((await create(initial)).rows[0]).toMatchObject({ replayed: true })
  // Retry uses frozen startup history even though fresh equipment preparation is now blocked.
  const creationKey = '00000000-0000-4000-8000-000000009099'
  const replay = (as = user, fingerprint = 'item-admission') =>
    db.query('select * from public.get_battle_creation_replay_v1($1,$2,$3)', [
      as,
      creationKey,
      fingerprint,
    ])
  await fails(
    () => db.query('select public.read_character_battle_equipment_v1($1,$2)', [user, character]),
    'ITEM_BATTLE_ACTIVE',
  )
  await seed([{ ...helm, contentVersion: 2, name: 'Archived later', enabled: false }])
  await db.exec('set local role service_role')
  expect((await replay()).rows).toEqual([{ ...admitted.rows[0], replayed: true }])
  expect((await replay(other)).rows).toEqual([])
  await fails(() => replay(user, 'different-request'), 'BATTLE_IDEMPOTENCY_CONFLICT')
  await db.exec('reset role')
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set local role ${role}`)
    await fails(() => replay(), 'permission denied')
    await db.exec('reset role')
  }
})
it('reads no foreign character and denies direct browser RPC/table access with RLS enabled', async () => {
  await fails(() => read(other), 'ITEM_OWNERSHIP')
  await db.exec('set local role authenticated')
  await fails(
    () => db.query('select public.read_character_item_inventory_v1($1,$2)', [user, character]),
    'permission denied',
  )
  await fails(() => db.exec('select * from app_private.character_item_stacks'), 'permission denied')
  await db.exec('reset role')
  const rows = (
    await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid='app_private.character_item_stacks'::regclass",
    )
  ).rows
  expect(rows).toEqual([{ relrowsecurity: true }])
})
it('idempotently grants duplicate first loads and preserves quantities and provenance', async () => {
  await grant('starter', [{ itemId: material.id, quantity: 100 }])
  const first = await read()
  expect(first.stacks.map((x) => x.quantity)).toEqual([99, 1])
  expect(first.revision).toBe(1)
  await grant('starter', [{ itemId: material.id, quantity: 100 }])
  expect(await read()).toEqual(first)
  await fails(
    () => grant('starter', [{ itemId: material.id, quantity: 101 }], 1),
    'ITEM_GRANT_CONFLICT',
  )
  await fails(() => grant('next', [{ itemId: material.id, quantity: 1 }], 0), 'ITEM_STALE_REVISION')
})
it('validates exact current 100/101 QP, explicit replacement and stale equipment CAS', async () => {
  await grant('gear', [
    { itemId: helm.id, quantity: 1 },
    { itemId: body.id, quantity: 1 },
  ])
  const inventory = await read()
  const [a, b] = inventory.stacks
  await equip(1, { head: a!.id, body: b!.id })
  expect((await read()).revision).toBe(2)
  await fails(() => equip(1, {}), 'ITEM_STALE_REVISION')
  await fails(() => equip(2, {}), 'ITEM_EXPLICIT_SWAP_REQUIRED')
  await seed([{ ...body, contentVersion: 2, qualityPoints: 51 }])
  await fails(
    () =>
      db.query('select public.assert_character_item_admission_v1($1,$2,$3)', [user, character, 2]),
    'ITEM_OVER_QP',
  )
  await equip(2, { head: a!.id }, undefined, ['body'])
  expect((await read()).equipment).toEqual({ head: a!.id })
})
it('rejects unavailable or repeated foreign assignments and quantity-poor duplicate hand stacks', async () => {
  await grant('one', [{ itemId: potion.id, quantity: 1 }])
  const [stack] = (await read()).stacks
  await fails(() => equip(1, { 'main-hand': stack!.id, 'off-hand': stack!.id }), 'ITEM_QUANTITY')
  await fails(() => equip(1, { head: crypto.randomUUID() }), 'ITEM_OWNERSHIP')
  await grant('second', [{ itemId: potion.id, quantity: 1 }], 1)
  await equip(2, { 'main-hand': stack!.id, 'off-hand': stack!.id })
  expect((await read()).revision).toBe(3)
})
it('rolls back an entire full-category grant with no partial stacks or grant receipts', async () => {
  await grant('full', [{ itemId: material.id, quantity: 3960 }])
  const before = await read()
  expect(before.stacks).toHaveLength(40)
  await fails(
    () =>
      grant(
        'overflow',
        [
          { itemId: helm.id, quantity: 1 },
          { itemId: material.id, quantity: 1 },
        ],
        1,
      ),
    'ITEM_CAPACITY',
  )
  expect(await read()).toEqual(before)
})
it('protects published/distributed category and maximum-stack shape under catalogue authority', async () => {
  await grant('ore', [{ itemId: material.id, quantity: 99 }])
  await fails(
    () =>
      seed([
        { ...material, contentVersion: 2, inventoryCategory: 'general', itemClass: 'general' },
      ]),
    'ITEM_IDENTITY_SHAPE',
  )
  await fails(
    () => seed([{ ...material, contentVersion: 2, maximumStack: 98 }]),
    'ITEM_STACK_SHAPE',
  )
  await fails(() => seed([{ ...material, name: 'same version rewrite' }]), 'ITEM_SOURCE_CONFLICT')
  expect((await read()).stacks[0]!.quantity).toBe(99)
})
it('sorts only complete owned category permutations with persisted revisions', async () => {
  await grant('gear', [{ itemId: helm.id, quantity: 2 }])
  const before = await read()
  const ids = before.stacks.map((s) => s.id).reverse()
  await db.query('select public.sort_character_item_inventory_v1($1,$2,$3,$4,$5::uuid[])', [
    user,
    character,
    1,
    'gear',
    ids,
  ])
  expect((await read()).stacks.map((s) => s.id)).toEqual(ids)
  await fails(
    () =>
      db.query('select public.sort_character_item_inventory_v1($1,$2,$3,$4,$5::uuid[])', [
        user,
        character,
        2,
        'gear',
        [ids[0], ids[0]],
      ]),
    'ITEM_PERMUTATION',
  )
})
it('locks catalogue, account, character and build and refuses pending/active battle mutations', async () => {
  await read()
  await db.query('select public.assert_character_item_admission_v1($1,$2,$3)', [user, character, 0])
  const locks = await db.query<{ locktype: string }>('select locktype from pg_locks where granted')
  expect(locks.rows.some((x) => x.locktype === 'advisory')).toBe(true)
  for (const seed of [0, 1]) {
    const held = (
      await db.query<{ held: boolean }>(
        `select exists(select 1 from pg_locks where locktype='advisory' and granted and classid::bigint=((hashtextextended($1,$2)>>32)&4294967295) and objid::bigint=(hashtextextended($1,$2)&4294967295) and objsubid=1) held`,
        [user, seed],
      )
    ).rows[0]!.held
    expect(held).toBe(true)
  }
  for (const relation of [
    'public.characters',
    'app_private.character_active_builds',
    'app_private.character_item_inventory',
  ]) {
    expect(
      (
        await db.query<{ held: boolean }>(
          "select exists(select 1 from pg_locks where relation=$1::regclass and granted and mode='RowShareLock') held",
          [relation],
        )
      ).rows[0]!.held,
    ).toBe(true)
  }

  // The real session table has strict capture triggers; imported retained fixtures use replica mode.
  await db.exec('set local session_replication_role=replica')
  const battle = crypto.randomUUID()
  await db.query(
    "insert into app_private.battle_sessions(id,owner_user_id,battle_id,rules_version,content_version,lifecycle,current_snapshot) values($1,$2,'test.items',1,1,'pending','{}')",
    [battle, user],
  )
  await db.query(
    "insert into app_private.battle_participants(battle_session_id,combatant_id,participant_role,user_id,character_id) values($1,'player','player',$2,$3)",
    [battle, user, character],
  )
  await db.exec('set local session_replication_role=origin')
  await fails(() => equip(0, {}), 'ITEM_BATTLE_ACTIVE')
  await fails(() => grant('blocked', [{ itemId: material.id, quantity: 1 }]), 'ITEM_BATTLE_ACTIVE')
})
async function writeItem(
  definition: object,
  key = 'test.published',
  action = 'create',
  revision?: number,
) {
  return (
    await db.query<{
      record: {
        revision: number
        draft: { draftVersion: number }
        current: { contentVersion: number; definition: unknown }
      }
    }>('select public.write_combat_content_record_v1($1,null,$2,$3::jsonb) record', [
      user,
      key,
      action === 'create'
        ? { action, requestId: crypto.randomUUID(), contentKind: 'item', definition }
        : { action, definition, expectedRevision: revision },
    ])
  ).rows[0]!.record
}
async function publishItem(key: string, draftVersion: number, base: number | null = null) {
  const token = (
    await db.query<{ token: string }>(
      "select public.read_combat_content_catalogue_v1()->>'token' token",
    )
  ).rows[0]!.token
  return (
    await db.query<{
      record: {
        revision: number
        current: { contentVersion: number; definition: Record<string, unknown> }
      }
    }>('select public.publish_saved_combat_content_v1($1,null,$2,$3,$4,$5,null) record', [
      user,
      key,
      draftVersion,
      base,
      token,
    ])
  ).rows[0]!.record
}
it('saves and publishes V2 via the current atomic Master writer and resolves current above source', async () => {
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [user],
  )
  const definition = { ...helm, id: 'test.published' }
  await seed([definition])
  const sourceRecord = (
    await db.query<{ record: { revision: number } }>(
      'select public.read_combat_content_record_v1($1,null,$2) record',
      [user, definition.id],
    )
  ).rows[0]!.record
  const record = await writeItem(
    { ...definition, qualityPoints: 55 },
    definition.id,
    'save',
    sourceRecord.revision,
  )
  const publication = await publishItem(definition.id, record.draft.draftVersion)
  expect(publication.current.definition).toMatchObject({ schemaVersion: 2, qualityPoints: 55 })
  const current = (
    await db.query<{ definition: unknown }>(
      'select public.read_current_runtime_item_v1($1) definition',
      [definition.id],
    )
  ).rows[0]!.definition
  expect(current).toEqual(publication.current.definition)
  await grant('published', [{ itemId: definition.id, quantity: 1 }])
  expect((await read()).stacks[0]!.acquiredContentVersion).toBe(publication.current.contentVersion)
  const before = (
    await db.query(
      'select definition from app_private.combat_content_versions where content_key=$1',
      [definition.id],
    )
  ).rows
  const next = await writeItem(
    {
      ...definition,
      inventoryCategory: 'general',
      itemClass: 'general',
      equipment: null,
      qualityPoints: 0,
    },
    definition.id,
    'save',
    publication.revision,
  )
  await fails(
    () => publishItem(definition.id, next.draft.draftVersion, publication.current.contentVersion),
    'ITEM_IDENTITY_SHAPE',
  )
  expect(
    (
      await db.query(
        'select definition from app_private.combat_content_versions where content_key=$1',
        [definition.id],
      )
    ).rows,
  ).toEqual(before)
})
it('rejects invalid V2 authoring and keeps retained V1 publication blocked', async () => {
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [user],
  )
  for (const patch of [
    { qualityPoints: 101 },
    { equipment: { slot: 'accessory', hands: 1 } },
    { consumeOnUse: true },
    { requirements: { kind: 'event' } },
    { maximumStack: 2 },
    { extra: true },
    { media: {} },
  ])
    await fails(() => writeItem({ ...helm, id: 'test.published', ...patch }), 'ITEM_')
  const legacy = {
    schemaVersion: 1,
    id: 'test.legacy',
    contentVersion: 1,
    name: 'Legacy intent',
    description: 'Must remain literal.',
    sortOrder: 0,
    enabled: true,
    media: { artworkId: 'test.art' },
    itemClass: 'material',
    usage: 'none',
    equipmentSlot: null,
    acquisition: 'unimplemented',
    requirements: null,
    ability: null,
  }
  const saved = await writeItem(legacy, legacy.id)
  await fails(
    () => publishItem(legacy.id, saved.draft.draftVersion),
    'COMBAT_CONTENT_ITEM_RUNTIME_UNSUPPORTED',
  )
})
it('counts a two-handed weapon once and requires an explicit swap of conflicting hands', async () => {
  const weaponAbility = defaultBasicSkills().find((x) => x.id === 'unarmed.basic')!.ability!
  const blade = itemFixture({
    id: 'test.blade',
    itemClass: 'weapon',
    equipment: { slot: 'hand', hands: 2 },
    qualityPoints: 50,
    ability: weaponAbility,
    actions: { attack: { behaviorId: weaponAbility.behaviors[0]!.id, name: 'Cut' } },
  })
  await seed([blade])
  await grant('hands', [
    { itemId: blade.id, quantity: 1 },
    { itemId: potion.id, quantity: 1 },
  ])
  const stacks = (await read()).stacks
  const bladeId = stacks.find((x) => x.itemId === blade.id)!.id,
    potionId = stacks.find((x) => x.itemId === potion.id)!.id
  await equip(1, { 'main-hand': bladeId })
  const admitted = (
    await db.query<{ result: { qualityPoints: number } }>(
      'select public.assert_character_item_admission_v1($1,$2,$3) result',
      [user, character, 2],
    )
  ).rows[0]!.result
  expect(admitted.qualityPoints).toBe(50)
  await fails(() => equip(2, { 'main-hand': bladeId, 'off-hand': potionId }), 'ITEM_HAND_CONFLICT')
  await equip(2, { 'off-hand': potionId }, undefined, ['main-hand'])
  await fails(() => equip(3, { 'main-hand': bladeId, 'off-hand': potionId }), 'ITEM_HAND_CONFLICT')
})
it('checks equipment support binding and explicitly notices fallback when its source is removed', async () => {
  const support = itemFixture({
    id: 'test.support',
    itemClass: 'hand-armor',
    equipment: { slot: 'hand', hands: 1 },
    ability,
    actions: { support: { behaviorId: ability.behaviors[0]!.id, name: 'Steady' } },
  })
  await seed([support])
  await grant('support', [{ itemId: support.id, quantity: 1 }])
  const stack = (await read()).stacks[0]!
  const selection = {
    kind: 'equipment',
    position: 'main-hand',
    itemId: support.id,
    behaviorId: ability.behaviors[0]!.id,
  }
  await fails(
    () => equip(1, { 'main-hand': stack.id }, { ...selection, behaviorId: 'missing' }),
    'ITEM_SUPPORT',
  )
  await equip(1, { 'main-hand': stack.id }, selection)
  const result = await equip(2, {}, selection, ['main-hand'])
  expect(result.rows[0]).toMatchObject({
    set_character_item_equipment_v1: { notices: ['equipment-support-removed'] },
  })
  expect((await read()).selectedSupport).toEqual({ kind: 'basic', actionId: 'basic.recover' })
})
it('allows removal-only repair while remaining pieces are still over QP', async () => {
  const boots = itemFixture({
    id: 'test.boots',
    equipment: { slot: 'boots', hands: 1 },
    qualityPoints: 1,
  })
  await seed([boots])
  await grant('repair', [
    { itemId: helm.id, quantity: 1 },
    { itemId: body.id, quantity: 1 },
    { itemId: boots.id, quantity: 1 },
  ])
  const stacks = (await read()).stacks
  const headId = stacks.find((s) => s.itemId === helm.id)!.id,
    bodyId = stacks.find((s) => s.itemId === body.id)!.id,
    bootsId = stacks.find((s) => s.itemId === boots.id)!.id
  await seed([{ ...helm, contentVersion: 2, qualityPoints: 49 }])
  await equip(1, { head: headId, body: bodyId, boots: bootsId })
  await seed([
    { ...helm, contentVersion: 3, qualityPoints: 100 },
    { ...body, contentVersion: 2, qualityPoints: 100 },
    { ...boots, contentVersion: 2, qualityPoints: 100 },
  ])
  await equip(2, { body: bodyId, boots: bootsId }, undefined, ['head'])
  expect((await read()).equipment).toEqual({ body: bodyId, boots: bootsId })
  await fails(
    () =>
      db.query('select public.assert_character_item_admission_v1($1,$2,$3)', [user, character, 3]),
    'ITEM_OVER_QP',
  )
  await equip(3, { boots: bootsId }, undefined, ['body'])
})
it('keeps archived owned items visible, suppresses source fallback and permits unequip/sort', async () => {
  await grant('archive', [{ itemId: helm.id, quantity: 1 }])
  const stack = (await read()).stacks[0]!
  await equip(1, { head: stack.id })
  await db.query(
    "insert into app_private.combat_content_records(content_key,content_kind,lifecycle,version_floor) values($1,'item','archived',1) on conflict(content_key) do update set lifecycle='archived'",
    [helm.id],
  )
  expect((await read()).stacks[0]!.id).toBe(stack.id)
  expect(
    (
      await db.query<{ item: unknown }>('select public.read_current_runtime_item_v1($1) item', [
        helm.id,
      ])
    ).rows[0]!.item,
  ).toBeNull()
  await fails(
    () =>
      db.query('select public.assert_character_item_admission_v1($1,$2,$3)', [user, character, 2]),
    'ITEM_DEFINITION_UNAVAILABLE',
  )
  await db.query('select public.sort_character_item_inventory_v1($1,$2,$3,$4,$5::uuid[])', [
    user,
    character,
    2,
    'gear',
    [stack.id],
  ])
  await equip(3, {}, undefined, ['head'])
  await fails(() => equip(4, { head: stack.id }), 'ITEM_DEFINITION_UNAVAILABLE')
  await fails(
    () => grant('archived-new', [{ itemId: helm.id, quantity: 1 }], 4),
    'ITEM_DEFINITION_UNAVAILABLE',
  )
})
it('initializes the one support selection from the existing committed Basic support', async () => {
  await db.query(
    "update app_private.character_active_builds set support_action_id='basic.pilfer' where character_id=$1",
    [character],
  )
  expect(await read()).toMatchObject({
    selectedSupport: { kind: 'basic', actionId: 'basic.pilfer' },
    previousBasicSupport: 'basic.pilfer',
  })
})

it('reads one owner snapshot with current definitions/token and rejects a stale catalogue mutation', async () => {
  await grant('starter', [{ itemId: helm.id, quantity: 1 }])
  const result = await db.query<{
    view: {
      catalogueToken: string
      definitions: Record<string, unknown>
      snapshot: ItemInventorySnapshot
    }
  }>('select public.read_character_items_view_v1($1,$2) view', [user, character])
  const view = result.rows[0]!.view
  expect(view.definitions[helm.id]).toEqual(helm)
  await seed([{ ...helm, contentVersion: 2, qualityPoints: 60 }])
  await fails(
    () =>
      db.query('select public.write_character_items_v1($1,$2,$3,$4,$5::jsonb)', [
        user,
        character,
        view.snapshot.revision,
        view.catalogueToken,
        JSON.stringify({
          action: 'equipment',
          equipment: { head: view.snapshot.stacks[0]!.id },
          selectedSupport: view.snapshot.selectedSupport,
          replacePositions: [],
        }),
      ]),
    'ITEM_STALE_CATALOGUE',
  )
  expect((await read()).equipment).toEqual({})
})
it('synchronizes the existing Basic support writer and inventory revision atomically', async () => {
  const initial = await read()
  const build = (
    await db.query<{ build_version: number }>(
      'select build_version from app_private.character_active_builds where character_id=$1',
      [character],
    )
  ).rows[0]!
  await db.query('select public.save_character_support_action_v1($1,$2,$3,$4,$5,$6)', [
    user,
    character,
    build.build_version,
    'basic.pilfer',
    '00000000-0000-4000-8000-000000009991',
    'support-test-fingerprint',
  ])
  expect(await read()).toMatchObject({
    revision: initial.revision + 1,
    selectedSupport: { kind: 'basic', actionId: 'basic.pilfer' },
    previousBasicSupport: 'basic.pilfer',
  })
  await db.query('select public.save_character_support_action_v1($1,$2,$3,$4,$5,$6)', [
    user,
    character,
    build.build_version,
    'basic.pilfer',
    '00000000-0000-4000-8000-000000009991',
    'support-test-fingerprint',
  ])
  expect((await read()).revision).toBe(initial.revision + 1)
  await equip(initial.revision + 1, {}, { kind: 'basic', actionId: 'basic.recover.mp' })
  expect(
    (
      await db.query<{ support_action_id: string }>(
        'select support_action_id from app_private.character_active_builds where character_id=$1',
        [character],
      )
    ).rows[0]!.support_action_id,
  ).toBe('basic.recover.mp')
})
it('captures genuine source Items in the current catalogue generation and pins immutable old source media', async () => {
  const first = (
    await db.query<{ snapshot: { token: string; runtimeItems: unknown[] } }>(
      'select public.read_combat_content_catalogue_v1() snapshot',
    )
  ).rows[0]!.snapshot
  expect(first.runtimeItems).toContainEqual(helm)
  await seed([{ ...helm, contentVersion: 2, name: 'New Helm' }])
  const next = (
    await db.query<{ snapshot: { token: string; runtimeItems: unknown[] } }>(
      'select public.read_combat_content_catalogue_v1() snapshot',
    )
  ).rows[0]!.snapshot
  expect(next.token).not.toBe(first.token)
  expect(next.runtimeItems).toContainEqual({ ...helm, contentVersion: 2, name: 'New Helm' })
  expect(
    (
      await db.query<{ definition: unknown }>(
        'select public.read_runtime_item_version_v1($1,1) definition',
        [helm.id],
      )
    ).rows[0]!.definition,
  ).toEqual(helm)
})
it('reserves source Item publication versions and preserves source drafts when a higher baseline is installed', async () => {
  const initial = (
    await db.query<{ version_floor: number; builtin_version: number }>(
      'select version_floor,builtin_version from app_private.combat_content_records where content_key=$1',
      [helm.id],
    )
  ).rows[0]
  expect(initial).toMatchObject({ version_floor: 1, builtin_version: 1 })
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [user],
  )
  const record = (
    await db.query<{ record: { revision: number } }>(
      'select public.read_combat_content_record_v1($1,null,$2) record',
      [user, helm.id],
    )
  ).rows[0]!.record
  const draft = (
    await db.query<{ record: { draft: { draftVersion: number } } }>(
      'select public.write_combat_content_record_v1($1,null,$2,$3::jsonb) record',
      [
        user,
        helm.id,
        JSON.stringify({
          action: 'save',
          expectedRevision: record.revision,
          definition: { ...helm, name: 'Owner edited helm' },
        }),
      ],
    )
  ).rows[0]!.record
  await publishItem(helm.id, draft.draft.draftVersion)
  const published = (
    await db.query<{ definition: { contentVersion: number } }>(
      'select public.read_current_runtime_item_v1($1) definition',
      [helm.id],
    )
  ).rows[0]!.definition
  expect(published.contentVersion).toBe(2)
  expect(
    (
      await db.query<{ definition: unknown }>(
        'select public.read_runtime_item_version_v1($1,1) definition',
        [helm.id],
      )
    ).rows[0]!.definition,
  ).toEqual(helm)
  await fails(
    () => seed([{ ...helm, contentVersion: 2, name: 'Conflicting source' }]),
    'ITEM_SOURCE_VERSION_CONFLICT',
  )
})
it('bounds staff test grants to the authorized selected owned character with an idempotent audit', async () => {
  const view = (
    await db.query<{ view: { catalogueToken: string } }>(
      'select public.read_character_items_view_v1($1,$2) view',
      [user, character],
    )
  ).rows[0]!.view
  const parameters = [
    user,
    character,
    helm.id,
    1,
    0,
    view.catalogueToken,
    '00000000-0000-4000-8000-000000009998',
  ]
  const run = (args: unknown[] = parameters) =>
    db.query('select public.grant_master_test_item_v1($1,$2,$3,$4,$5,$6,$7)', args)
  await fails(() => run(), 'MASTER_PANEL_OPERATOR_REQUIRED')
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [user],
  )
  await run()
  await run()
  expect((await read()).stacks).toHaveLength(1)
  expect(
    (
      await db.query<{ count: number }>(
        'select count(*)::int count from app_private.player_support_audit where actor_user_id=$1',
        [user],
      )
    ).rows[0]!.count,
  ).toBe(1)
  const refreshed = (
    await db.query<{ view: { catalogueToken: string } }>(
      'select public.read_character_items_view_v1($1,$2) view',
      [user, character],
    )
  ).rows[0]!.view
  await fails(
    () =>
      run([
        user,
        character,
        helm.id,
        2,
        1,
        refreshed.catalogueToken,
        '00000000-0000-4000-8000-000000009997',
      ]),
    'ITEM_TEST_GRANT_INVALID',
  )
  await fails(
    () =>
      run([user, null, helm.id, 1, 0, view.catalogueToken, '00000000-0000-4000-8000-000000009996']),
    'ITEM_TEST_GRANT_INVALID',
  )
  await fails(
    () => run([user, character, material.id, 1, 0, view.catalogueToken, parameters[6]]),
    'ITEM_GRANT_CONFLICT',
  )
})

it('returns expected unavailable current identities as null but propagates unrelated database failures', async () => {
  const current = (id: string) =>
    db.query<{ item: unknown }>('select public.read_current_runtime_item_v1($1) item', [id])
  expect((await current('missing.item')).rows[0]!.item).toBeNull()
  await db.query(
    "update app_private.combat_content_records set content_kind='ascension' where content_key=$1",
    [helm.id],
  )
  expect((await current(helm.id)).rows[0]!.item).toBeNull()
  await db.exec(`create or replace function app_private.current_runtime_item_v1(p_item_id text)
    returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
    raise exception using errcode='22023',message='ITEM_DEFINITION_INVALID'; end; $$;`)
  await fails(() => current(helm.id), 'ITEM_DEFINITION_INVALID')
  await db.exec(`create or replace function app_private.current_runtime_item_v1(p_item_id text)
    returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
    raise exception using errcode='XX000',message='ITEM_DEFINITION_UNAVAILABLE'; end; $$;`)
  await fails(() => current(helm.id), 'ITEM_DEFINITION_UNAVAILABLE')
})

it('takes the common inventory locks before saved-loadout build locks and Master player-edit row locks', async () => {
  const definition = async (signature: string) =>
    (
      await db.query<{ body: string }>('select pg_get_functiondef($1::regprocedure) body', [
        signature,
      ])
    ).rows[0]!.body
  const activation = await definition(
    'public.activate_character_build_loadout_v1(uuid,uuid,smallint,bigint,uuid,text)',
  )
  const lock = activation.indexOf(
    'perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,false)',
  )
  expect(lock).toBeGreaterThan(0)
  expect(lock).toBeLessThan(activation.indexOf('from app_private.character_active_builds build'))
  expect(lock).toBeLessThan(activation.indexOf('save_character_support_action_v1'))
  const master = await definition(
    'public.edit_master_player_v1(uuid,uuid,text,uuid,jsonb,boolean,uuid)',
  )
  const catalogue = master.indexOf("hashtextextended('combat-catalogue-publication',0)")
  const account = master.indexOf('hashtextextended(v_character.user_id::text,0)')
  const world = master.indexOf('hashtextextended(v_character.user_id::text,1)')
  expect(catalogue).toBeGreaterThan(0)
  expect(account).toBeGreaterThan(catalogue)
  expect(world).toBeGreaterThan(account)
  expect(world).toBeLessThan(master.indexOf('for update nowait'))
  expect(master).toContain("errcode='PT409',message='PLAYER_EDIT_RETRY'")
})

it('activates a saved Basic Support after inventory exists with atomic synchronization and exact replay', async () => {
  const initial = await read()
  const version = async () =>
    (
      await db.query<{ value: number }>(
        'select build_version value from app_private.character_active_builds where character_id=$1',
        [character],
      )
    ).rows[0]!.value
  await db.query('select public.save_character_build_loadout_v1($1,$2,1::smallint,$3,$4,$5,$6)', [
    user,
    character,
    'Original recovery',
    await version(),
    crypto.randomUUID(),
    'saved-support-roundtrip',
  ])
  await db.query('select public.save_character_support_action_v1($1,$2,$3,$4,$5,$6)', [
    user,
    character,
    await version(),
    'basic.pilfer',
    crypto.randomUUID(),
    'change-support-before-activation',
  ])
  expect((await read()).selectedSupport).toEqual({ kind: 'basic', actionId: 'basic.pilfer' })
  const expected = await version(),
    request = crypto.randomUUID()
  const activate = () =>
    db.query<{ build_version: number; replayed: boolean }>(
      'select * from public.activate_character_build_loadout_v1($1,$2,1::smallint,$3,$4,$5)',
      [user, character, expected, request, 'saved-support-activation'],
    )
  const result = (await activate()).rows[0]!
  expect(result.replayed).toBe(false)
  const after = await read()
  expect(after).toMatchObject({
    revision: initial.revision + 2,
    selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
    previousBasicSupport: 'basic.recover',
  })
  expect(await version()).toBe(result.build_version)
  expect((await activate()).rows[0]).toMatchObject({ ...result, replayed: true })
  expect(await read()).toEqual(after)
  await fails(
    () =>
      db.query(
        'select * from public.activate_character_build_loadout_v1($1,$2,1::smallint,$3,$4,$5)',
        [user, character, expected, crypto.randomUUID(), 'stale-support-activation'],
      ),
    'CHARACTER_BUILD_VERSION_CONFLICT',
  )
})

it('executes the shared native race fixtures through real PvE, PvP, World and loadout transactions', async () => {
  await db.exec(
    readFileSync(
      new URL('../../../.github/scripts/item-admission-race-fixtures.sql', import.meta.url),
      'utf8',
    ),
  )
  for (const mode of ['pve', 'pvp', 'world']) {
    await db.query('select item_race.setup($1,$1)', [mode])
    await db.exec('set local role service_role')
    expect((await db.query('select item_race.admit($1) result', [mode])).rows[0]).toHaveProperty(
      'result',
    )
    await fails(() => db.query('select item_race.equip($1)', [mode]), 'ITEM_BATTLE_ACTIVE')
    await db.exec('reset role')
  }
  await db.query("select item_race.setup('loadout','loadout')")
  await db.query("select item_race.activate('loadout')")
  expect(
    (
      await db.query<{ result: ItemInventorySnapshot }>(
        "select item_race.read_item('loadout') result",
      )
    ).rows[0]!.result.selectedSupport,
  ).toEqual({ kind: 'basic', actionId: 'basic.recover' })
  expect(
    (
      await db.query<{ result: { replayed: boolean } }>(
        "select item_race.activate('loadout') result",
      )
    ).rows[0]!.result.replayed,
  ).toBe(true)
  await db.query("select item_race.setup('grant','grant')")
  await db.query("select item_race.grant_item('grant','first')")
  await db.query("select item_race.grant_item('grant','first')")
  await fails(
    () => db.query("select item_race.grant_item('grant','different')"),
    'ITEM_STALE_REVISION',
  )
})

it('installs and restores the disposable post-preparation Atlas barrier without changing World authority or ACLs', async () => {
  await db.exec(
    readFileSync(
      new URL('../../../.github/scripts/item-admission-race-fixtures.sql', import.meta.url),
      'utf8',
    ),
  )
  await db.query("select item_race.setup('atlas-gated','world')")
  const context = (
    await db.query<{ character_id: string; target_id: string }>(
      "select character_id,target_id from item_race.contexts where label='atlas-gated'",
    )
  ).rows[0]!
  const originals: { signature: string; definition: string; acl: string; owner: number }[] = []
  try {
    for (const signature of WORLD_MUTATION_GATE_SIGNATURES) {
      const original = (
        await db.query<{ definition: string; acl: string; owner: number }>(
          'select pg_get_functiondef(oid) definition,proacl::text acl,proowner owner from pg_proc where oid=$1::regprocedure',
          [signature],
        )
      ).rows[0]!
      originals.push({ signature, ...original })
      const gated = gateWorldMutationDefinition(
        original.definition,
        'atlas-gate-11111111-1111-4111-8111-111111111111',
        [context.character_id, context.target_id],
      )
      await db.exec(gated)
      expect(
        (
          await db.query(
            'select proacl::text acl,proowner owner from pg_proc where oid=$1::regprocedure',
            [signature],
          )
        ).rows[0],
      ).toEqual({ acl: original.acl, owner: original.owner })
    }
    await db.exec('set local role service_role')
    expect((await db.query("select item_race.admit('atlas-gated') result")).rows[0]).toHaveProperty(
      'result',
    )
    await db.exec('reset role')
  } finally {
    for (const original of originals) await db.exec(original.definition)
  }
  for (const original of originals)
    expect(
      (
        await db.query<{ definition: string }>(
          'select pg_get_functiondef($1::regprocedure) definition',
          [original.signature],
        )
      ).rows[0]!.definition,
    ).toBe(original.definition)
})
