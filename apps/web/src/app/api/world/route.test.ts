import { beforeEach, expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { WorldView } from '@/world/types'
vi.mock('server-only', () => ({}))
const { actor, selected, readWorld, commitWorldCommand } = vi.hoisted(() => ({
  actor: vi.fn(),
  selected: vi.fn(),
  readWorld: vi.fn(),
  commitWorldCommand: vi.fn(),
}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: actor }))
vi.mock('@/server/character/selected-character', () => ({ loadSelectedCharacter: selected }))
vi.mock('@/server/world/world-repository', () => ({ readWorld, commitWorldCommand }))
vi.mock('@/server/world/world-battle', () => ({ attackWorldPlayer: vi.fn() }))
import { GET, POST } from './route'
const view = {
  characterId: 'selected',
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
  selected.mockReset().mockResolvedValue({ id: 'selected' })
  readWorld.mockReset().mockResolvedValue({ view })
  commitWorldCommand.mockReset().mockResolvedValue(view)
})
it('keeps compact presence authenticated, private and scoped to the selected owned character', async () => {
  const response = await GET(
    new Request(
      'https://example.test/api/world?presenceVersion=4&characterId=selected&sectorIds=private',
    ),
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toMatchObject({
    kind: 'presence',
    characterId: 'selected',
    version: 4,
  })
  expect(readWorld).toHaveBeenCalledWith('owner', 'selected')
})
it('ignores query identity as authority and returns a full current receipt after selection/version changes', async () => {
  const response = await GET(
    new Request('https://example.test/api/world?presenceVersion=3&characterId=somebody-else'),
  )
  expect(await response.json()).toEqual(view)
  expect(readWorld).toHaveBeenCalledWith('owner', 'selected')
})
it('rejects absent authentication or selection before any World read', async () => {
  actor.mockRejectedValueOnce(new AurevaneError('FORBIDDEN', 'Sign in.'))
  expect((await GET()).status).toBe(403)
  selected.mockResolvedValueOnce(null)
  expect((await GET()).status).toBe(403)
  expect(readWorld).not.toHaveBeenCalled()
})

it('opts only authenticated movement commands into compact approval without changing legacy readers', async () => {
  const id = '00000000-0000-4000-8000-000000000011'
  selected.mockResolvedValue({ id })
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
  selected.mockResolvedValue({ id })
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
