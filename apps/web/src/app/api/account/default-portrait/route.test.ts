import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
const mocks = vi.hoisted(() => ({ actor: vi.fn(), guard: vi.fn(), set: vi.fn() }))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: mocks.actor }))
vi.mock('@/server/account/active-game-session', () => ({
  assertGameplayMutationAllowed: mocks.guard,
}))
vi.mock('@/server/character/character-portrait-choice-service', () => ({
  setCharacterDefaultPortrait: mocks.set,
}))
import { POST } from './route'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.actor.mockResolvedValue({ userId: 'owner' })
  mocks.guard.mockResolvedValue(undefined)
})
const request = (body: unknown) =>
  new Request('https://example.com/api/account/default-portrait', {
    method: 'POST',
    body: JSON.stringify(body),
  })
describe('authenticated default portrait boundary', () => {
  it('rejects malformed body shapes before calling the portrait service', async () => {
    for (const body of [null, [], 'character', {}]) {
      expect((await POST(request(body))).status).toBe(400)
    }
    expect(mocks.set).not.toHaveBeenCalled()
  })
  it('uses the authenticated owner, never a user ID in the body', async () => {
    mocks.set.mockResolvedValue({
      available: true,
      portraitRef: 'portrait.adventure.male-01',
      changedAt: '2026-10-03T00:00:00Z',
    })
    const result = await POST(
      request({
        userId: 'forged',
        characterId: 'character',
        portraitRef: 'portrait.adventure.male-01',
      }),
    )
    expect(result.status).toBe(200)
    expect(mocks.set).toHaveBeenCalledWith({
      userId: 'owner',
      characterId: 'character',
      portraitRef: 'portrait.adventure.male-01',
    })
    expect(result.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it('does not mutate when authentication fails', async () => {
    mocks.actor.mockRejectedValue(new AurevaneError('UNAUTHENTICATED', 'Sign in.'))
    expect((await POST(request({ characterId: 'character' }))).status).toBe(401)
    expect(mocks.set).not.toHaveBeenCalled()
  })
  it('does not mutate during a protected active game session', async () => {
    mocks.guard.mockRejectedValue(new AurevaneError('FORBIDDEN', 'Finish your battle first.'))
    expect((await POST(request({ characterId: 'character' }))).status).toBe(403)
    expect(mocks.set).not.toHaveBeenCalled()
  })
})
