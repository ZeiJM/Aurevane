import { beforeEach, expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { WorldView } from '@/world/types'
vi.mock('server-only', () => ({}))
const { actor, selected, readWorld } = vi.hoisted(() => ({
  actor: vi.fn(),
  selected: vi.fn(),
  readWorld: vi.fn(),
}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: actor }))
vi.mock('@/server/character/selected-character', () => ({ loadSelectedCharacter: selected }))
vi.mock('@/server/world/world-repository', () => ({ readWorld, commitWorldCommand: vi.fn() }))
vi.mock('@/server/world/world-battle', () => ({ attackWorldPlayer: vi.fn() }))
import { GET } from './route'
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
