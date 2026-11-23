import { beforeEach, expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
const { actor, selected, read } = vi.hoisted(() => ({
  actor: vi.fn(),
  selected: vi.fn(),
  read: vi.fn(),
}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: actor }))
vi.mock('@/server/character/selected-character', () => ({ loadSelectedCharacter: selected }))
vi.mock('@/server/world/world-live-presence-repository', () => ({ readLiveWorldPlayers: read }))
import { GET } from './route'
beforeEach(() => {
  actor.mockReset().mockResolvedValue({ userId: 'owner' })
  selected.mockReset().mockResolvedValue({ id: 'selected' })
  read
    .mockReset()
    .mockResolvedValue({ characterId: 'selected', version: 4, registered: true, players: [] })
})
it('keeps private presence scoped to the selected authenticated owner, ignoring supplied scenes and identities', async () => {
  const response = await GET(
    new Request(
      'https://example.test/api/world/presence?version=4&characterId=other&sectorIds=hidden',
    ),
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(read).toHaveBeenCalledWith('owner', 'selected', 4)
  expect((await response.json()).characterId).toBe('selected')
})
it.each(['', '-1', '0', '1.2', 'NaN', '9007199254740992'])(
  'rejects invalid version %s before reading peers',
  async (version) => {
    expect(
      (await GET(new Request(`https://example.test/api/world/presence?version=${version}`))).status,
    ).toBe(400)
    expect(read).not.toHaveBeenCalled()
  },
)
it('requires authentication and an owned selected character', async () => {
  actor.mockRejectedValueOnce(new AurevaneError('FORBIDDEN', 'Sign in.'))
  expect((await GET(new Request('https://example.test/api/world/presence?version=4'))).status).toBe(
    403,
  )
  selected.mockResolvedValueOnce(null)
  expect((await GET(new Request('https://example.test/api/world/presence?version=4'))).status).toBe(
    403,
  )
  expect(read).not.toHaveBeenCalled()
})
