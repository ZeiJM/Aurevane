import { expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
import { createMasterTargetItemGrantHandler } from './master-target-item-grant-handler'

const userId = '00000000-0000-4000-8000-000000001001'
const characterId = '00000000-0000-4000-8000-000000001011'
const recipient = '00000000-0000-4000-8000-000000001012'
const target = { characterId: recipient, name: 'Recipient' }
const token = 'a'.repeat(32)
const command = {
  action: 'grant',
  characterId: recipient,
  itemId: 'test.helm',
  quantity: 1,
  expectedRevision: 7,
  catalogueToken: token,
  requestId: '00000000-0000-4000-8000-000000001021',
}
const request = (body: unknown) =>
  new Request('http://localhost/api/master/combat-content/item-grant', {
    method: 'POST',
    body: JSON.stringify(body),
  })
const selected = async () => ({ userId, characterId })
it('rejects an unauthenticated actor before resolving or mutating any recipient', async () => {
  const rpc = vi.fn(async () => ({ data: null, error: null }))
  const response = await createMasterTargetItemGrantHandler({
    selected: async () => {
      throw new AurevaneError('UNAUTHENTICATED', 'Sign in to continue.')
    },
    rpc,
  })(request(command))
  expect(response.status).toBe(401)
  expect(rpc).not.toHaveBeenCalled()
})
it.each([
  [
    { action: 'search', query: '  Recipient  ' },
    'search_master_item_grant_characters_v1',
    { p_query: 'Recipient' },
    { characters: [target] },
  ],
  [
    { action: 'read', characterId: recipient },
    'read_master_item_grant_target_v1',
    { p_character_id: recipient },
    { target, revision: 7, catalogueToken: token, battleLocked: false },
  ],
  [
    command,
    'grant_master_item_to_character_v1',
    {
      p_character_id: recipient,
      p_item_id: 'test.helm',
      p_quantity: 1,
      p_expected_revision: 7,
      p_catalogue_token: token,
      p_request_key: command.requestId,
    },
    { target, revision: 8 },
  ],
])(
  'adapts authenticated selected actor and %j to the exact recipient RPC',
  async (body, name, parameters, data) => {
    const rpc = vi.fn(async () => ({ data, error: null }))
    const response = await createMasterTargetItemGrantHandler({ selected, rpc })(request(body))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toEqual(data)
    expect(rpc.mock.calls).toEqual([
      [name, { p_actor_user_id: userId, p_actor_character_id: characterId, ...parameters }],
    ])
  },
)
it.each([
  { ...command, userId },
  { ...command, actorUserId: userId },
  { ...command, targetUserId: userId },
  { ...command, characterId: 'Recipient' },
  { ...command, requestId: 'request' },
  { ...command, quantity: 0 },
  { ...command, quantity: 100 },
  { ...command, quantity: 1.1 },
  { ...command, expectedRevision: -1 },
  { ...command, catalogueToken: 'stale' },
  { ...command, itemId: ' ' },
  { action: 'search', query: 'a' },
  { action: 'search', query: 'a'.repeat(81) },
  { action: 'read', characterId: recipient, query: 'extra' },
  { action: 'unknown' },
  null,
])('rejects spoofed or invalid input before any RPC: %j', async (body) => {
  const rpc = vi.fn(async () => ({ data: null, error: null }))
  expect((await createMasterTargetItemGrantHandler({ selected, rpc })(request(body))).status).toBe(
    400,
  )
  expect(rpc).not.toHaveBeenCalled()
})
it('rejects malformed JSON before any RPC', async () => {
  const rpc = vi.fn(async () => ({ data: null, error: null }))
  expect(
    (
      await createMasterTargetItemGrantHandler({ selected, rpc })(
        new Request('http://localhost', { method: 'POST', body: '{' }),
      )
    ).status,
  ).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
})
it.each([
  ['42501', 'MASTER_ITEM_GRANT_OWNER_REQUIRED', 403],
  ['PT409', 'ITEM_STALE_REVISION', 409],
  ['PT409', 'ITEM_STALE_CATALOGUE', 409],
  ['22023', 'ITEM_CAPACITY', 400],
  ['22023', 'ITEM_GRANT_TARGET_UNAVAILABLE', 400],
  ['22023', 'ITEM_BATTLE_ACTIVE', 400],
])(
  'maps SQL authority and concurrency failures to safe HTTP responses (%s %s)',
  async (code, message, status) => {
    const rpc = vi.fn(async () => ({ data: null, error: { code, message } }))
    const response = await createMasterTargetItemGrantHandler({ selected, rpc })(request(command))
    expect(response.status).toBe(status)
  },
)
it('rejects malformed or mismatched database target responses', async () => {
  const rpc = vi.fn(async () => ({
    data: { target: { characterId, name: 'Wrong' }, revision: 1 },
    error: null,
  }))
  expect(
    (await createMasterTargetItemGrantHandler({ selected, rpc })(request(command))).status,
  ).toBe(503)
})
it('projects only character names and IDs from search responses', async () => {
  const rpc = vi.fn(async () => ({
    data: { characters: [{ ...target, email: 'private@example.test', userId }] },
    error: null,
  }))
  const response = await createMasterTargetItemGrantHandler({ selected, rpc })(
    request({ action: 'search', query: 'Recipient' }),
  )
  expect(await response.json()).toEqual({ characters: [target] })
})
