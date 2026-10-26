import { beforeEach, expect, it, vi } from 'vitest'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: async () => ({ userId: 'owner' }) }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: async () => ({ id: 'selected' }),
}))
import { handleCombatContentAuthoringRequest } from './combat-content-authoring-handler'
import { createServerCombatContentAuthoringService } from './combat-content-authoring-server'
import { RpcCombatContentAuthoringStore } from './supabase-combat-content-authoring-store'
import {
  RpcPublishedCombatContentSource,
  resolveCombatContentCatalogueSnapshot,
} from '../combat/combat-content-resolver'

type MutableRecord = {
  -readonly [K in keyof CompleteCombatContentRecord]: CompleteCombatContentRecord[K]
}
const stamp = '2026-10-20T00:00:00Z'
const key = 'owner.status'
const status = (version: number) => ({ ...PHASE4_STATUSES[0]!, id: key, contentVersion: version })
function record(
  kind: CompleteCombatContentRecord['contentKind'],
  contentKey: string,
  definition: Record<string, unknown>,
): MutableRecord {
  return {
    contentKey,
    contentKind: kind,
    lifecycle: 'active',
    revision: 8,
    versionFloor: 4,
    createdBy: 'owner',
    createdAt: stamp,
    draft: {
      definition,
      draftVersion: 2,
      baseVersion: 4,
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
function raw(
  contentKind: string,
  contentKey: string,
  contentVersion: number,
  definition: Record<string, unknown>,
) {
  return {
    id: `${contentKey}.${contentVersion}`,
    content_key: contentKey,
    content_kind: contentKind,
    content_version: contentVersion,
    definition,
    published_by: 'owner',
    published_at: stamp,
  }
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
})
it.each([
  { values: [4], contentVersion: 1 },
  { id: 'unrelated.incidental.body.field', contentVersion: -99, values: [4] },
  {},
])(
  'retains predecessor-compatible opaque profile bytes using only the stored envelope: %j',
  async (definition) => {
    const profileKey = 'owner.profile'
    const profile = raw('effect-profile', profileKey, 4, definition)
    const skill = resolveMatureSkillVersion('vanguard.forceful-strike')!
    const saved = record('skill', skill.id, { ...skill })
    const retained = record('effect-profile', profileKey, definition)
    const before = JSON.stringify(profile)
    const localRpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === 'read_combat_content_catalogue_v1')
        return {
          data: {
            token: 'a'.repeat(32),
            policy: { version: 1, modes: {} },
            publications: [profile],
          },
          error: null,
        }
      if (name === 'read_combat_content_record_v1')
        return { data: args.p_content_key === profileKey ? retained : saved, error: null }
      if (name === 'list_combat_content_versions_v1') return { data: [profile], error: null }
      if (name === 'publish_saved_combat_content_v1') return { data: saved, error: null }
      throw new Error(`Unexpected RPC ${name}`)
    })
    const snapshot = await new RpcPublishedCombatContentSource(localRpc).readCatalogueSnapshot()
    expect(JSON.stringify(snapshot.publications[0]?.definition)).toBe(JSON.stringify(definition))
    const entry = resolveCombatContentCatalogueSnapshot(snapshot).entries.find(
      (e) => e.contentKey === profileKey,
    )
    expect(entry).toMatchObject({
      contentKey: profileKey,
      contentVersion: 4,
      runtimeSupported: false,
      authoringBlocker: { code: 'EFFECT_PROFILE_AUTHORING_UNSUPPORTED' },
    })
    expect(JSON.stringify(entry?.definition)).toBe(JSON.stringify(definition))
    const store = new RpcCombatContentAuthoringStore(localRpc, 'owner')
    expect(await store.readRecord(profileKey)).toMatchObject({
      authoringBlocker: { code: 'EFFECT_PROFILE_AUTHORING_UNSUPPORTED' },
      draft: { definition },
    })
    expect(JSON.stringify((await store.listPublishedVersions(profileKey))[0]?.definition)).toBe(
      JSON.stringify(definition),
    )
    await expect(
      store.writeRecord(profileKey, { action: 'restore', expectedRevision: 8, sourceVersion: 4 }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    await expect(store.publishSaved(retained, 2, 4)).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
    await store.publishSaved(saved, 2, 4)
    expect(
      localRpc.mock.calls.filter(([name]) => name === 'publish_saved_combat_content_v1'),
    ).toHaveLength(1)
    expect(localRpc.mock.calls.some(([name]) => name === 'write_combat_content_record_v1')).toBe(
      false,
    )
    expect(JSON.stringify(profile)).toBe(before)
  },
)
// Model the SQL mutation/returned-state boundary; this is not a native database schedule.
function statusFixture(oldSupported: boolean, concurrentEdit = false) {
  const versions = [1, 2, 3, 4].map((version) =>
    raw('status', key, version, {
      ...status(version),
      ...(version === 1 && !oldSupported ? { maximumStacks: 0 } : {}),
    }),
  )
  const state = record('status', key, status(4))
  state.history = [4, 3, 2].map((version) => ({
    contentVersion: version,
    definition: status(version),
    publishedBy: 'owner',
    publishedAt: stamp,
    authoredBy: 'owner',
    authoredAt: stamp,
    restoredFrom: null,
    restoredBy: null,
  }))
  state.current = state.history[0]!
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'read_master_panel_operator_v1')
      return { data: [{ user_id: 'owner', enabled: true, role: 'owner' }], error: null }
    if (name === 'read_combat_content_record_v1')
      return { data: structuredClone(state), error: null }
    if (name === 'list_combat_content_versions_v1')
      return { data: structuredClone(versions), error: null }
    if (name === 'read_combat_content_version_v1') {
      if (concurrentEdit) state.revision += 1
      return {
        data: structuredClone(versions.filter((v) => v.content_version === args.p_content_version)),
        error: null,
      }
    }
    if (name === 'write_combat_content_record_v1') {
      const command = args.p_command as {
        action: string
        expectedRevision: number
        sourceVersion: number
        definition: Record<string, unknown>
      }
      if (command.expectedRevision !== state.revision)
        return { data: null, error: { code: '40001', message: 'COMBAT_CONTENT_RECORD_CONFLICT' } }
      const source = versions.find((v) => v.content_version === command.sourceVersion)
      state.revision += 1
      state.draft = {
        ...state.draft!,
        definition: structuredClone(
          command.action === 'restore' ? source!.definition : command.definition,
        ),
        draftVersion: state.draft!.draftVersion + 1,
        restoredFrom: command.action === 'restore' ? command.sourceVersion : null,
        restoredBy: command.action === 'restore' ? 'owner' : null,
      }
      return { data: structuredClone(state), error: null }
    }
    throw new Error(`Unexpected RPC ${name}`)
  })
  return { state, versions }
}
it('rejects unsupported exact Status history outside the three visible entries before mutation, then accepts a valid edit', async () => {
  const { state, versions } = statusFixture(false)
  const before = JSON.stringify(state)
  const historyBefore = JSON.stringify(versions)
  const response = await call({
    action: 'restore',
    contentKey: key,
    expectedRevision: 8,
    sourceVersion: 1,
  })
  expect(response.status).toBe(400)
  expect(await response.text()).toMatch(/historical Status.*unsupported.*restor/i)
  expect(rpc.mock.calls.some(([name]) => name === 'write_combat_content_record_v1')).toBe(false)
  expect(JSON.stringify(state)).toBe(before)
  expect(JSON.stringify(versions)).toBe(historyBefore)
  const old = (await new RpcCombatContentAuthoringStore(rpc, 'owner').listPublishedVersions(key))[0]
  expect(old?.definition.maximumStacks).toBe(0)
  const saved = await call({
    action: 'save',
    contentKey: key,
    expectedRevision: 8,
    definition: { ...status(4), name: 'Repaired later' },
  })
  expect(saved.status).toBe(200)
  expect(state.draft?.definition.name).toBe('Repaired later')
  expect(JSON.stringify(versions)).toBe(historyBefore)
})
it('validates a supported exact older Status before restoring with the original CAS and selected actor', async () => {
  const { state, versions } = statusFixture(true)
  const before = JSON.stringify({ current: state.current, history: versions })
  const response = await call({
    action: 'restore',
    contentKey: key,
    expectedRevision: 8,
    sourceVersion: 1,
  })
  expect(response.status).toBe(200)
  expect(rpc).toHaveBeenCalledWith('read_combat_content_version_v1', {
    p_content_key: key,
    p_content_kind: 'status',
    p_content_version: 1,
  })
  expect(
    rpc.mock.calls.findIndex(([name]) => name === 'read_combat_content_version_v1'),
  ).toBeLessThan(rpc.mock.calls.findIndex(([name]) => name === 'write_combat_content_record_v1'))
  expect(rpc).toHaveBeenCalledWith(
    'write_combat_content_record_v1',
    expect.objectContaining({
      p_actor_character_id: 'selected',
      p_command: { action: 'restore', expectedRevision: 8, sourceVersion: 1 },
    }),
  )
  expect(state.draft?.definition).toEqual(status(1))
  expect(state.draft?.restoredFrom).toBe(1)
  expect(JSON.stringify({ current: state.current, history: versions })).toBe(before)
})
it('keeps the original CAS when a concurrent edit follows the exact Status precheck', async () => {
  const { state } = statusFixture(true, true)
  const before = JSON.stringify(state.draft)
  const response = await call({
    action: 'restore',
    contentKey: key,
    expectedRevision: 8,
    sourceVersion: 1,
  })
  expect(response.status).toBe(409)
  expect(state.revision).toBe(9)
  expect(JSON.stringify(state.draft)).toBe(before)
})

it.each([
  { label: 'missing version', rows: [], status: 400 },
  { label: 'wrong key', rows: [raw('status', 'another.status', 1, status(1))], status: 503 },
  { label: 'wrong kind', rows: [raw('effect-profile', key, 1, status(1))], status: 503 },
  { label: 'wrong version', rows: [raw('status', key, 2, status(1))], status: 503 },
  {
    label: 'unsupported body identity',
    rows: [raw('status', key, 1, { ...status(1), id: 'another.status' })],
    status: 400,
  },
  {
    label: 'unsupported body publication version',
    rows: [raw('status', key, 1, status(2))],
    status: 400,
  },
])(
  'rejects $label from the exact Status read without mutating the record',
  async ({ rows, status: expectedStatus }) => {
    const { state, versions } = statusFixture(true)
    const before = JSON.stringify({ state, versions })
    const original = rpc.getMockImplementation()!
    rpc.mockImplementation(async (name: string, args: Record<string, unknown>) =>
      name === 'read_combat_content_version_v1'
        ? { data: rows, error: null }
        : original(name, args),
    )
    const response = await call({
      action: 'restore',
      contentKey: key,
      expectedRevision: 8,
      sourceVersion: 1,
    })
    expect(response.status).toBe(expectedStatus)
    expect(rpc.mock.calls.some(([name]) => name === 'write_combat_content_record_v1')).toBe(false)
    expect(JSON.stringify({ state, versions })).toBe(before)
  },
)
