import { beforeEach, expect, it, vi } from 'vitest'
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
      const command = args.p_command as { definition: unknown }
      return {
        data: {
          contentKey: args.p_content_key,
          contentKind: 'item',
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
