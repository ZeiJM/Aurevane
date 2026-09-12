import { AurevaneError } from '@aurevane/game-core/errors'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getView: vi.fn(),
  join: vi.fn(),
  titles: vi.fn(),
  actor: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: '127.0.0.1:3100' }) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/supabase/config', () => ({ getOptionalPublicSupabaseConfig: () => ({}) }))
vi.mock('@/server/account/account-services-readiness', () => ({
  getCurrentAccountServicesReadiness: () => ({ available: true }),
}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: mocks.actor }))
vi.mock('@/server/battle/pvp-lobby-service', () => ({ getPvpSpectatorView: mocks.getView }))
vi.mock('@/server/battle/pvp-battle-communication-service', () => ({
  joinPvpSpectation: mocks.join,
}))
vi.mock('@/server/battle/pvp-battle-profile-service', () => ({
  loadPvpParticipantTitles: mocks.titles,
}))
vi.mock('@/components/battle/battle-audio-gate', () => ({ BattleAudioGate: () => null }))
vi.mock('@/components/battle/battle-combatant-colors', () => ({
  pvpParticipantAccent: () => '#fff',
}))
vi.mock('@/components/battle/battlefield-presentation-bundle', () => ({
  BattlefieldPresentationBundle: () => null,
}))
vi.mock('@/components/battle/battle-status-effect-assist', () => ({
  BattleStatusEffectAssist: () => null,
}))
vi.mock('@/components/battle/pvp-spectator-experience', () => ({
  PvpSpectatorExperience: () => null,
}))
vi.mock('@/components/battle/pvp-spectator-viewport-polish', () => ({
  PvpSpectatorViewportPolish: () => null,
}))

import PvpSpectatorPage from './page'

const sessionId = '00000000-0000-4000-8000-000000000001'
const renderPage = () =>
  PvpSpectatorPage({ params: Promise.resolve({ battleKey: 'AVB-ABCD-1234' }) })

describe('spectator page admission and persistence failures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.actor.mockResolvedValue({ userId: 'spectator-user' })
    mocks.getView.mockResolvedValue({
      mode: '1v1',
      participants: [],
      battle: { battleSessionId: sessionId, battleVersion: 1 },
    })
    mocks.join.mockResolvedValue(sessionId)
    mocks.titles.mockResolvedValue({})
  })

  it('renders only after successful admission and title loading', async () => {
    await expect(renderPage()).resolves.toBeDefined()
    expect(mocks.join).toHaveBeenCalledWith('spectator-user', 'AVB-ABCD-1234')
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('does not bounce a persisted spectator through Battle Hall when the title query fails', async () => {
    const failure = new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Title lookup unavailable.')
    mocks.titles.mockRejectedValue(failure)
    await expect(renderPage()).rejects.toBe(failure)
    expect(mocks.join).toHaveBeenCalledOnce()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('propagates view persistence failures before joining', async () => {
    const failure = new AurevaneError('PERSISTENCE_UNAVAILABLE', 'View unavailable.')
    mocks.getView.mockRejectedValue(failure)
    await expect(renderPage()).rejects.toBe(failure)
    expect(mocks.join).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('preserves the active-battle/different-match admission rejection', async () => {
    mocks.join.mockRejectedValue(new AurevaneError('FORBIDDEN', 'Active session conflict.'))
    await expect(renderPage()).rejects.toThrow('redirect:/game/battle')
  })

  it('does not render a battle that disappeared before joining', async () => {
    mocks.join.mockResolvedValue(null)
    await expect(renderPage()).rejects.toThrow('redirect:/game/battle')
  })

  it('does not join without authentication', async () => {
    mocks.actor.mockRejectedValue(new AurevaneError('UNAUTHENTICATED', 'Sign in.'))
    await expect(renderPage()).rejects.toThrow('redirect:/')
    expect(mocks.join).not.toHaveBeenCalled()
  })
})
