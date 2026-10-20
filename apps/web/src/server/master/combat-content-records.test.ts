import { expect, it, vi } from 'vitest'
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
