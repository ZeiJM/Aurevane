import { beforeEach, expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { RpcCombatContentAuthoringStore } from './supabase-combat-content-authoring-store'
vi.mock('server-only', () => ({}))
const owner = '00000000-0000-4000-8000-000000000001'
const definition = {
  ...defaultBasicSkills().find((s) => s.id === 'basic.guard')!,
  name: 'Owner Guard',
}
const existing = {
  contentKey: 'basic.guard',
  contentKind: 'skill',
  lifecycle: 'active',
  revision: 7,
  versionFloor: 1,
  createdBy: null,
  createdAt: null,
  builtin: null,
  current: null,
  draft: null,
  history: [],
  links: [],
  usedBy: [],
}
const published = {
  ...existing,
  revision: 9,
  versionFloor: 2,
  current: {
    contentVersion: 2,
    definition: { ...definition, contentVersion: 2 },
    publishedBy: owner,
    publishedAt: '2026-10-26T06:00:00Z',
    authoredBy: owner,
    authoredAt: '2026-10-26T06:00:00Z',
    restoredFrom: null,
    restoredBy: null,
  },
}
const rpc = vi.fn()
beforeEach(() => {
  rpc.mockReset().mockImplementation(async (name: string) => {
    if (name === 'read_combat_content_record_v1') return { data: existing, error: null }
    if (name === 'read_combat_content_catalogue_v1')
      return {
        data: { token: 'a'.repeat(32), policy: { version: 3, modes: {} }, publications: [] },
        error: null,
      }
    if (name === 'commit_combat_content_record_v1') return { data: published, error: null }
    throw new Error(`Unexpected RPC ${name}`)
  })
})
it('commits unsaved complete edits through one atomic mutation and returns the actual publication', async () => {
  const store = new RpcCombatContentAuthoringStore(rpc, owner)
  const result = await store.commitRecord('basic.guard', 7, definition)
  expect(result.current?.definition.name).toBe('Owner Guard')
  expect(result.draft).toBeNull()
  expect(rpc).toHaveBeenCalledWith(
    'commit_combat_content_record_v1',
    expect.objectContaining({
      p_actor_user_id: owner,
      p_content_key: 'basic.guard',
      p_expected_revision: 7,
      p_definition: definition,
      p_expected_catalogue_token: 'a'.repeat(32),
    }),
  )
  expect(
    rpc.mock.calls.filter(
      ([name]) =>
        name === 'write_combat_content_record_v1' || name === 'publish_saved_combat_content_v1',
    ),
  ).toHaveLength(0)
})
it('rejects a stale editor before submitting any mutation', async () => {
  const store = new RpcCombatContentAuthoringStore(rpc, owner)
  await expect(store.commitRecord('basic.guard', 6, definition)).rejects.toMatchObject({
    code: 'STALE_VERSION',
  })
  expect(rpc.mock.calls.some(([name]) => name === 'commit_combat_content_record_v1')).toBe(false)
})
it('does not report success when the returned state is still a draft', async () => {
  rpc.mockImplementation(async (name: string) => {
    if (name === 'read_combat_content_record_v1' || name === 'commit_combat_content_record_v1')
      return { data: existing, error: null }
    return {
      data: { token: 'a'.repeat(32), policy: { version: 3, modes: {} }, publications: [] },
      error: null,
    }
  })
  const store = new RpcCombatContentAuthoringStore(rpc, owner)
  await expect(store.commitRecord('basic.guard', 7, definition)).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})

it('does not create another publication when current authored settings are unchanged', async () => {
  rpc.mockImplementation(async (name: string) => {
    if (name === 'read_combat_content_record_v1') return { data: published, error: null }
    throw new Error(`Unexpected redundant mutation ${name}`)
  })
  const store = new RpcCombatContentAuthoringStore(rpc, owner)
  const result = await store.commitRecord('basic.guard', 9, definition)
  expect(result.revision).toBe(9)
  expect(result.current?.contentVersion).toBe(2)
  expect(rpc).toHaveBeenCalledTimes(1)
})
