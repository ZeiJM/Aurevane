import type { ItemInventorySnapshot } from '../../game-core/src/character/item-inventory'
import type { ItemEquipContext } from '../../game-core/src/character/item-equip-requirements'
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import { itemFixture } from '../../game-core/src/content/items-test-fixtures'
import { starterItemDefinitions } from '../../game-core/src/content/starter-items'
const user = '00000000-0000-4000-8000-000000008801',
  character = '00000000-0000-4000-8000-000000008811'
let db: PGlite
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  await db.exec(
    `insert into auth.users(id,email,email_confirmed_at) values('${user}','equip-req@example.test',now()); insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at) values('${character}','${user}',0,1,'Requirements Hero','requirements-hero','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`,
  )
}, 60000)
afterAll(async () => db?.close())
beforeEach(async () => {
  await db.exec('begin')
})
afterEach(async () => {
  await db.exec('rollback')
})
const seed = (defs: unknown[]) =>
  db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [JSON.stringify(defs)])
const read = async () =>
  (
    await db.query<{ s: ItemInventorySnapshot }>(
      'select public.read_character_item_inventory_v1($1,$2) s',
      [user, character],
    )
  ).rows[0]!.s
const grant = async (id: string, quantity = 1) =>
  db.query('select public.grant_character_items_v1($1,$2,0,$3,$4::jsonb)', [
    user,
    character,
    'test',
    JSON.stringify([{ itemId: id, quantity }]),
  ])
const equip = (revision: number, equipment: object, replace: string[] = []) =>
  db.query(
    'select public.set_character_item_equipment_v1($1,$2,$3,$4::jsonb,$5::jsonb,$6::text[])',
    [
      user,
      character,
      revision,
      JSON.stringify(equipment),
      JSON.stringify({ kind: 'basic', actionId: 'basic.recover' }),
      replace,
    ],
  )
async function rejects(fn: () => Promise<unknown>, message: string) {
  await db.exec('savepoint rejected')
  await expect(fn()).rejects.toThrow(message)
  await db.exec('rollback to savepoint rejected;release savepoint rejected')
}
it('validates level, any equipped discipline and all base stats in actual equip and admission; changed requirements never mutate inventory', async () => {
  const helm = itemFixture({
    equipRequirements: {
      minimumLevel: 1,
      disciplineIds: ['vanguard', 'custom.other'],
      minimumCoreStats: { might: 12, resolve: 6 },
    },
  })
  await seed([helm])
  for (const requirements of [
    { minimumLevel: 2 },
    { disciplineIds: ['custom.other'] },
    { minimumCoreStats: { resolve: 7 } },
  ]) {
    await rejects(
      () =>
        db.query('select app_private.assert_item_equip_requirements_v1($1,$2::jsonb)', [
          character,
          JSON.stringify({ ...helm, equipRequirements: requirements }),
        ]),
      'ITEM_EQUIP_REQUIREMENTS',
    )
  }
  await grant(helm.id)
  const s = await read()
  await equip(1, { head: s.stacks[0]!.id })
  await db.query('select public.assert_character_item_admission_v1($1,$2,2)', [user, character])
  await db.exec(`update public.characters set might=11 where id='${character}'`)
  await rejects(() => equip(2, { head: s.stacks[0]!.id }), 'ITEM_EQUIP_REQUIREMENTS')
  await rejects(
    () => db.query('select public.read_character_battle_equipment_v1($1,$2)', [user, character]),
    'ITEM_EQUIP_REQUIREMENTS',
  )
  expect((await read()).equipment).toEqual({ head: s.stacks[0]!.id })
  await equip(2, {}, ['head'])
  expect((await read()).equipment).toEqual({})
})
it('rejects duplicate consumable identities in one or separate stacks; permits manual repair', async () => {
  const potion = starterItemDefinitions().find((x) => x.itemClass === 'battle-item')!
  await seed([potion])
  await grant(potion.id, 99)
  const s = await read()
  const id = s.stacks[0]!.id
  await rejects(
    () => equip(1, { 'consumable-1': id, 'consumable-2': id }),
    'ITEM_DUPLICATE_CONSUMABLE',
  )
  await db.query(
    `insert into app_private.character_item_stacks(character_id,item_id,inventory_category,slot_index,quantity,acquired_content_version,provenance) values($1,$2,'battle-items',1,1,1,'test')`,
    [character, potion.id],
  )
  const next = await read()
  await rejects(
    () => equip(1, { 'consumable-1': id, 'consumable-2': next.stacks[1]!.id }),
    'ITEM_DUPLICATE_CONSUMABLE',
  )
  await db.query(
    `update app_private.character_item_inventory set equipment=$2::jsonb where character_id=$1`,
    [character, JSON.stringify({ 'consumable-1': id, 'consumable-2': next.stacks[1]!.id })],
  )
  await rejects(
    () => db.query('select public.read_character_battle_equipment_v1($1,$2)', [user, character]),
    'ITEM_DUPLICATE_CONSUMABLE',
  )
  await equip(1, { 'consumable-1': id }, ['consumable-2'])
  expect((await read()).equipment).toEqual({ 'consumable-1': id })
})
it('strictly rejects malformed requirements but exposes authoritative context on the owner read', async () => {
  for (const req of [
    null,
    { minimumLevel: 0 },
    { minimumCoreStats: { power: 2 } },
    { disciplineIds: ['vanguard', 'vanguard'] },
  ])
    await rejects(
      () => seed([itemFixture({ equipRequirements: req as never })]),
      'ITEM_EQUIP_REQUIREMENTS_SHAPE',
    )
  const view = (
    await db.query<{ v: { equipContext: ItemEquipContext } }>(
      'select public.read_character_items_view_v1($1,$2) v',
      [user, character],
    )
  ).rows[0]!.v
  expect(view.equipContext).toMatchObject({
    level: 1,
    disciplineIds: ['vanguard'],
    baseCoreStats: { might: 12 },
  })
})
