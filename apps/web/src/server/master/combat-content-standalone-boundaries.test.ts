import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { RpcCombatContentAuthoringStore } from './supabase-combat-content-authoring-store'
import { parseCompleteCombatContentRecord } from './combat-content-record'
import { resolveCombatContentCatalogueSnapshot } from '../combat/combat-content-resolver'
import type { CombatContentKind } from '@aurevane/db/combat-content'

const token = 'a'.repeat(32)
const stamp = '2026-10-20T00:00:00Z'
const opaque = { id: 'owner.profile', contentVersion: 4, values: [4], retained: { old: true } }
function complete(kind: CombatContentKind, definition: Record<string, unknown>) {
  return {
    contentKey: definition.id as string,
    contentKind: kind,
    lifecycle: 'active',
    revision: 2,
    versionFloor: 4,
    createdBy: null,
    createdAt: null,
    draft: {
      definition,
      draftVersion: 2,
      baseVersion: null,
      updatedBy: 'owner',
      updatedAt: stamp,
      restoredFrom: null,
      restoredBy: null,
    },
    current: null,
    history: [],
    usedBy: [],
    links: [],
  }
}
function published(kind: CombatContentKind, definition: Record<string, unknown>) {
  return {
    id: 'version',
    contentKey: definition.id as string,
    contentKind: kind,
    contentVersion: Number(definition.contentVersion ?? 1),
    definition,
    publishedBy: 'owner',
    publishedAt: stamp,
  }
}
function snapshot(publications: ReturnType<typeof published>[]) {
  return { token, policy: { version: 1, modes: {} }, publications }
}
it.each(PHASE4_STATUSES.map((status) => [status.id, status] as const))(
  'retains actual Status %s including current optional modules without normalization',
  (_id, status) => {
    const definition = { ...structuredClone(status), contentVersion: 4 }
    const input = complete('status', definition)
    const before = JSON.stringify(input)
    expect(parseCompleteCombatContentRecord(input).draft?.definition).toEqual(definition)
    const catalogue = resolveCombatContentCatalogueSnapshot(
      snapshot([published('status', definition)]),
    )
    expect(catalogue.entries.find((e) => e.contentKey === status.id)?.definition).toEqual(
      definition,
    )
    expect(JSON.stringify(input)).toBe(before)
  },
)
it.each([
  { id: 'bad.status', arbitrary: { execute: 'unsupported' } },
  { ...PHASE4_STATUSES[0], movement: { blocked: true, arbitrary: 1 } },
  { ...PHASE4_STATUSES[0], endOfTurn: { type: 'damage', amount: 3, arbitrary: 1 } },
  { ...PHASE4_STATUSES[0], maximumStacks: 0 },
])('returned and prospective Status boundaries reject malformed definitions', (definition) => {
  expect(() => parseCompleteCombatContentRecord(complete('status', definition))).toThrow()
  expect(() =>
    resolveCombatContentCatalogueSnapshot(snapshot([published('status', definition)])),
  ).toThrow()
})
it('saved malformed Status publication fails before the publish RPC', async () => {
  const value = complete('status', { id: 'bad.status', arbitrary: { execute: 'unsupported' } })
  const rpc = vi.fn(async (name: string) => ({
    data: name === 'read_combat_content_catalogue_v1' ? { ...snapshot([]) } : value,
    error: null,
  }))
  await expect(
    new RpcCombatContentAuthoringStore(rpc, 'owner').publishSaved(value, 2, null),
  ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  expect(rpc.mock.calls.some(([name]) => name === 'publish_saved_combat_content_v1')).toBe(false)
})
it('retained opaque Effect Profile is explicitly read-only and cannot be republished', async () => {
  const value = complete('effect-profile', opaque)
  const before = JSON.stringify(value)
  const rpc = vi.fn(async (name: string) => ({
    data: name === 'read_combat_content_catalogue_v1' ? snapshot([]) : value,
    error: null,
  }))
  const store = new RpcCombatContentAuthoringStore(rpc, 'owner')
  expect(await store.readRecord(opaque.id)).toMatchObject({
    authoringBlocker: { code: 'EFFECT_PROFILE_AUTHORING_UNSUPPORTED' },
    draft: { definition: opaque },
  })
  await expect(store.publishSaved(value, 2, null)).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
    message: expect.stringMatching(/Effect Profile.*unsupported/i),
  })
  expect(rpc.mock.calls.some(([name]) => name === 'publish_saved_combat_content_v1')).toBe(false)
  expect(JSON.stringify(value)).toBe(before)
})
it('retained Effect Profile catalogue entry has no runtime authority and exact history stays byte-equivalent', async () => {
  const original = published('effect-profile', opaque)
  const entry = resolveCombatContentCatalogueSnapshot(snapshot([original])).entries.find(
    (e) => e.contentKey === opaque.id,
  )
  expect(entry).toMatchObject({
    category: 'effect-profile',
    runtimeSupported: false,
    authoringBlocker: { code: 'EFFECT_PROFILE_AUTHORING_UNSUPPORTED' },
    definition: opaque,
  })
  const rpc = vi.fn(async () => ({
    data: [
      {
        id: 'version',
        content_key: opaque.id,
        content_kind: 'effect-profile',
        content_version: 4,
        definition: opaque,
        published_by: 'owner',
        published_at: stamp,
      },
    ],
    error: null,
  }))
  const history = await new RpcCombatContentAuthoringStore(rpc, 'owner').listPublishedVersions(
    opaque.id,
  )
  expect(JSON.stringify(history[0]?.definition)).toBe(JSON.stringify(opaque))
})
it('malformed retained Effect Profile identity fails closed without inventing a profile schema', () => {
  const row = { ...published('effect-profile', opaque), contentKey: 'another.profile' }
  expect(() => resolveCombatContentCatalogueSnapshot(snapshot([row]))).toThrow()
})
it('an unrelated saved Skill still publishes with an opaque retained Effect Profile in the current snapshot', async () => {
  const skill = resolveMatureSkillVersion('vanguard.forceful-strike')!
  const value = complete('skill', { ...skill })
  const profile = published('effect-profile', opaque)
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === 'read_combat_content_catalogue_v1'
        ? {
            token,
            policy: { version: 1, modes: {} },
            publications: [
              {
                id: profile.id,
                content_key: profile.contentKey,
                content_kind: profile.contentKind,
                content_version: profile.contentVersion,
                definition: profile.definition,
                published_by: 'owner',
                published_at: stamp,
              },
            ],
          }
        : value,
    error: null,
  }))
  await new RpcCombatContentAuthoringStore(rpc, 'owner').publishSaved(value, 2, null)
  expect(rpc.mock.calls.some(([name]) => name === 'publish_saved_combat_content_v1')).toBe(true)
  expect(profile.definition).toEqual(opaque)
})
it.each(['save', 'duplicate', 'restore'] as const)(
  'blocks unsupported Effect Profile %s before the write RPC',
  async (action) => {
    const value = complete('effect-profile', opaque)
    const rpc = vi.fn(async (name: string) => {
      if (name !== 'read_combat_content_record_v1') throw new Error(`Unexpected RPC ${name}`)
      return { data: value, error: null }
    })
    const store = new RpcCombatContentAuthoringStore(rpc, 'owner')
    const command =
      action === 'save'
        ? { action, expectedRevision: 2, definition: opaque }
        : action === 'restore'
          ? { action, expectedRevision: 2, sourceVersion: 4 }
          : {
              action,
              requestId: '00000000-0000-4000-8000-000000000099',
              sourceKey: opaque.id,
              expectedSourceRevision: 2,
            }
    await expect(store.writeRecord(opaque.id, command)).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      message: expect.stringMatching(/Effect Profile.*unsupported/i),
    })
    expect(rpc.mock.calls.some(([name]) => name === 'write_combat_content_record_v1')).toBe(false)
  },
)
it('valid saved Status publication uses the existing definition and saved-revision RPC without stamping runtime version', async () => {
  const definition = {
    ...PHASE4_STATUSES.find((status) => status.id === 'mark')!,
    contentVersion: 4,
  }
  const value = complete('status', definition)
  const before = JSON.stringify(value)
  const rpc = vi.fn(async (name: string) => ({
    data: name === 'read_combat_content_catalogue_v1' ? snapshot([]) : value,
    error: null,
  }))
  await new RpcCombatContentAuthoringStore(rpc, 'owner').publishSaved(value, 2, null)
  expect(rpc).toHaveBeenCalledWith(
    'publish_saved_combat_content_v1',
    expect.objectContaining({
      p_content_key: definition.id,
      p_expected_draft_version: 2,
      p_expected_base_version: null,
      p_version_floor: 4,
    }),
  )
  expect(JSON.stringify(value)).toBe(before)
  expect(definition.version).toBe(1)
})
it.each(['absorbHpBasisPoints', 'absorbMpBasisPoints', 'reflectBasisPoints'] as const)(
  'retains actual supported reactive Status module %s and rejects its invalid semantics',
  (field) => {
    const definition = {
      id: 'owner.reactive',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 2,
      damageTakenMultiplierBasisPoints: 10000,
      polarity: 'positive',
      reactionClass: 'reactive',
      [field]: 2500,
    }
    expect(
      parseCompleteCombatContentRecord(complete('status', definition)).draft?.definition,
    ).toEqual(definition)
    expect(() =>
      parseCompleteCombatContentRecord(complete('status', { ...definition, polarity: 'negative' })),
    ).toThrow()
  },
)
it('the unchanged exact history reader preserves a retired Status identity and definition', async () => {
  const definition = {
    ...PHASE4_STATUSES[0],
    id: 'regeneration',
    version: 1,
    contentVersion: 1,
    endOfTurn: { type: 'healing', amount: 3 },
  }
  const rpc = vi.fn(async () => ({
    data: [
      {
        id: 'old-version',
        content_key: definition.id,
        content_kind: 'status',
        content_version: 1,
        definition,
        published_by: 'owner',
        published_at: stamp,
      },
    ],
    error: null,
  }))
  const history = await new RpcCombatContentAuthoringStore(rpc, 'owner').listPublishedVersions(
    definition.id,
  )
  expect(JSON.stringify(history[0]?.definition)).toBe(JSON.stringify(definition))
})
