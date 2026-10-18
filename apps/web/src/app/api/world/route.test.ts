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
