import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { currentEssenceDefinitions } from '@aurevane/game-core/combat/essence'
import { currentResonanceDefinitions } from '@aurevane/game-core/combat/resonance'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { beforeEach, expect, it, vi } from 'vitest'
import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: async () => ({ userId: 'owner' }) }))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: async () => ({ id: 'selected' }),
}))
import { handleCombatContentAuthoringRequest } from './combat-content-authoring-handler'
import { createServerCombatContentAuthoringService } from './combat-content-authoring-server'
const requestId = '00000000-0000-4000-8000-000000000099'
const definition = {
  schemaVersion: 1,
  id: 'item.input',
  contentVersion: 1,
  name: 'Field kit',
  description: 'A supported field kit intent.',
  sortOrder: 0,
  enabled: true,
  media: {},
  requirements: null,
  ability: null,
  itemClass: 'consumable',
  usage: 'active',
  equipmentSlot: null,
  acquisition: 'unimplemented',
}
const call = (command: unknown) =>
  handleCombatContentAuthoringRequest(
    new Request('https://example.test/api/master/combat-content', {
      method: 'POST',
      body: JSON.stringify({ operation: 'record', command }),
    }),
    {
      getActor: async () => ({ userId: 'owner' }),
      createService: createServerCombatContentAuthoringService,
    },
  )
beforeEach(() => {
  rpc.mockReset()
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'read_master_panel_operator_v1')
      return { data: [{ user_id: 'owner', enabled: true, role: 'owner' }], error: null }
    if (name === 'write_combat_content_record_v1') {
      const command = args.p_command as { definition: unknown; contentKind?: string }
      return {
        data: {
          contentKey: args.p_content_key,
          contentKind: command.contentKind ?? 'item',
          lifecycle: 'draft',
          revision: 1,
          versionFloor: 0,
          createdBy: 'owner',
          createdAt: '2026-10-20',
          draft: {
            definition: command.definition,
            draftVersion: 1,
            baseVersion: null,
            updatedBy: 'owner',
            updatedAt: '2026-10-20',
            restoredFrom: null,
            restoredBy: null,
          },
          current: null,
          history: [],
          usedBy: [],
          links: [],
        },
        error: null,
      }
    }
    throw new Error(`Unexpected RPC ${name}`)
  })
})
it('deletion forwards only the reviewed server token and the selected operator', async () => {
  const previous = rpc.getMockImplementation()!
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'delete_discipline_v1')
      return { data: { deletedKeys: ['discipline.test'] }, error: null }
    return previous(name, args)
  })
  const reviewToken = 'a'.repeat(32)
  const response = await call({
    action: 'delete-discipline',
    contentKey: 'discipline.test',
    reviewToken,
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ deletedKeys: ['discipline.test'] })
  expect(rpc).toHaveBeenCalledWith('delete_discipline_v1', {
    p_actor_user_id: 'owner',
    p_actor_character_id: 'selected',
    p_content_key: 'discipline.test',
    p_review_token: reviewToken,
  })
})
it.each([
  { action: 'delete-discipline', contentKey: 'discipline.test' },
  {
    action: 'delete-discipline',
    contentKey: 'discipline.test',
    reviewToken: 'a'.repeat(32),
    deletedKeys: ['discipline.other'],
  },
  { action: 'review-deletion', contentKey: 'discipline.test', actor: 'owner' },
])('rejects invalid or caller-expanded deletion commands', async (command) => {
  expect((await call(command)).status).toBe(400)
  expect(
    rpc.mock.calls.some(([name]) =>
      ['delete_discipline_v1', 'review_discipline_deletion_v1'].includes(name),
    ),
  ).toBe(false)
})
it('stale deletion review returns a conflict rather than a success receipt', async () => {
  const previous = rpc.getMockImplementation()!
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'delete_discipline_v1')
      return { data: null, error: { code: '40001', message: 'DISCIPLINE_DELETE_REVIEW_CHANGED' } }
    return previous(name, args)
  })
  expect(
    (
      await call({
        action: 'delete-discipline',
        contentKey: 'discipline.test',
        reviewToken: 'a'.repeat(32),
      })
    ).status,
  ).toBe(409)
})
it('actual record handler creates a finite future draft with server-derived identity and selected actor', async () => {
  const response = await call({ action: 'create', requestId, contentKind: 'item', definition })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    record: {
      contentKey: `item.${requestId}`,
      draft: { definition: { ...definition, id: `item.${requestId}` } },
    },
  })
  expect(rpc).toHaveBeenCalledWith(
    'write_combat_content_record_v1',
    expect.objectContaining({ p_actor_character_id: 'selected' }),
  )
})
it.each([
  { ...definition, itemClass: 'invented' },
  { ...definition, execute: 'arbitrary' },
  { ...definition, requirements: { kind: 'script', script: 'grant()' } },
])('rejects unsupported future draft before any write', async (invalid) => {
  expect(
    (await call({ action: 'create', requestId, contentKind: 'item', definition: invalid })).status,
  ).toBe(400)
  expect(rpc.mock.calls.some(([name]) => name === 'write_combat_content_record_v1')).toBe(false)
})
it('complete-record publication never accepts caller-supplied bodies or actor authority', async () => {
  expect(
    (
      await call({
        action: 'publish',
        contentKey: 'item.test',
        expectedDraftVersion: 1,
        expectedBaseVersion: null,
        definition,
        p_actor_character_id: 'forged',
      })
    ).status,
  ).toBe(400)
  expect(rpc.mock.calls.some(([name]) => name === 'publish_saved_combat_content_v1')).toBe(false)
})

it.each(['status', 'effect-profile'] as const)(
  'rejects unsupported %s create before the actual write RPC',
  async (contentKind) => {
    const response = await call({
      action: 'create',
      requestId,
      contentKind,
      definition: { arbitrary: { execute: 'unsupported' } },
    })
    expect(rpc.mock.calls.some(([name]) => name === 'write_combat_content_record_v1')).toBe(false)
    expect(response.status).toBe(400)
  },
)
it('creates an actual finite Status without changing its runtime definition fields', async () => {
  const status = structuredClone(PHASE4_STATUSES.find((s) => s.id === 'mark')!)
  const response = await call({
    action: 'create',
    requestId,
    contentKind: 'status',
    definition: status,
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    record: {
      contentKind: 'status',
      draft: { definition: { ...status, id: `status.${requestId}` } },
    },
  })
})
it.each([
  { arbitrary: { execute: 'unsupported' } },
  { ...PHASE4_STATUSES[0], movement: { blocked: true, execute: 'unsupported' } },
  {
    ...PHASE4_STATUSES[0],
    damageModifiers: [
      {
        direction: 'outgoing',
        multiplierBasisPoints: 11000,
        condition: { kind: 'always', execute: 'unsupported' },
      },
    ],
  },
  { ...PHASE4_STATUSES[0], endOfTurn: null },
  { ...PHASE4_STATUSES[0], contentVersion: 0 },
])('rejects malformed or unknown Status fields on actual save before write', async (invalid) => {
  const status = { ...PHASE4_STATUSES[0], id: 'status.saved' }
  rpc.mockImplementation(async (name: string) => {
    if (name === 'read_master_panel_operator_v1')
      return { data: [{ user_id: 'owner', enabled: true, role: 'owner' }], error: null }
    if (name === 'read_combat_content_record_v1')
      return {
        data: {
          contentKey: status.id,
          contentKind: 'status',
          lifecycle: 'draft',
          revision: 1,
          versionFloor: 0,
          createdBy: 'owner',
          createdAt: '2026-10-20',
          draft: {
            definition: status,
            draftVersion: 1,
            baseVersion: null,
            updatedBy: 'owner',
            updatedAt: '2026-10-20',
            restoredFrom: null,
            restoredBy: null,
          },
          current: null,
          history: [],
          usedBy: [],
          links: [],
        },
        error: null,
      }
    throw new Error(`Unexpected RPC ${name}`)
  })
  const response = await call({
    action: 'save',
    contentKey: status.id,
    expectedRevision: 1,
    definition: { ...invalid, id: status.id },
  })
  expect(rpc.mock.calls.some(([name]) => name === 'write_combat_content_record_v1')).toBe(false)
  expect(response.status).toBe(400)
})

it('passes global sort and bounded cursor to the same authorized list RPC', async () => {
  rpc.mockImplementation(async (name: string) => {
    if (name === 'read_master_panel_operator_v1')
      return { data: [{ user_id: 'owner', enabled: true, role: 'owner' }], error: null }
    if (name === 'list_combat_content_records_v1')
      return { data: { records: [], nextCursor: null }, error: null }
    throw new Error(`Unexpected RPC ${name}`)
  })
  const cursor = JSON.stringify({ sort: 'name-asc', key: 'skill.test', name: 'Same name' })
  const response = await call({
    action: 'list',
    kind: 'skill',
    sort: 'name-asc',
    after: cursor,
    search: 'name',
    limit: 20,
  })
  expect(response.status).toBe(200)
  expect(rpc).toHaveBeenCalledWith(
    'list_combat_content_records_v1',
    expect.objectContaining({
      p_search: 'name',
      p_limit: 20,
      p_actor_character_id: 'selected',
      p_after: JSON.stringify({ sort: 'name-asc', after: JSON.parse(cursor) }),
    }),
  )
  expect((await call({ action: 'list', sort: 'sql-order' })).status).toBe(400)
})

it.each(
  (['skill', 'essence', 'resonance'] as const).flatMap((kind) =>
    (['physical', 'mystic'] as const).map((family) => ({ kind, family })),
  ),
)(
  'the real record create boundary enforces $kind $family formula despite forged payload overrides',
  async ({ kind, family }) => {
    const behavior = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability
      .behaviors[0]!
    const ability = {
      schemaVersion: 1,
      behaviors: [
        {
          ...behavior,
          ...(kind === 'resonance'
            ? {
                activation: 'automatic' as const,
                requirements: {
                  kind: 'event' as const,
                  eventType: 'combat_action_used' as const,
                  phase: 'after' as const,
                },
                automaticTarget: { subject: 'selected' as const },
              }
            : {}),
          attackFamily: family,
          effects: [
            {
              id: 'hit',
              payload: {
                type: 'damage',
                recipient: 'primary-unit',
                amount: 7,
                defenseKind: family === 'mystic' ? 'armor' : 'ward',
                scaling: {
                  source: family === 'mystic' ? 'physical-power' : 'mystic-power',
                  coefficientBasisPoints: 0,
                },
                facingModifiersBasisPoints: { front: 20000, side: 20000, rear: 20000 },
              },
            },
          ],
        },
      ],
    }
    const skill = { ...resolveMatureSkillVersion('vanguard.forceful-strike')!, ability }
    const definition =
      kind === 'skill'
        ? skill
        : kind === 'essence'
          ? {
              ...currentEssenceDefinitions()[0]!,
              ability,
              skill: { ...currentEssenceDefinitions()[0]!.skill, ability },
            }
          : { ...currentResonanceDefinitions()[0]!, ability }
    const response = await call({ action: 'create', requestId, contentKind: kind, definition })
    expect(response.status).toBe(200)
    const body = await response.json()
    const payload = body.record.draft.definition.ability.behaviors[0].effects[0].payload
    expect(payload).toEqual({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 7,
      defenseKind: family === 'physical' ? 'armor' : 'ward',
      scaling: {
        source: family === 'physical' ? 'physical-power' : 'mystic-power',
        coefficientBasisPoints: 2500,
      },
    })
    expect(rpc).toHaveBeenCalledWith(
      'write_combat_content_record_v1',
      expect.objectContaining({
        p_command: expect.objectContaining({
          definition: expect.objectContaining({
            ability: expect.objectContaining({
              behaviors: expect.arrayContaining([
                expect.objectContaining({ effects: [{ id: 'hit', payload }] }),
              ]),
            }),
          }),
        }),
      }),
    )
  },
)

it('Commit Now creation corrects a nearby power entry and reports the repair from the authoritative boundary', async () => {
  const ability = structuredClone(
    defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability,
  )
  const correctedAbility = {
    ...ability,
    behaviors: [
      {
        ...ability.behaviors[0]!,
        effects: [
          { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 21 } },
        ],
      },
    ],
  }
  const response = await call({
    action: 'create',
    requestId,
    contentKind: 'skill',
    definition: {
      ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
      ability: correctedAbility,
    },
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    corrections: ['Damage power: 21 → 20.'],
    record: {
      draft: {
        definition: {
          ability: { behaviors: [{ effects: [{ id: 'hit', payload: { amount: 20 } }] }] },
        },
      },
    },
  })
})
it('does not persist a guessed replacement for an unsupported effect', async () => {
  const ability = structuredClone(
    defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability,
  )
  const invalidAbility = {
    ...ability,
    behaviors: [
      {
        ...ability.behaviors[0],
        effects: [{ id: 'intent', payload: { type: 'invented', recipient: 'actor' } }],
      },
    ],
  }
  const response = await call({
    action: 'create',
    requestId,
    contentKind: 'skill',
    definition: {
      ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
      ability: invalidAbility,
    },
  })
  expect(response.status).toBe(400)
  expect(rpc.mock.calls.some(([name]) => name === 'write_combat_content_record_v1')).toBe(false)
})
it('rejects malformed recognized tags with a useful client error before any write', async () => {
  const ability = structuredClone(
    defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability,
  )
  const invalidAbility = {
    ...ability,
    behaviors: [
      {
        ...ability.behaviors[0],
        effects: [
          {
            id: 'fire',
            payload: { type: 'damage', recipient: 'primary-unit', amount: 10, element: 'fire' },
          },
          { id: 'cleanse', payload: { type: 'remove-status', recipient: 'actor' } },
        ],
      },
    ],
  }
  const response = await call({
    action: 'create',
    requestId,
    contentKind: 'skill',
    definition: {
      ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
      ability: invalidAbility,
    },
  })
  expect(response.status).toBe(400)
  expect(rpc.mock.calls.some(([name]) => name === 'write_combat_content_record_v1')).toBe(false)
})
it('commits the authored effect note alongside an added required companion', async () => {
  const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability
  const ability = {
    ...base,
    behaviors: [
      {
        ...base.behaviors[0]!,
        effects: [
          {
            id: 'hit',
            payload: { type: 'damage', recipient: 'primary-unit', amount: 10, element: 'storm' },
          },
        ],
      },
    ],
  }
  const response = await call({
    action: 'create',
    requestId,
    contentKind: 'skill',
    definition: {
      ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
      effectDescriptions: ['Authored note'],
      ability,
    },
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    corrections: ['Added required Conductive for the selected damage element.'],
    record: { draft: { definition: { effectDescriptions: ['Authored note', null] } } },
  })
})
