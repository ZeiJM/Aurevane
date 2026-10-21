import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const state = vi.hoisted(() => ({ characterId: 'first', userId: 'verified-user', rpc: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: state.rpc }) }))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: async () => ({ userId: state.userId }),
}))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: async () => ({ id: state.characterId }),
}))
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { createSupabaseMasterPanelStaffAccessStore } from './supabase-staff-access-store'
import { createSupabaseCombatContentAuthoringStore } from './supabase-combat-content-authoring-store'
import { createSupabaseEventAuthoringStore } from './supabase-event-authoring-store'
import { createMasterPanelStaffAccessService } from './staff-access'
import { createEventAuthoringService } from './event-authoring-service'

const token = 'a'.repeat(32)
const skill = resolveMatureSkillVersion('vanguard.forceful-strike')!
const combatRow = {
  id: 'published-skill',
  content_key: skill.id,
  content_kind: 'skill',
  content_version: skill.contentVersion,
  definition: skill,
  published_by: 'verified-user',
  published_at: '2026-10-20T12:00:00Z',
}
const eventKey = 'event.frostmere-storm'
const eventRow = {
  id: 'published-event',
  event_key: eventKey,
  definition_version: 1,
  definition: { eventKey, scope: { type: 'region', key: 'region.frostmere' } },
  published_by: 'verified-user',
  published_at: '2026-10-20T12:00:00Z',
}
beforeEach(() => {
  state.userId = 'verified-user'
  state.characterId = 'first'
  state.rpc.mockReset().mockImplementation(async (name: string) => {
    if (name === 'read_combat_content_catalogue_v1')
      return { data: { token, policy: { version: 1, modes: {} }, publications: [] }, error: null }
    if (
      [
        'read_current_combat_content_v1',
        'publish_combat_content_v3',
        'list_combat_content_versions_v1',
      ].includes(name)
    )
      return { data: [combatRow], error: null }
    if (name === 'read_current_event_definition_v1') return { data: [eventRow], error: null }
    if (name === 'read_master_panel_access_v1')
      return {
        data: [
          {
            user_id: state.userId,
            character_id: state.characterId,
            access_version: 1,
            roles: ['event-staff'],
            special_capabilities: [],
          },
        ],
        error: null,
      }
    if (name === 'schedule_event_run_v2')
      return { data: [{ run_id: 'scheduled', state_version: 1, replayed: false }], error: null }
    return { data: [], error: null }
  })
})
it('the production Staff factory binds each RPC to the current verified selected character', async () => {
  const store = createSupabaseMasterPanelStaffAccessStore()
  await store.readAccess(state.userId)
  expect(state.rpc).toHaveBeenLastCalledWith('read_master_panel_access_v1', {
    p_user_id: state.userId,
    p_actor_character_id: 'first',
  })
  state.characterId = 'alternate'
  await store.readAccess(state.userId)
  expect(state.rpc).toHaveBeenLastCalledWith('read_master_panel_access_v1', {
    p_user_id: state.userId,
    p_actor_character_id: 'alternate',
  })
  await expect(store.readAccess('substituted-user')).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
it('the production Combat factory retains the ordinary current reader signature', async () => {
  const store = createSupabaseCombatContentAuthoringStore(state.userId)
  await expect(store.findPublished(skill.id, 'skill')).resolves.toMatchObject({
    contentKey: skill.id,
  })
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith('read_current_combat_content_v1', {
    p_content_key: skill.id,
    p_content_kind: 'skill',
  })
})
it('real Combat publication and pointer validation compose actorless catalogue reads with selected protected writes', async () => {
  const store = createSupabaseCombatContentAuthoringStore(state.userId)
  await expect(
    store.publish({
      actorUserId: state.userId,
      contentKey: skill.id,
      contentKind: 'skill',
      definition: skill as unknown as Record<string, unknown>,
      expectedBaseVersion: skill.contentVersion,
    }),
  ).resolves.toMatchObject({ contentKey: skill.id })
  expect(state.rpc).toHaveBeenCalledWith('read_combat_content_catalogue_v1', {})
  expect(state.rpc).toHaveBeenCalledWith(
    'publish_combat_content_v3',
    expect.objectContaining({
      p_actor_user_id: state.userId,
      p_actor_character_id: 'first',
      p_expected_catalogue_token: token,
    }),
  )
  state.characterId = 'alternate'
  await store.setCurrentPublication(skill.id, skill.contentVersion, state.userId)
  expect(state.rpc).toHaveBeenCalledWith('list_combat_content_versions_v1', {
    p_actor_user_id: state.userId,
    p_actor_character_id: 'alternate',
    p_content_key: skill.id,
  })
  expect(state.rpc).toHaveBeenLastCalledWith(
    'set_combat_content_publication_v2',
    expect.objectContaining({
      p_actor_user_id: state.userId,
      p_actor_character_id: 'alternate',
      p_expected_catalogue_token: token,
    }),
  )
  expect(
    state.rpc.mock.calls.filter(([name]) => name === 'read_combat_content_catalogue_v1'),
  ).toEqual([
    ['read_combat_content_catalogue_v1', {}],
    ['read_combat_content_catalogue_v1', {}],
  ])
})
it('the production Event factory keeps current reads actorless through real workspace and scheduling composition', async () => {
  const store = createSupabaseEventAuthoringStore(state.userId)
  await expect(store.readCurrent(eventKey)).resolves.toMatchObject({ eventKey })
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith('read_current_event_definition_v1', {
    p_event_key: eventKey,
  })
  const service = createEventAuthoringService({
    store,
    staffAccess: createMasterPanelStaffAccessService(createSupabaseMasterPanelStaffAccessStore()),
  })
  await expect(
    service.loadWorkspace({ actorUserId: state.userId, eventKey }),
  ).resolves.toMatchObject({ current: { eventKey }, draft: null, versions: [] })
  expect(state.rpc).toHaveBeenCalledWith('read_event_definition_draft_v1', {
    p_actor_user_id: state.userId,
    p_actor_character_id: 'first',
    p_event_key: eventKey,
  })
  expect(state.rpc).toHaveBeenCalledWith('list_event_definition_versions_v1', {
    p_actor_user_id: state.userId,
    p_actor_character_id: 'first',
    p_event_key: eventKey,
  })
  await expect(
    service.schedule({
      actorUserId: state.userId,
      eventKey,
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      requestFingerprint: 'fixture',
      scheduledStartAt: '2026-11-01T12:00:00Z',
      scheduledEndAt: null,
      reason: 'Reviewed schedule',
      confirmed: true,
    }),
  ).resolves.toMatchObject({ runId: 'scheduled' })
  expect(state.rpc).toHaveBeenLastCalledWith(
    'schedule_event_run_v2',
    expect.objectContaining({ p_actor_user_id: state.userId, p_actor_character_id: 'first' }),
  )
  expect(
    state.rpc.mock.calls.filter(([name]) => name === 'read_current_event_definition_v1'),
  ).toEqual(
    Array.from({ length: 3 }, () => [
      'read_current_event_definition_v1',
      { p_event_key: eventKey },
    ]),
  )
})
it.each(['combat', 'event'] as const)(
  'the %s factory rejects substituted protected actors before transport',
  async (kind) => {
    const store =
      kind === 'combat'
        ? createSupabaseCombatContentAuthoringStore('substituted-user')
        : createSupabaseEventAuthoringStore('substituted-user')
    await expect(
      'findDraft' in store ? store.findDraft(skill.id) : store.readDraft(eventKey),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(state.rpc).not.toHaveBeenCalled()
  },
)
