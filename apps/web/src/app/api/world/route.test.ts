import { beforeEach, expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { WorldView } from '@/world/types'
vi.mock('server-only', () => ({}))
const { actor, selection, readWorld, commitWorldCommand } = vi.hoisted(() => ({
  actor: vi.fn(),
  selection: { value: '00000000-0000-4000-8000-000000000011' as string | null },
  readWorld: vi.fn(),
  commitWorldCommand: vi.fn(),
}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: actor }))
vi.mock('@/server/character/selected-character', () => ({
  SELECTED_CHARACTER_COOKIE: 'aurevane_selected_character',
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'aurevane_selected_character' && selection.value
        ? { value: selection.value }
        : undefined,
  }),
}))
vi.mock('@/server/world/world-repository', () => ({ readWorld, commitWorldCommand }))
vi.mock('@/server/world/world-battle', () => ({ attackWorldPlayer: vi.fn() }))
import { GET, POST } from './route'
const view = {
  characterId: '00000000-0000-4000-8000-000000000011',
  version: 4,
  route: [],
  sectors: [{ id: 'owned-scene' }],
  players: [],
  objectives: [],
  serverNow: 1000,
  movementBlocked: null,
  battleSessionId: null,
  environment: { weather: 'clear' },
} as unknown as WorldView
beforeEach(() => {
  actor.mockReset().mockResolvedValue({ userId: 'owner' })
  selection.value = view.characterId
  readWorld.mockReset().mockResolvedValue({ view })
  commitWorldCommand.mockReset().mockResolvedValue(view)
})
it('uses bounded viewport dimensions only to request public scenery, never scene authority', async () => {
  const response = await GET(
    new Request(
      'https://example.test/api/world?sceneWidth=2560&sceneHeight=1440&sectorIds=private',
    ),
  )
  expect(response.status).toBe(200)
  expect(readWorld).toHaveBeenCalledExactlyOnceWith('owner', view.characterId, {
    width: 2560,
    height: 1440,
  })
  readWorld.mockClear()
  await GET(new Request('https://example.test/api/world?sceneWidth=99999&sceneHeight=99999'))
  expect(readWorld).toHaveBeenCalledExactlyOnceWith('owner', view.characterId, {
    width: 3840,
    height: 2160,
  })
})
it.each(['sceneWidth=0&sceneHeight=100', 'sceneWidth=Infinity&sceneHeight=400', 'sceneWidth=400'])(
  'ignores invalid scenery dimensions %s',
  async (query) => {
    await GET(new Request(`https://example.test/api/world?${query}`))
    expect(readWorld).toHaveBeenCalledExactlyOnceWith('owner', view.characterId)
  },
)
it('keeps compact presence authenticated, private and scoped to the selected owned character', async () => {
  const response = await GET(
    new Request(
      `https://example.test/api/world?presenceVersion=4&characterId=${view.characterId}&sectorIds=private`,
    ),
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toMatchObject({
    kind: 'presence',
    characterId: view.characterId,
    version: 4,
  })
  expect(readWorld).toHaveBeenCalledWith('owner', view.characterId)
})
it('ignores query identity as authority and returns a full current receipt after selection/version changes', async () => {
  const response = await GET(
    new Request('https://example.test/api/world?presenceVersion=3&characterId=somebody-else'),
  )
  expect(await response.json()).toEqual(view)
  expect(readWorld).toHaveBeenCalledWith('owner', view.characterId)
})
it('omits only the exact atlas on opt-in hydration after the new owned scene is read', async () => {
  const atlas = [
    { id: 'charted', charted: true },
    { id: 'owned-discovery', charted: false },
  ] as WorldView['atlas']
  const initial = { ...view, atlas }
  readWorld.mockResolvedValue({ view: initial })
  const request = (known?: string, characterId = view.characterId) =>
    new Request('https://example.test/api/world?sceneWidth=393&sceneHeight=851', {
      headers: known ? { 'x-world-atlas': `${characterId}:${known}` } : {},
    })
  expect(await (await GET(request())).json()).toEqual(initial)
  const cold = await (await GET(request('full'))).json()
  expect(cold).toEqual({ ...initial, atlasToken: expect.stringMatching(/^[0-9a-f]{64}$/) })

  const next = {
    ...initial,
    atlas: structuredClone(atlas),
    version: 5,
    serverNow: 1100,
    sectors: [{ id: 'new-authorized-scene' }],
    scenery: [['chart-only-buffer']],
    objectives: [{ id: 'private-objective' }],
    interactions: [{ id: 'private-interaction' }],
    archive: [{ id: 'private-archive' }],
  }
  readWorld.mockResolvedValue({ view: next }).mockClear()
  const response = await GET(request(cold.atlasToken))
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(readWorld).toHaveBeenCalledExactlyOnceWith('owner', view.characterId, {
    width: 393,
    height: 851,
  })
  const { atlas: sentAtlas, ...freshScene } = next
  expect(sentAtlas).toEqual(atlas)
  expect(await response.json()).toEqual({
    ...freshScene,
    kind: 'scene',
    atlasToken: cold.atlasToken,
  })

  const compact = await GET(
    new Request(
      `https://example.test/api/world?presenceVersion=5&characterId=${view.characterId}`,
      {
        headers: { 'x-world-atlas': `${view.characterId}:${cold.atlasToken}` },
      },
    ),
  )
  expect(await compact.json()).toMatchObject({ kind: 'presence' })

  readWorld.mockRejectedValueOnce(new AurevaneError('FORBIDDEN', 'World ownership changed.'))
  const denied = await GET(request(cold.atlasToken))
  expect(denied.status).toBe(403)
  expect(await denied.json()).not.toHaveProperty('atlasToken')
})
it('resends current atlas when a private atlas entry changes, disappears, or the character changes', async () => {
  const oldAtlas = [
    { id: 'charted', charted: true },
    { id: 'old-secret', charted: false },
  ]
  const request = (characterId: string, token: string) =>
    new Request('https://example.test/api/world', {
      headers: { 'x-world-atlas': `${characterId}:${token}` },
    })
  readWorld.mockResolvedValue({ view: { ...view, atlas: oldAtlas } })
  const old = await (await GET(request(view.characterId, 'full'))).json()
  expect(old.atlasToken).toMatch(/^[0-9a-f]{64}$/)

  const newAtlas = [
    { id: 'charted', charted: true },
    { id: 'new-secret', charted: false },
  ]
  readWorld.mockResolvedValue({ view: { ...view, atlas: newAtlas } })
  const changed = await (await GET(request(view.characterId, old.atlasToken))).json()
  expect(changed).toEqual({ ...view, atlas: newAtlas, atlasToken: expect.any(String) })
  expect(changed.atlasToken).not.toBe(old.atlasToken)
  const cleared = [{ id: 'charted', charted: true }]
  readWorld.mockResolvedValue({ view: { ...view, atlas: cleared } })
  expect(await (await GET(request(view.characterId, changed.atlasToken))).json()).toEqual({
    ...view,
    atlas: cleared,
    atlasToken: expect.any(String),
  })

  selection.value = '00000000-0000-4000-8000-000000000012'
  const other = { ...view, characterId: selection.value, atlas: oldAtlas }
  readWorld.mockResolvedValue({ view: other }).mockClear()
  expect(await (await GET(request(view.characterId, old.atlasToken))).json()).toEqual(other)
  const foreignToken = await (await GET(request(selection.value, old.atlasToken))).json()
  expect(foreignToken).toEqual({ ...other, atlasToken: expect.any(String) })
  expect(foreignToken.atlasToken).not.toBe(old.atlasToken)
  expect(readWorld.mock.calls).toEqual([
    ['owner', selection.value],
    ['owner', selection.value],
  ])
})
it('rejects absent authentication or selection before any World read', async () => {
  actor.mockRejectedValueOnce(new AurevaneError('FORBIDDEN', 'Sign in.'))
  expect((await GET()).status).toBe(403)
  selection.value = null
  expect((await GET()).status).toBe(403)
  expect(readWorld).not.toHaveBeenCalled()
})

it('opts only authenticated movement commands into compact approval without changing legacy readers', async () => {
  const id = '00000000-0000-4000-8000-000000000011'
  selection.value = id
  const body = {
    characterId: id,
    expectedVersion: 4,
    commandId: '00000000-0000-4000-8000-000000000099',
    intent: { kind: 'stop' },
  }
  const request = (compact: boolean) =>
    new Request('https://example.test/api/world', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(compact ? { 'x-world-response': 'movement' } : {}),
      },
      body: JSON.stringify(body),
    })
  expect((await POST(request(true))).status).toBe(200)
  expect(commitWorldCommand).toHaveBeenLastCalledWith('owner', id, body, true)
  expect((await POST(request(false))).status).toBe(200)
  expect(commitWorldCommand).toHaveBeenLastCalledWith('owner', id, body, false)
})
it('opts compact attacks into committed identity while preserving complete legacy responses', async () => {
  const { attackWorldPlayer } = await import('@/server/world/world-battle')
  const id = '00000000-0000-4000-8000-000000000011',
    target = '00000000-0000-4000-8000-000000000012'
  selection.value = id
  vi.mocked(attackWorldPlayer).mockResolvedValue({ characterId: id, battleSessionId: 'committed' })
  const body = {
    characterId: id,
    expectedVersion: 4,
    commandId: '00000000-0000-4000-8000-000000000099',
    intent: { kind: 'attack', targetId: target },
  }
  const request = (compact: boolean) =>
    new Request('https://example.test/api/world', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(compact ? { 'x-world-response': 'movement' } : {}),
      },
      body: JSON.stringify(body),
    })
  expect(await (await POST(request(true))).json()).toEqual({
    characterId: id,
    battleSessionId: 'committed',
  })
  expect(readWorld).not.toHaveBeenCalled()
  expect(await (await POST(request(false))).json()).toEqual(view)
  expect(readWorld).toHaveBeenCalledWith('owner', id)
})
