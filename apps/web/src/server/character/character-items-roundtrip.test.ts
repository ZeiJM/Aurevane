import { afterAll, beforeAll, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { createCombatContentTestDatabase } from '../../../../../packages/db/src/test-support/combat-content-test-database'
import { itemFixture } from '../../../../../packages/game-core/src/content/items-test-fixtures'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  createRpcCharacterItemsRepository,
  type ItemRpc,
} from './supabase-character-items-repository'
import {
  createCombatContentResolver,
  RpcPublishedCombatContentSource,
} from '../combat/combat-content-resolver'
import { grantCharacterItems, type CharacterItemsView } from './character-items-service'
import { createCharacterItemsHandler } from './character-items-handler'
const user = '00000000-0000-4000-8000-000000008001',
  character = '00000000-0000-4000-8000-000000008011'
const helm = itemFixture({ media: { artworkId: 'environment.entry.gateway' } })
const sword = itemFixture({
  id: 'test.sword',
  name: 'Sword',
  media: helm.media,
  itemClass: 'weapon',
  equipment: { slot: 'hand', hands: 1 },
  ability: {
    schemaVersion: 1,
    behaviors: [
      {
        ...defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!,
        id: 'strike',
      },
      {
        ...defaultBasicSkills().find((row) => row.id === 'basic.recover')!.ability.behaviors[0]!,
        id: 'mend',
      },
    ],
  },
  actions: {
    attack: { behaviorId: 'strike', name: 'Cut' },
    support: { behaviorId: 'mend', name: 'Mend' },
  },
})
let db: Awaited<ReturnType<typeof createCombatContentTestDatabase>>
const rpc: ItemRpc = async (name, parameters) => {
  try {
    const values = Object.values(parameters).map((value) =>
      typeof value === 'object' && value !== null ? JSON.stringify(value) : value,
    )
    const sql = `select public.${name}(${Object.keys(parameters)
      .map((key, index) => `${key} => $${index + 1}`)
      .join(',')}) result`
    return { data: (await db.query<{ result: unknown }>(sql, values)).rows[0]!.result, error: null }
  } catch (error) {
    return { data: null, error: error as { code?: string; message?: string } }
  }
}
const repository = createRpcCharacterItemsRepository(rpc)
const handler = createCharacterItemsHandler({
  selected: async () => ({ userId: user, characterId: character }),
  repository: () => repository,
})
const read = async () => {
  const response = await handler(new Request('http://local/api/character/items'))
  expect(response.status).toBe(200)
  return (await response.json()).view as CharacterItemsView
}
const post = async (view: CharacterItemsView, command: object) =>
  handler(
    new Request('http://local/api/character/items', {
      method: 'POST',
      body: JSON.stringify({
        characterId: character,
        expectedRevision: view.revision,
        catalogueToken: view.catalogueToken,
        ...command,
      }),
    }),
  )
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
    user,
    'roundtrip@example.test',
  ])
  await db.query(
    `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at) values($1,$2,0,1,'Roundtrip','roundtrip','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
    [character, user],
  )
  await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
    JSON.stringify([helm, sword]),
  ])
}, 60000)
afterAll(async () => db?.close())
it('roundtrips trusted grant, equip/swap/unequip, source Support fallback, sorting/reload and current media through authenticated request intent', async () => {
  const manifest = {
    key: 'test-authorized-source',
    items: [
      { itemId: helm.id, quantity: 1 },
      { itemId: sword.id, quantity: 2 },
    ],
  }
  await grantCharacterItems(user, character, manifest, repository)
  await grantCharacterItems(user, character, manifest, repository)
  let view = await read()
  expect(view.stacks).toHaveLength(3)
  const stack = view.stacks.find((row) => row.itemId === sword.id)!
  let response = await post(view, { action: 'equip', stackId: stack.id, position: 'main-hand' })
  expect(response.status).toBe(200)
  view = (await response.json()).view
  response = await post(view, {
    action: 'support',
    selection: { kind: 'equipment', position: 'main-hand', itemId: sword.id, behaviorId: 'mend' },
  })
  expect(response.status).toBe(200)
  view = (await response.json()).view
  const replacement = view.stacks.find((row) => row.itemId === sword.id && row.id !== stack.id)!
  expect(
    (await post(view, { action: 'equip', stackId: replacement.id, position: 'main-hand' })).status,
  ).toBe(400)
  response = await post(view, {
    action: 'equip',
    stackId: replacement.id,
    position: 'main-hand',
    replacePositions: ['main-hand'],
  })
  expect(response.status).toBe(200)
  view = (await response.json()).view
  expect(view.equipment['main-hand']).toBe(replacement.id)
  expect(view.notices).toEqual(['equipment-support-removed'])
  expect(view.selectedSupport).toEqual({ kind: 'basic', actionId: 'basic.recover' })
  response = await post(view, {
    action: 'support',
    selection: { kind: 'equipment', position: 'main-hand', itemId: sword.id, behaviorId: 'mend' },
  })
  expect(response.status).toBe(200)
  view = (await response.json()).view
  response = await post(view, { action: 'unequip', position: 'main-hand' })
  expect(response.status).toBe(200)
  view = (await response.json()).view
  expect(view.notices).toEqual(['equipment-support-removed'])
  expect(view.selectedSupport).toEqual({ kind: 'basic', actionId: 'basic.recover' })
  response = await post(view, {
    action: 'sort',
    category: 'gear',
    order: [stack.id, ...view.stacks.filter((row) => row.id !== stack.id).map((row) => row.id)],
  })
  expect(response.status).toBe(200)
  view = await read()
  expect(view.stacks.find((row) => row.id === stack.id)!.slotIndex).toBe(0)
  const stale = view
  await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
    JSON.stringify([
      { ...helm, contentVersion: 2, media: { artworkId: 'environment.entry.prestige-doorway' } },
    ]),
  ])
  view = await read()
  expect(view.stacks.find((row) => row.itemId === helm.id)!.item!.artworkSrc).toContain(
    'prestige-doorway',
  )
  expect(
    (await post(stale, { action: 'equip', stackId: stack.id, position: 'main-hand' })).status,
  ).toBe(409)
  expect(
    (await post(view, { action: 'grant', items: [{ itemId: sword.id, quantity: 99 }] })).status,
  ).toBe(400)
  expect(
    (
      await post(view, {
        action: 'equip',
        stackId: stack.id,
        position: 'main-hand',
        characterId: 'foreign',
      })
    ).status,
  ).toBe(400)
  const foreign = createCharacterItemsHandler({
    selected: async () => ({
      userId: '00000000-0000-4000-8000-000000008099',
      characterId: character,
    }),
    repository: () => repository,
  })
  expect((await foreign(new Request('http://local'))).status).toBe(403)
  expect(JSON.stringify(view)).not.toMatch(/test-authorized-source|"ability"|"grants"|"provenance"/)
}, 60000)

it('grants only the selected staff character through the bounded audited endpoint and keeps duplicate request identities stable', async () => {
  const { createMasterItemGrantHandler } = await import('../master/master-item-grant-handler')
  const grantHandler = createMasterItemGrantHandler({
    selected: async () => ({ userId: user, characterId: character }),
    rpc: async (name, parameters) => {
      try {
        return {
          data: (
            await db.query<{ result: unknown }>(
              `select public.${name}(${Object.keys(parameters)
                .map((key, index) => `${key} => $${index + 1}`)
                .join(',')}) result`,
              Object.values(parameters),
            )
          ).rows[0]!.result,
          error: null,
        }
      } catch (error) {
        return { data: null, error: error as { code?: string; message?: string } }
      }
    },
  })
  const view = await read()
  const payload = {
    characterId: character,
    itemId: helm.id,
    quantity: 1,
    expectedRevision: view.revision,
    catalogueToken: view.catalogueToken,
    requestId: '00000000-0000-4000-8000-000000008991',
  }
  const submit = (body: object) =>
    grantHandler(new Request('http://local', { method: 'POST', body: JSON.stringify(body) }))
  expect((await submit(payload)).status).toBe(403)
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [user],
  )
  expect((await submit({ ...payload, targetUserId: 'forged' })).status).toBe(400)
  const response = await submit(payload)
  expect(response.status).toBe(200)
  const after = await response.json()
  expect(
    after.view.stacks.filter((row: { itemId: string }) => row.itemId === helm.id),
  ).toHaveLength(2)
  expect((await submit(payload)).status).toBe(200)
  expect((await submit({ ...payload, characterId: 'foreign' })).status).toBe(400)
})

it('repairs and sorts archived owned Items through the real owner/current adapters without losing pinned history', async () => {
  await db.exec('begin')
  try {
    let view = await read()
    const ownedHelm = view.stacks.find((row) => row.itemId === helm.id)!
    const ownedSword = view.stacks.find((row) => row.itemId === sword.id)!
    const resolver = createCombatContentResolver(new RpcPublishedCombatContentSource(rpc))
    const pinned = await resolver.resolvePinnedItemDefinition!(
      helm.id,
      ownedHelm.item!.contentVersion,
    )
    let response = await post(view, { action: 'equip', stackId: ownedHelm.id, position: 'head' })
    expect(response.status).toBe(200)
    view = (await response.json()).view
    const beforeArchiveToken = view.catalogueToken
    await db.query(
      "update app_private.combat_content_records set lifecycle='archived' where content_key=$1",
      [helm.id],
    )
    const result = await rpc('read_character_items_view_v1', {
      p_user_id: user,
      p_character_id: character,
    })
    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({ definitions: { [helm.id]: null } })
    expect(await resolver.resolveCurrentItemDefinition!(helm.id)).toBeNull()
    expect(await resolver.resolvePinnedItemDefinition!(helm.id, pinned!.contentVersion)).toEqual(
      pinned,
    )
    view = await read()
    expect(view.catalogueToken).not.toBe(beforeArchiveToken)
    expect(view.stacks.find((row) => row.id === ownedHelm.id)!.item).toBeNull()
    expect(view.equipmentIssue).not.toBeNull()
    response = await post(view, { action: 'unequip', position: 'head' })
    expect(response.status).toBe(200)
    view = (await response.json()).view
    expect(view.equipmentIssue).toBeNull()
    const order = [...view.stacks].sort((a, b) => b.slotIndex - a.slotIndex).map((row) => row.id)
    response = await post(view, { action: 'sort', category: 'gear', order })
    expect(response.status).toBe(200)
    view = await read()
    expect([...view.stacks].sort((a, b) => a.slotIndex - b.slotIndex).map((row) => row.id)).toEqual(
      order,
    )
    expect(
      (await post(view, { action: 'equip', stackId: ownedHelm.id, position: 'head' })).status,
    ).toBe(400)
    response = await post(view, { action: 'equip', stackId: ownedSword.id, position: 'main-hand' })
    expect(response.status).toBe(200)
    view = await read()
    expect(view.equipment).toEqual({ 'main-hand': ownedSword.id })
    expect(
      view.stacks.filter((row) => row.itemId === helm.id).every((row) => row.item === null),
    ).toBe(true)
    expect(await resolver.resolvePinnedItemDefinition!(helm.id, pinned!.contentVersion)).toEqual(
      pinned,
    )
  } finally {
    await db.exec('rollback')
  }
}, 60000)
