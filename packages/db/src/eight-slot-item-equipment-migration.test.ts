import { readFileSync } from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import { itemFixture } from '../../game-core/src/content/items-test-fixtures'
import { defaultBasicSkills } from '../../game-core/src/combat/combat-basic-actions'
import type { ItemInventorySnapshot } from '../../game-core/src/character/item-inventory'

const migration = '20261104082325_eight_slot_item_equipment.sql'
const migrationSql = readFileSync(
  new URL(`../../../supabase/migrations/${migration}`, import.meta.url),
  'utf8',
)
const recover = defaultBasicSkills().find((x) => x.id === 'basic.recover')!.ability!
const attack = defaultBasicSkills().find((x) => x.id === 'unarmed.basic')!.ability!
const helm = itemFixture({
  id: 'eight.head',
  qualityPoints: 10,
  ability: recover,
  actions: { support: { behaviorId: recover.behaviors[0]!.id, name: 'Recover' } },
})
const body = itemFixture({
  id: 'eight.body',
  qualityPoints: 10,
  equipment: { slot: 'body', hands: 1 },
})
const pants = itemFixture({
  id: 'eight.pants',
  qualityPoints: 10,
  equipment: { slot: 'pants', hands: 1 },
})
const boots = itemFixture({
  id: 'eight.boots',
  qualityPoints: 10,
  equipment: { slot: 'boots', hands: 1 },
})
const weapon = itemFixture({
  id: 'eight.weapon',
  qualityPoints: 30,
  itemClass: 'weapon',
  equipment: { slot: 'hand', hands: 1 },
  ability: attack,
  actions: { attack: { behaviorId: attack.behaviors[0]!.id, name: 'Hit' } },
})
const twoHands = itemFixture({
  ...weapon,
  id: 'eight.two-hands',
  equipment: { slot: 'hand', hands: 2 },
  qualityPoints: 60,
})
const passive = itemFixture({
  id: 'eight.passive',
  qualityPoints: 10,
  itemClass: 'hand-armor',
  equipment: { slot: 'hand', hands: 1 },
  ability: recover,
  actions: { support: { behaviorId: recover.behaviors[0]!.id, name: 'Steady' } },
})
const disabled = itemFixture({ ...passive, id: 'eight.disabled' })
const potion = itemFixture({
  id: 'eight.potion',
  qualityPoints: 10,
  itemClass: 'battle-item',
  inventoryCategory: 'battle-items',
  equipment: { slot: 'hand', hands: 1 },
  maximumStack: 99,
  ability: recover,
  actions: { use: { behaviorId: recover.behaviors[0]!.id, name: 'Drink' } },
  battleUses: 3,
})
const archived = itemFixture({ ...potion, id: 'eight.archived' })
const definitions = [
  helm,
  body,
  pants,
  boots,
  weapon,
  twoHands,
  passive,
  disabled,
  potion,
  archived,
]
const basic = { kind: 'basic', actionId: 'basic.pilfer' }
type Equipment = Record<string, string>
interface Scenario {
  name: string
  equipment: Equipment
  expected: Equipment
  support?: string
  active?: boolean
}
const scenarios: Scenario[] = [
  {
    name: 'duplicate-consumable',
    equipment: { 'main-hand': potion.id, 'off-hand': potion.id },
    expected: { 'consumable-1': potion.id, 'consumable-2': potion.id },
  },
  {
    name: 'main-passive',
    equipment: { 'main-hand': passive.id },
    expected: { 'off-hand': passive.id },
    support: 'main-hand',
  },
  {
    name: 'off-weapon',
    equipment: { 'off-hand': weapon.id },
    expected: { 'main-hand': weapon.id },
  },
  {
    name: 'safe-hand-swap',
    equipment: { 'main-hand': passive.id, 'off-hand': weapon.id },
    expected: { 'main-hand': weapon.id, 'off-hand': passive.id },
    support: 'main-hand',
  },
  {
    name: 'passive-after-consumable',
    equipment: { 'main-hand': passive.id, 'off-hand': potion.id },
    expected: { 'off-hand': passive.id, 'consumable-1': potion.id },
    support: 'main-hand',
  },
  {
    name: 'weapon-after-consumable',
    equipment: { 'main-hand': potion.id, 'off-hand': weapon.id },
    expected: { 'main-hand': weapon.id, 'consumable-1': potion.id },
  },
  {
    name: 'dual-weapons',
    equipment: { 'main-hand': weapon.id, 'off-hand': 'eight.weapon-two' },
    expected: { 'main-hand': weapon.id, 'off-hand': 'eight.weapon-two' },
  },
  {
    name: 'dual-passives',
    equipment: { 'main-hand': passive.id, 'off-hand': 'eight.passive-two' },
    expected: { 'main-hand': passive.id, 'off-hand': 'eight.passive-two' },
    support: 'main-hand',
  },
  {
    name: 'unchanged-body',
    equipment: { head: helm.id, body: body.id },
    expected: { head: helm.id, body: body.id },
    support: 'head',
  },
  {
    name: 'unchanged-selected-source',
    equipment: { head: helm.id, 'main-hand': potion.id },
    expected: { head: helm.id, 'consumable-1': potion.id },
    support: 'head',
  },
  {
    name: 'archived-consumable',
    equipment: { 'main-hand': archived.id },
    expected: { 'consumable-1': archived.id },
  },
  {
    name: 'disabled-passive',
    equipment: { 'main-hand': disabled.id },
    expected: { 'off-hand': disabled.id },
    support: 'main-hand',
  },
  {
    name: 'active-history',
    equipment: { 'main-hand': potion.id },
    expected: { 'consumable-1': potion.id },
    active: true,
  },
]
const extraDefinitions = [
  itemFixture({ ...weapon, id: 'eight.weapon-two' }),
  itemFixture({ ...passive, id: 'eight.passive-two' }),
]
interface Fixture {
  user: string
  character: string
  inventory: ItemInventorySnapshot
  build: Record<string, unknown>
  ids: Record<string, string>
}
const fixtures = new Map<string, Fixture>()
interface FunctionMetadata {
  signature: string
  owner: number
  acl: string | null
  config: string[] | null
  definer: boolean
  definition: string
}
let db: PGlite
let beforeFunctions: FunctionMetadata[] = []
let beforeImmutable: unknown
let beforeHistory: unknown
const functions = (database: PGlite) =>
  database.query<FunctionMetadata>(
    `select p.oid::regprocedure::text signature,p.proowner owner,p.proacl::text acl,p.proconfig config,p.prosecdef definer,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app_private','public') and p.prokind='f' order by signature`,
  )
const immutable = async (database: PGlite) =>
  (
    await database.query(
      `select jsonb_build_object('sources',(select jsonb_agg(to_jsonb(s) order by item_id,content_version) from app_private.runtime_item_source_definitions s),'records',(select jsonb_agg(to_jsonb(r) order by content_key) from app_private.combat_content_records r),'versions',(select jsonb_agg(to_jsonb(v) order by id) from app_private.combat_content_versions v),'publications',(select jsonb_agg(to_jsonb(p) order by content_key) from app_private.combat_content_publications p),'stacks',(select jsonb_agg(to_jsonb(s) order by id) from app_private.character_item_stacks s),'grants',(select jsonb_agg(to_jsonb(g) order by character_id,grant_key) from app_private.character_item_grants g)) value`,
    )
  ).rows[0]
const history = async (database: PGlite) =>
  (
    await database.query(
      `select jsonb_build_object('heads',(select jsonb_agg(to_jsonb(s) order by id) from app_private.battle_sessions s),'snapshots',(select jsonb_agg(to_jsonb(s) order by battle_session_id,battle_version) from app_private.battle_snapshots s),'events',(select jsonb_agg(to_jsonb(e) order by battle_session_id,battle_version,event_index) from app_private.battle_events e)) value`,
    )
  ).rows[0]
const inventory = async (database: PGlite, user: string, character: string) =>
  (
    await database.query<{ value: ItemInventorySnapshot }>(
      'select public.read_character_item_inventory_v1($1,$2) value',
      [user, character],
    )
  ).rows[0]!.value
const build = async (database: PGlite, character: string) =>
  (
    await database.query<{ value: Record<string, unknown> }>(
      'select to_jsonb(b) value from app_private.character_active_builds b where character_id=$1',
      [character],
    )
  ).rows[0]!.value
async function expectRejected(work: () => Promise<unknown>, message: string) {
  await db.exec('savepoint rejected')
  await expect(work()).rejects.toMatchObject({ message })
  await db.exec('rollback to savepoint rejected; release savepoint rejected')
}
async function fixture(
  database: PGlite,
  index: number,
  name: string,
  assignments: Equipment,
  supportPosition?: string,
): Promise<Fixture> {
  const user = `00000000-0000-4000-8000-${String(10000 + index).padStart(12, '0')}`
  const character = `00000000-0000-4000-8000-${String(20000 + index).padStart(12, '0')}`
  await database.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
    user,
    `${name}@eight.example.test`,
  ])
  await database.query(
    `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at) values($1,$2,0,1,$3,$3,'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
    [character, user, name],
  )
  const counts = new Map<string, number>()
  for (const itemId of Object.values(assignments)) counts.set(itemId, (counts.get(itemId) ?? 0) + 1)
  await database.query('select public.grant_character_items_v1($1,$2,0,$3,$4::jsonb)', [
    user,
    character,
    `eight-${name}`,
    JSON.stringify([...counts].map(([itemId, quantity]) => ({ itemId, quantity }))),
  ])
  const owned = await inventory(database, user, character)
  const ids = Object.fromEntries(owned.stacks.map((s) => [s.itemId, s.id]))
  const equipment = Object.fromEntries(
    Object.entries(assignments).map(([position, itemId]) => [position, ids[itemId]]),
  )
  const support = supportPosition
    ? {
        kind: 'equipment',
        position: supportPosition,
        itemId: assignments[supportPosition],
        behaviorId: recover.behaviors[0]!.id,
      }
    : basic
  await database.query(
    'select public.set_character_item_equipment_v1($1,$2,1,$3::jsonb,$4::jsonb)',
    [user, character, JSON.stringify(equipment), JSON.stringify(support)],
  )
  return {
    user,
    character,
    ids,
    inventory: await inventory(database, user, character),
    build: await build(database, character),
  }
}

beforeAll(async () => {
  db = await createCombatContentTestDatabase(async (database, name) => {
    if (name !== migration) return
    await database.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
      JSON.stringify([...definitions, ...extraDefinitions]),
    ])
    for (const [index, scenario] of scenarios.entries()) {
      const value = await fixture(
        database,
        index,
        scenario.name,
        scenario.equipment,
        scenario.support,
      )
      fixtures.set(scenario.name, value)
      if (scenario.active) {
        const capture = (
          await database.query<{ value: unknown }>(
            'select public.read_character_battle_equipment_v1($1,$2) value',
            [value.user, value.character],
          )
        ).rows[0]!.value
        const frozen = { equipmentSkills: [capture], retained: 'literal-schema-1' }
        const battleId = '00000000-0000-4000-8000-000000030001'
        // Imported frozen history bypasses current admission, as a retained capture must.
        await database.exec('set session_replication_role=replica')
        await database.query(
          `insert into app_private.battle_sessions(id,owner_user_id,battle_id,rules_version,content_version,lifecycle,current_snapshot) values($1,$2,'eight-retained',1,1,'active',$3)`,
          [battleId, value.user, frozen],
        )
        await database.query(
          `insert into app_private.battle_participants(battle_session_id,combatant_id,participant_role,user_id,character_id) values($1,'player','player',$2,$3)`,
          [battleId, value.user, value.character],
        )
        await database.query(
          'insert into app_private.battle_snapshots(battle_session_id,battle_version,snapshot) values($1,2,$2)',
          [battleId, frozen],
        )
        await database.query(
          'insert into app_private.battle_events(battle_session_id,battle_version,event_index,event) values($1,2,0,$2)',
          [battleId, { retained: capture }],
        )
        await database.exec('set session_replication_role=origin')
      }
    }
    await database.query(
      "update app_private.combat_content_records set lifecycle='archived' where content_key=$1",
      [archived.id],
    )
    await database.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
      JSON.stringify([{ ...disabled, contentVersion: 2, enabled: false }]),
    ])
    beforeFunctions = (await functions(database)).rows
    beforeImmutable = await immutable(database)
    beforeHistory = await history(database)
  })
}, 60000)
afterAll(async () => db?.close())

it.each(scenarios)(
  'migrates $name deterministically without changing owned units, receipts or build authority',
  async (scenario) => {
    const before = fixtures.get(scenario.name)!
    const after = await inventory(db, before.user, before.character)
    const expected = Object.fromEntries(
      Object.entries(scenario.expected).map(([position, itemId]) => [position, before.ids[itemId]]),
    )
    expect(after.equipment).toEqual(expected)
    const changed = JSON.stringify(scenario.equipment) !== JSON.stringify(scenario.expected)
    expect(after.revision).toBe(before.inventory.revision + (changed ? 1 : 0))
    expect(after.stacks).toEqual(before.inventory.stacks)
    expect(after.grants).toEqual(before.inventory.grants)
    expect(after.previousBasicSupport).toBe(before.inventory.previousBasicSupport)
    const nextBuild = await build(db, before.character)
    expect(Number(nextBuild.build_version)).toBe(
      Number(before.build.build_version) + (changed ? 1 : 0),
    )
    const stableAuthority = (value: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(value).filter(
          ([key]) => !['build_version', 'updated_at', 'support_action_id'].includes(key),
        ),
      )
    expect(stableAuthority(nextBuild)).toEqual(stableAuthority(before.build))
    if (scenario.name === 'disabled-passive')
      expect(after.selectedSupport).toEqual({
        kind: 'basic',
        actionId: before.inventory.previousBasicSupport,
      })
    else if (scenario.support)
      expect(after.selectedSupport).toEqual({
        ...before.inventory.selectedSupport,
        position: Object.entries(scenario.expected).find(
          ([, itemId]) => itemId === scenario.equipment[scenario.support!],
        )![0],
      })
    else expect(after.selectedSupport).toEqual(before.inventory.selectedSupport)
  },
)

it('keeps archived definitions, source versions, grants, quantities and every frozen schema-1 row byte-identical', async () => {
  expect(await immutable(db)).toEqual(beforeImmutable)
  expect(await history(db)).toEqual(beforeHistory)
  const retained = (
    await db.query<{
      current_snapshot: {
        equipmentSkills: { schemaVersion: number; equipment: { position: string }[] }[]
      }
    }>("select current_snapshot from app_private.battle_sessions where battle_id='eight-retained'")
  ).rows[0]!.current_snapshot
  expect(retained.equipmentSkills[0]).toMatchObject({
    schemaVersion: 1,
    equipment: [{ position: 'main-hand' }],
  })
})

it('preserves all function owners, ACLs, search paths and security modes, touching exactly five policy bodies', async () => {
  const after = (await functions(db)).rows
  const metadata = ({ signature, owner, acl, config, definer }: FunctionMetadata) => ({
    signature,
    owner,
    acl,
    config,
    definer,
  })
  expect(after.map(metadata)).toEqual(beforeFunctions.map(metadata))
  expect(
    after
      .filter((row, index) => row.definition !== beforeFunctions[index]!.definition)
      .map((row) => row.signature),
  ).toEqual([
    'app_private.battle_equipment_capture_v1(jsonb)',
    'app_private.guard_player_battle_admission_v1()',
    'app_private.item_support_valid_v1(uuid,jsonb,jsonb)',
    'app_private.validate_character_item_equipment_v1(uuid,jsonb,jsonb)',
    'set_character_item_equipment_v1(uuid,uuid,bigint,jsonb,jsonb,text[])',
  ])
})

it.each(['dual-weapons', 'dual-passives'])(
  'retains $s for explicit repair and rejects new admission',
  async (name) => {
    const value = fixtures.get(name)!
    await db.exec('begin')
    try {
      await expectRejected(
        () =>
          db.query('select public.assert_character_item_admission_v1($1,$2,$3)', [
            value.user,
            value.character,
            value.inventory.revision,
          ]),
        'ITEM_SLOT',
      )
      const position = name === 'dual-weapons' ? 'off-hand' : 'main-hand'
      const remaining = { ...value.inventory.equipment }
      delete remaining[position]
      await db.query(
        'select public.set_character_item_equipment_v1($1,$2,$3,$4::jsonb,$5::jsonb,$6::text[])',
        [
          value.user,
          value.character,
          value.inventory.revision,
          JSON.stringify(remaining),
          JSON.stringify(value.inventory.selectedSupport),
          [position],
        ],
      )
      await db.query('select public.assert_character_item_admission_v1($1,$2,$3)', [
        value.user,
        value.character,
        value.inventory.revision + 1,
      ])
    } finally {
      await db.exec('rollback')
    }
  },
)

it('rejects forged weapon/off, passive/main, consumable/hands and gear/consumable assignments through real SQL', async () => {
  await db.exec('begin')
  try {
    const value = await fixture(db, 90, 'current-forgeries', { head: helm.id })
    await db.query('select public.grant_character_items_v1($1,$2,2,$3,$4::jsonb)', [
      value.user,
      value.character,
      'other-equipment',
      JSON.stringify([
        { itemId: weapon.id, quantity: 1 },
        { itemId: passive.id, quantity: 1 },
        { itemId: potion.id, quantity: 1 },
      ]),
    ])
    const current = await inventory(db, value.user, value.character)
    const ids = Object.fromEntries(current.stacks.map((s) => [s.itemId, s.id]))
    for (const equipment of [
      { 'off-hand': ids[weapon.id] },
      { 'main-hand': ids[passive.id] },
      { 'main-hand': ids[potion.id] },
      { 'off-hand': ids[potion.id] },
      { 'consumable-1': ids[helm.id] },
      { 'consumable-2': ids[weapon.id] },
    ]) {
      await expectRejected(
        () =>
          db.query(
            'select public.set_character_item_equipment_v1($1,$2,3,$3::jsonb,$4::jsonb,$5::text[])',
            [
              value.user,
              value.character,
              JSON.stringify(equipment),
              JSON.stringify(basic),
              ['head'],
            ],
          ),
        'ITEM_SLOT',
      )
    }
    await expectRejected(
      () =>
        db.query(
          'select app_private.validate_character_item_equipment_v1($1,$2::jsonb,$3::jsonb)',
          [
            value.character,
            JSON.stringify({
              'consumable-1': fixtures.get('duplicate-consumable')!.ids[potion.id],
            }),
            JSON.stringify(basic),
          ],
        ),
      'ITEM_OWNERSHIP',
    )
    await expectRejected(
      () =>
        db.query(
          'select app_private.validate_character_item_equipment_v1($1,$2::jsonb,$3::jsonb)',
          [
            value.character,
            JSON.stringify({ 'consumable-1': ids[potion.id], 'consumable-2': ids[potion.id] }),
            JSON.stringify(basic),
          ],
        ),
      'ITEM_QUANTITY',
    )
  } finally {
    await db.exec('rollback')
  }
})

it('captures eight positions in order with 100 QP and a two-handed weapon plus both independent consumables', async () => {
  await db.exec('begin')
  try {
    const value = await fixture(db, 91, 'current-eight', {
      head: helm.id,
      body: body.id,
      pants: pants.id,
      boots: boots.id,
      'main-hand': weapon.id,
      'off-hand': passive.id,
      'consumable-1': potion.id,
      'consumable-2': potion.id,
    })
    const capture = (
      await db.query<{
        value: {
          schemaVersion: number
          equipment: { position: string; ownedStackId: string; item: unknown }[]
        }
      }>('select public.read_character_battle_equipment_v1($1,$2) value', [
        value.user,
        value.character,
      ])
    ).rows[0]!.value
    expect(capture.schemaVersion).toBe(2)
    expect(capture.equipment.map((entry) => entry.position)).toEqual([
      'head',
      'body',
      'pants',
      'boots',
      'main-hand',
      'off-hand',
      'consumable-1',
      'consumable-2',
    ])
    expect(capture.equipment[6]!.ownedStackId).toBe(capture.equipment[7]!.ownedStackId)
    expect(capture.equipment[6]!.item).toEqual(potion)
    expect(capture.equipment[7]!.item).toEqual(potion)
    expect(
      (
        await db.query<{ value: { qualityPoints: number } }>(
          'select public.assert_character_item_admission_v1($1,$2,2) value',
          [value.user, value.character],
        )
      ).rows[0]!.value.qualityPoints,
    ).toBe(100)
    await db.query('select public.grant_character_items_v1($1,$2,2,$3,$4::jsonb)', [
      value.user,
      value.character,
      'two-hands',
      JSON.stringify([{ itemId: twoHands.id, quantity: 1 }]),
    ])
    const current = await inventory(db, value.user, value.character)
    const twoHandId = current.stacks.find((s) => s.itemId === twoHands.id)!.id
    const next = {
      'main-hand': twoHandId,
      'consumable-1': value.ids[potion.id],
      'consumable-2': value.ids[potion.id],
      head: value.ids[helm.id],
      body: value.ids[body.id],
    }
    await db.query(
      'select public.set_character_item_equipment_v1($1,$2,3,$3::jsonb,$4::jsonb,$5::text[])',
      [
        value.user,
        value.character,
        JSON.stringify(next),
        JSON.stringify(basic),
        ['main-hand', 'off-hand', 'pants', 'boots'],
      ],
    )
    expect(
      (
        await db.query<{ value: { qualityPoints: number } }>(
          'select public.assert_character_item_admission_v1($1,$2,4) value',
          [value.user, value.character],
        )
      ).rows[0]!.value.qualityPoints,
    ).toBe(100)
    await expectRejected(
      () =>
        db.query(
          'select app_private.validate_character_item_equipment_v1($1,$2::jsonb,$3::jsonb)',
          [
            value.character,
            JSON.stringify({ ...next, 'off-hand': value.ids[passive.id] }),
            JSON.stringify(basic),
          ],
        ),
      'ITEM_HAND_CONFLICT',
    )
    await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
      JSON.stringify([{ ...potion, contentVersion: 2, qualityPoints: 11 }]),
    ])
    await expectRejected(
      () =>
        db.query('select public.assert_character_item_admission_v1($1,$2,4)', [
          value.user,
          value.character,
        ]),
      'ITEM_OVER_QP',
    )
    // Both new slots are accepted by the real adapter's explicit unequip allowlist.
    const token = (
      await db.query<{ token: string }>(
        "select public.read_character_items_view_v1($1,$2)->>'catalogueToken' token",
        [value.user, value.character],
      )
    ).rows[0]!.token
    await db.query('select public.write_character_items_v1($1,$2,4,$3,$4::jsonb)', [
      value.user,
      value.character,
      token,
      JSON.stringify({
        action: 'equipment',
        equipment: { head: value.ids[helm.id] },
        selectedSupport: basic,
        replacePositions: ['main-hand', 'body', 'consumable-1', 'consumable-2'],
      }),
    ])
    expect((await inventory(db, value.user, value.character)).equipment).toEqual({
      head: value.ids[helm.id],
    })
  } finally {
    await db.exec('rollback')
  }
})

it('rolls back all changes if any exact policy predecessor is not recognized', async () => {
  await db.exec('begin')
  const before = (await functions(db)).rows
  // Re-applying after the successful additive migration must not mutate any data.
  await expect(db.exec(migrationSql)).rejects.toThrow('ITEM_EIGHT_SLOT_PREDECESSOR_CONFLICT')
  await db.exec('rollback')
  expect((await functions(db)).rows).toEqual(before)
  expect(await immutable(db)).toEqual(beforeImmutable)
  expect(await history(db)).toEqual(beforeHistory)
})

it('atomically rolls back earlier assignment moves and policy changes if a later revision cannot advance', async () => {
  const installed = (await functions(db)).rows
  const inventoryRows = async () =>
    (
      await db.query(
        'select to_jsonb(i) value from app_private.character_item_inventory i order by character_id',
      )
    ).rows
  const beforeRows = await inventoryRows()
  await db.exec('begin')
  try {
    for (const original of beforeFunctions) {
      if (
        installed.find((row) => row.signature === original.signature)!.definition !==
        original.definition
      )
        await db.exec(original.definition)
    }
    for (const [name, revision] of [
      ['duplicate-consumable', 2],
      ['active-history', 9007199254740991],
    ] as const) {
      const value = fixtures.get(name)!
      await db.query(
        'update app_private.character_item_inventory set equipment=$2::jsonb,selected_support=$3::jsonb,revision=$4 where character_id=$1',
        [
          value.character,
          JSON.stringify(value.inventory.equipment),
          JSON.stringify(value.inventory.selectedSupport),
          revision,
        ],
      )
    }
    await expect(db.exec(migrationSql)).rejects.toMatchObject({ code: '23514' })
  } finally {
    await db.exec('rollback')
  }
  expect((await functions(db)).rows).toEqual(installed)
  expect(await inventoryRows()).toEqual(beforeRows)
  expect(await immutable(db)).toEqual(beforeImmutable)
  expect(await history(db)).toEqual(beforeHistory)
})
