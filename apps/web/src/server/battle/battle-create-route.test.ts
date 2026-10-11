import { beforeEach, describe, expect, it, vi } from 'vitest'

const boundary = vi.hoisted(() => ({
  createSession: vi.fn(),
  assertNoActiveBattle: vi.fn(),
  loadPracticeStatus: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: vi.fn(async () => ({ userId: '11111111-1111-4111-8111-111111111111' })),
}))
vi.mock('@/server/account/active-game-session', () => ({
  assertNoActiveBattle: boundary.assertNoActiveBattle,
}))
vi.mock('@/server/battle/battle-session-service', () => ({
  createBattleSessionService: () => ({ createSession: boundary.createSession }),
}))
vi.mock('@/server/battle/supabase-battle-session-repository', () => ({
  createSupabaseBattleSessionRepository: () => ({}),
}))
vi.mock('@/server/character/supabase-character-build-repository', () => ({
  createSupabaseCharacterBuildRepository: () => ({}),
}))
vi.mock('@/server/character/supabase-character-repository', () => ({
  createSupabaseCharacterRepository: () => ({}),
}))
vi.mock('@/server/combat/combat-content-resolver', () => ({
  createServerCombatContentResolver: () => ({}),
}))
vi.mock('@/server/wayfarers-practice/supabase-wayfarers-practice-repository', () => ({
  createSupabaseWayfarersPracticeRepository: () => ({}),
}))
vi.mock('@/server/wayfarers-practice/wayfarers-practice-service', () => ({
  loadPracticeStatus: boundary.loadPracticeStatus,
  isPassiveTrainingActive: (status: { active: boolean }) => status.active,
}))

import { POST } from '../../app/api/battles/route'

const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'
const IDEMPOTENCY_KEY = '44444444-4444-4444-8444-444444444444'

function request(allyCount: number, enemyCount: number) {
  return new Request('http://localhost/api/battles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      characterId: CHARACTER_ID,
      battleHallRecordId: 'recruit-sparring',
      arenaId: 'duel-yard',
      allyCount,
      enemyCount,
      idempotencyKey: IDEMPOTENCY_KEY,
    }),
  })
}

describe('actual battle creation route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    boundary.assertNoActiveBattle.mockResolvedValue(undefined)
    boundary.loadPracticeStatus.mockResolvedValue({ active: false })
    boundary.createSession.mockResolvedValue({ battleSessionId: 'created-session' })
  })

  it.each([0, 1, 2])(
    'preserves the selected %i allies and linked enemies at the service boundary',
    async (allies) => {
      const response = await POST(request(allies, 5 - allies))

      expect(response.status).toBe(200)
      expect(boundary.createSession).toHaveBeenCalledOnce()
      expect(boundary.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '11111111-1111-4111-8111-111111111111',
          characterId: CHARACTER_ID,
          battleHallRecordId: 'recruit-sparring',
          arenaId: 'duel-yard',
          allyCount: allies,
          enemyCount: 5 - allies,
          idempotencyKey: IDEMPOTENCY_KEY,
        }),
      )
      expect(boundary.assertNoActiveBattle).toHaveBeenCalledOnce()
      expect(boundary.loadPracticeStatus).toHaveBeenCalledOnce()
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    },
  )

  it('rejects an over-capacity team before creating a session', async () => {
    const response = await POST(request(2, 4))
    expect(response.status).toBe(400)
    expect(boundary.createSession).not.toHaveBeenCalled()
  })

  it('keeps passive-training exclusion ahead of team creation', async () => {
    boundary.loadPracticeStatus.mockResolvedValue({ active: true })
    const response = await POST(request(2, 3))
    expect(response.status).toBe(400)
    expect(boundary.createSession).not.toHaveBeenCalled()
  })
})
