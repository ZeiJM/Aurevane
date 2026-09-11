import { describe, expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
vi.mock('server-only', () => ({}))
import { handleBattleAudioRequest } from './battle-audio-handler'

const session = '33333333-3333-4333-8333-333333333333'
const actor = { userId: '11111111-1111-4111-8111-111111111111', email: 'test@example.com' }
const request = (params = 'version=8&mode=pve') =>
  new Request(`https://example.test/api/battles/${session}/audio?${params}`)
describe('battle audio access', () => {
  it('authenticates and validates before reading records', async () => {
    const readEvents = vi.fn(async () => [])
    const unauthenticated = await handleBattleAudioRequest(request(), session, {
      getActor: async () => {
        throw new AurevaneError('UNAUTHENTICATED', 'Sign in.')
      },
      readEvents,
    })
    expect(unauthenticated.status).toBe(401)
    for (const params of ['version=-1&mode=pve', 'version=2&mode=other', 'version=NaN&mode=pvp']) {
      expect(
        (
          await handleBattleAudioRequest(request(params), session, {
            getActor: async () => actor,
            readEvents,
          })
        ).status,
      ).toBe(400)
    }
    expect(readEvents).not.toHaveBeenCalled()
  })
  it.each(['pve', 'pvp'] as const)(
    'preserves %s record authorization and returns only cue identifiers',
    async (mode) => {
      const readEvents = vi.fn(async () => [
        {
          battleVersion: 8,
          eventIndex: 0,
          createdAt: new Date().toISOString(),
          event: { event: 'combat_action_used', actionId: 'ravager.frenzy', privateFact: 'hidden' },
        },
      ])
      const response = await handleBattleAudioRequest(request(`version=8&mode=${mode}`), session, {
        getActor: async () => actor,
        readEvents,
      })
      expect(readEvents).toHaveBeenCalledWith(actor.userId, session, mode)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(await response.json()).toEqual({
        battleVersion: 8,
        cues: [{ assetId: 'audio.phase4.ravager-action-v01-3', priority: 70 }],
      })
      const forbidden = await handleBattleAudioRequest(request(`version=8&mode=${mode}`), session, {
        getActor: async () => actor,
        readEvents: async () => {
          throw new AurevaneError('FORBIDDEN', 'Unavailable.')
        },
      })
      expect(forbidden.status).toBe(403)
    },
  )
})
