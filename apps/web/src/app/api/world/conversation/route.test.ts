import { beforeEach, expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'

const { selected, read } = vi.hoisted(() => ({ selected: vi.fn(), read: vi.fn() }))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: vi.fn(async () => ({ userId: 'current-owner' })),
}))
vi.mock('@/server/character/selected-character', () => ({ loadSelectedCharacter: selected }))
vi.mock('@/server/world/world-repository', () => ({ readWorldDialogue: read }))
import { POST } from './route'

const characterId = '5fab6c97-3ef2-40d4-976e-e52861f3e18a'
const npcId = '68480d22-c38c-410b-94ca-a3dee1d1f605'
const turn = { characterId, npcId, revision: 2, path: [1, 0] }
const request = (value: unknown) =>
  new Request('https://aurevane.invalid/api/world/conversation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  })

beforeEach(() => {
  selected.mockReset().mockResolvedValue({ id: characterId })
  read.mockReset()
})

it('binds a valid reply to the current character and returns a private, non-cacheable turn', async () => {
  const next = { body: 'A lamp is burning on the pier.', replies: ['Ask who keeps it lit'] }
  read.mockResolvedValue(next)
  const response = await POST(request(turn))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toEqual(next)
  expect(read).toHaveBeenCalledExactlyOnceWith('current-owner', turn)
})

it('rejects character substitution and malformed branch requests before reading World state', async () => {
  expect((await POST(request({ ...turn, characterId: npcId }))).status).toBe(409)
  expect((await POST(request({ ...turn, path: [1, -1] }))).status).toBe(400)
  expect((await POST(request({ ...turn, reward: 100 }))).status).toBe(400)
  selected.mockResolvedValue(null)
  expect((await POST(request(turn))).status).toBe(403)
  expect(read).not.toHaveBeenCalled()
})

it('returns the ordinary interruption error when the authority no longer offers that reply', async () => {
  read.mockRejectedValue(
    new AurevaneError('INVALID_REQUEST', 'That reply is no longer available here.'),
  )
  const response = await POST(request(turn))
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({
    error: { message: 'That reply is no longer available here.' },
  })
})
