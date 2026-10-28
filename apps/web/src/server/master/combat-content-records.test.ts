import { expect, it, vi } from 'vitest'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
import { DISCIPLINE_ATLAS_BY_ID } from '@aurevane/game-core/character/discipline-atlas'
vi.mock('server-only', () => ({}))
import { RpcCombatContentAuthoringStore } from './supabase-combat-content-authoring-store'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
const skill = resolveMatureSkillVersion('vanguard.forceful-strike')!
const record = {
  contentKey: skill.id,
  contentKind: 'skill' as const,
  lifecycle: 'active' as const,
  revision: 2,
  versionFloor: skill.contentVersion,
  createdBy: null,
  createdAt: null,
  draft: {
    definition: skill,
    draftVersion: 4,
    baseVersion: null,
    updatedBy: 'author',
    updatedAt: '2026-10-20T00:00:00Z',
    restoredFrom: null,
    restoredBy: null,
  },
  current: null,
  history: [],
  usedBy: [],
  links: [],
}
it('an old saved draft cannot publish a hidden nonzero Skill accuracy modifier', async () => {
  const legacy = {
    ...record,
    draft: {
      ...record.draft,
      definition: { ...skill, accuracyMode: 'per-target', accuracyModifierBasisPoints: 700 },
    },
  }
  const rpc = vi.fn(async () => ({ data: legacy, error: null }))
  const store = new RpcCombatContentAuthoringStore(rpc, 'owner')
  await expect(store.publishSaved(legacy, 4, null)).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
    message: expect.stringMatching(/accuracy modifier/i),
  })
  expect(rpc.mock.calls).toHaveLength(1)
  expect(legacy.draft.definition.accuracyModifierBasisPoints).toBe(700)
})
it('publish complete record sends only reviewed saved revision and trusted floor, never caller body', async () => {
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === 'read_combat_content_catalogue_v1'
        ? {
            token: 'a'.repeat(32),
            policy: { version: 1, modes: {} },
            publications: [],
            archivedKeys: [],
          }
        : record,
    error: null,
  }))
  const store = new RpcCombatContentAuthoringStore(rpc, 'owner')
  expect(store).toHaveProperty('publishSaved')
  await store.publishSaved(record, 4, null)
  const args = rpc.mock.calls.find(([name]) => name === 'publish_saved_combat_content_v1')
  expect(args).toBeDefined()
  expect(rpc).toHaveBeenCalledWith(
    'publish_saved_combat_content_v1',
    expect.objectContaining({
      p_actor_user_id: 'owner',
      p_content_key: skill.id,
      p_expected_draft_version: 4,
      p_expected_base_version: null,
      p_expected_catalogue_token: 'a'.repeat(32),
      p_version_floor: skill.contentVersion,
    }),
  )
  expect(JSON.stringify(args)).not.toContain('p_definition')
})
it('future draft save round-trips its finite complete record and publication has a specific blocker', async () => {
  const future = {
    schemaVersion: 1,
    id: 'item.test',
    contentVersion: 1,
    name: 'Field kit',
    description: 'A field kit intent.',
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
  const futureRecord = {
    ...record,
    contentKey: 'item.test',
    contentKind: 'item' as const,
    lifecycle: 'draft' as const,
    draft: { ...record.draft, definition: future },
  }
  const rpc = vi.fn(async () => ({ data: futureRecord, error: null }))
  const store = new RpcCombatContentAuthoringStore(rpc, 'owner')
  expect(store).toHaveProperty('writeRecord')
  expect(
    await store.writeRecord('item.test', {
      action: 'save',
      expectedRevision: 2,
      definition: future,
    }),
  ).toEqual(futureRecord)
  await expect(store.publishSaved(futureRecord, 4, null)).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
  })
  expect(rpc).not.toHaveBeenCalledWith('publish_saved_combat_content_v1', expect.anything())
})
it('malformed returned record and future definition fail closed', async () => {
  const store = new RpcCombatContentAuthoringStore(
    async () => ({ data: { ...record, lifecycle: 'unknown' }, error: null }),
    'owner',
  )
  expect(store).toHaveProperty('readRecord')
  await expect(store.readRecord(skill.id)).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})
it('builtin identity resolves its exact existing definition for first edit but a tombstone never does', async () => {
  const builtinRecord = {
    ...record,
    draft: null,
    builtin: { contentVersion: skill.contentVersion, name: 'Forceful Strike' },
  }
  const rpc = vi.fn(async (): Promise<{ data: unknown; error: null }> => ({
    data: builtinRecord,
    error: null,
  }))
  const store = new RpcCombatContentAuthoringStore(rpc, 'owner')
  expect(await store.readRecord(skill.id)).toMatchObject({ builtinDefinition: skill })
  rpc.mockResolvedValueOnce({
    data: { ...builtinRecord, lifecycle: 'archived' as const },
    error: null,
  })
  expect(await store.readRecord(skill.id)).not.toHaveProperty('builtinDefinition')
})
it.each([
  ['40001', 'COMBAT_CONTENT_IDENTITY_CONFLICT', 'STALE_VERSION', /Content changed/],
  [
    '22023',
    'COMBAT_CONTENT_BUILTIN_SELECTION_DEPENDENCY',
    'INVALID_REQUEST',
    /selected by an existing Discipline/,
  ],
  ['22023', 'COMBAT_CONTENT_DEPENDENCIES', 'INVALID_REQUEST', /Used by/],
  ['0A000', 'COMBAT_CONTENT_COMPLETE_RECORD_REQUIRED', 'INVALID_REQUEST', /saved-record workflow/],
] as const)(
  'maps %s %s to actionable content errors',
  async (code, message, expectedCode, expectedMessage) => {
    const store = new RpcCombatContentAuthoringStore(
      async () => ({ data: null, error: { code, message } }),
      'owner',
    )
    await expect(
      store.writeRecord('content.test', { action: 'archive', expectedRevision: 1 }),
    ).rejects.toMatchObject({ code: expectedCode, message: expect.stringMatching(expectedMessage) })
  },
)

it('bounded lists reject unknown stored kinds instead of passing them to category consumers', async () => {
  const rpc = vi.fn(async () => ({
    data: {
      records: [
        { contentKey: 'unknown.test', contentKind: 'unknown', lifecycle: 'draft', revision: 1 },
      ],
      nextCursor: null,
    },
    error: null,
  }))
  const store = new RpcCombatContentAuthoringStore(rpc, 'owner')
  await expect(store.listRecords({ limit: 10 })).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})

it('builtin Discipline first edit enriches the actual producer metadata with retained Atlas presentation', async () => {
  const native = {
    schemaVersion: 1,
    id: 'vanguard',
    contentVersion: 1,
    name: 'Vanguard',
    description: 'Armed tradition.',
    sortOrder: 0,
    enabled: true,
    media: {},
    core: { might: 7, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
    focus: ['might', 'vitality', 'resolve'],
    enabledForPrimary: true,
    enabledForSecondary: true,
    linkedSkills: ['vanguard.forceful-strike'],
    skillStages: [{ skillId: 'vanguard.forceful-strike', minimumStage: 1 }],
    unlock: { kind: 'always' },
    essenceId: 'essence.vanguard',
    resonanceSelections: [],
  }
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === 'get_builtin_discipline_definition_v1'
        ? native
        : {
            ...record,
            contentKey: 'vanguard',
            contentKind: 'discipline',
            draft: null,
            builtin: { contentVersion: 1, name: 'Vanguard' },
          },
    error: null,
  }))
  const store = new RpcCombatContentAuthoringStore(rpc, 'owner')
  const current = await store.readRecord('vanguard')
  expect(current).toMatchObject({
    builtinDefinition: {
      ...native,
      atlas: { family: 'foundation', band: 'foundation', disclosure: 'open' },
    },
  })
  const { family, band, disclosure, power } = DISCIPLINE_ATLAS_BY_ID.vanguard!
  expect(current?.builtinDefinition?.atlas).toEqual({ family, band, disclosure, power })
})

it('publishes complete ordinary and grant-only Disciplines while retaining required Atlas and producer metadata validation', async () => {
  const definition = {
    schemaVersion: 1,
    id: 'discipline.ready',
    contentVersion: 1,
    name: 'Ready',
    description: 'Ready Discipline.',
    sortOrder: 0,
    enabled: true,
    media: {},
    core: { might: 7, finesse: 5, vitality: 5, agility: 5, intellect: 5, resolve: 4 },
    focus: ['might', 'intellect'],
    enabledForPrimary: true,
    enabledForSecondary: true,
    linkedSkills: [],
    skillStages: [],
    unlock: { kind: 'always' },
    essenceId: null,
    resonanceSelections: [],
    atlas: {
      family: 'mage',
      band: 'first-journey',
      disclosure: 'open',
      power: { reliability: 1, flexibility: 2, setup: 3, ruleAccess: 4, execution: 5 },
    },
  }
  let saved: CompleteCombatContentRecord = {
    ...record,
    contentKey: definition.id,
    contentKind: 'discipline' as const,
    draft: { ...record.draft, definition },
  }
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === 'read_combat_content_catalogue_v1'
        ? {
            token: 'a'.repeat(32),
            policy: { version: 1, modes: {} },
            publications: [],
            archivedKeys: [],
          }
        : saved,
    error: null,
  }))
  const store = new RpcCombatContentAuthoringStore(rpc, 'owner')
  await store.publishSaved(saved, 4, null)
  expect(rpc).toHaveBeenCalledWith(
    'publish_saved_combat_content_v1',
    expect.objectContaining({ p_content_key: definition.id, p_expected_draft_version: 4 }),
  )
  rpc.mockClear()
  saved = {
    ...saved,
    draft: { ...saved.draft!, definition: { ...definition, unlock: { kind: 'unavailable' } } },
  }
  expect(await store.publishSaved(saved, 4, null)).toMatchObject({
    draft: { definition: { unlock: { kind: 'unavailable' }, atlas: definition.atlas } },
  })
  expect(rpc).toHaveBeenCalledWith(
    'publish_saved_combat_content_v1',
    expect.objectContaining({
      p_content_key: definition.id,
      p_expected_draft_version: 4,
      p_expected_base_version: null,
    }),
  )
  const stageA: Record<string, unknown> = { ...definition, unlock: { kind: 'unavailable' } }
  for (const field of ['atlas', 'skillStages', 'essenceId', 'resonanceSelections'])
    delete stageA[field]
  saved = { ...saved, draft: { ...saved.draft!, definition: stageA } }
  rpc.mockClear()
  await expect(store.publishSaved(saved, 4, null)).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
    message: expect.stringMatching(/complete.*Atlas/i),
  })
  expect(rpc).not.toHaveBeenCalledWith('publish_saved_combat_content_v1', expect.anything())
  for (const invalid of [
    {
      ...definition,
      atlas: { ...definition.atlas, power: { ...definition.atlas.power, reliability: 0 } },
    },
    { ...definition, atlas: { ...definition.atlas, band: 'unimplemented' } },
    { ...definition, skillStages: [{ skillId: 'missing.skill', minimumStage: 1 }] },
  ]) {
    saved = { ...saved, draft: { ...saved.draft!, definition: invalid } }
    rpc.mockClear()
    await expect(store.publishSaved(saved, 4, null)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
    expect(rpc).not.toHaveBeenCalledWith('publish_saved_combat_content_v1', expect.anything())
  }
})

it('restores the exact system Basic baseline without accepting a caller definition or inventing history', async () => {
  const { defaultBasicSkills } = await import('@aurevane/game-core/combat/combat-basic-actions')
  for (const original of defaultBasicSkills()) {
    const source = {
      ...record,
      contentKey: original.id,
      builtin: { contentVersion: 1, name: original.name },
      current: {
        contentVersion: 3,
        definition: { ...original, contentVersion: 3, name: 'Edited' },
        publishedBy: 'publisher',
        publishedAt: '2026-10-25T00:00:00Z',
        authoredBy: 'author',
        authoredAt: '2026-10-25T00:00:00Z',
        restoredFrom: null,
        restoredBy: null,
      },
      draft: null,
    }
    const rpc = vi.fn(async () => ({ data: source, error: null }))
    const store = new RpcCombatContentAuthoringStore(rpc, 'owner')
    await store.writeRecord(original.id, {
      action: 'restore',
      expectedRevision: 2,
      sourceVersion: 1,
      sourceKind: 'builtin',
    })
    expect(rpc).toHaveBeenCalledWith(
      'write_combat_content_record_v1',
      expect.objectContaining({
        p_command: {
          action: 'restore',
          expectedRevision: 2,
          sourceVersion: 1,
          sourceKind: 'builtin',
          sourceDefinition: original,
        },
      }),
    )
    expect((await store.readRecord(original.id))?.builtinRestoreVersion).toBe(1)
  }
})
