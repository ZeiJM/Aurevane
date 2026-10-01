import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@aurevane/ui', () => ({
  GameButton: ({
    children,
    variant,
    ...props
  }: React.ComponentProps<'button'> & { variant?: string }) => {
    void variant
    return createElement('button', props, children)
  },
  Kicker: ({ children }: { children: React.ReactNode }) => createElement('span', null, children),
}))

import { PracticePlanCard } from './practice-plan-card'

const practice = {
  characterId: 'character-1',
  minimumOfflineSeconds: 60,
  restedMomentumBalance: 0,
  plannedWindow: null,
  plannedWindowSeconds: null,
  planSetAt: null,
  shortWindowSeconds: 10_800,
  overnightWindowSeconds: 28_800,
  extendedWindowSeconds: 86_400,
  serverNow: '2026-09-14T09:00:00.000Z',
} as const

describe('practice plan card', () => {
  it('shows only the duration planner when no session or report exists', () => {
    const markup = renderToStaticMarkup(createElement(PracticePlanCard, { practice }))
    expect(markup).toContain('Training Plan')
    expect((markup.match(/type="radio"/g) ?? []).length).toBe(3)
    expect(markup).toContain('Start Training')
    expect(markup).toContain('10 XP/hr')
    expect(markup).toContain('+30 XP')
    expect(markup).not.toContain('Current Training')
    expect(markup).not.toContain('Training report workspace')
    expect(markup).not.toMatch(/0[123] \/ /)
  })

  it('shows only current training during a server-timed session', () => {
    const markup = renderToStaticMarkup(
      createElement(PracticePlanCard, {
        practice: {
          ...practice,
          plannedWindow: 'short',
          plannedWindowSeconds: 10_800,
          planSetAt: practice.serverNow,
        },
      }),
    )
    expect(markup).toContain('Current Training')
    expect(markup).toContain('03:00:00')
    expect(markup).toContain('Stop Training')
    expect(markup).not.toContain('Training Plan')
    expect(markup).not.toContain('type="radio"')
    expect(markup).not.toMatch(/0[123] \/ /)
  })

  it('keeps the completion boundary in current training until the server delivers a report', () => {
    const markup = renderToStaticMarkup(
      createElement(PracticePlanCard, {
        practice: {
          ...practice,
          plannedWindow: 'short',
          plannedWindowSeconds: 10_800,
          planSetAt: '2026-09-14T06:00:00.000Z',
        },
      }),
    )
    expect(markup).toContain('Finalizing your report')
    expect(markup).not.toContain('Start Training')
    expect(markup).not.toContain('Stop Training')
    expect(markup).not.toContain('Claim Training')
  })

  it('shows only the pending report, retaining its full rewards and claim', () => {
    const markup = renderToStaticMarkup(
      createElement(PracticePlanCard, {
        practice: {
          ...practice,
          plannedWindow: 'short',
          plannedWindowSeconds: 10_800,
          planSetAt: practice.serverNow,
        },
        trainingReport: {
          reportId: 'report-1',
          characterId: 'character-1',
          practiceSource: 'passive_training',
          plannedWindow: 'short',
          plannedWindowSeconds: 10_800,
          plannedElapsedSeconds: 10_800,
          balancedFallbackSeconds: 0,
          elapsedSeconds: 10_800,
          creditedPracticeSeconds: 10_800,
          requestedCharacterXp: 30,
          restedMomentumGain: 0,
          directXpCapReached: false,
          restedMomentumCapReached: false,
        },
      }),
    )
    expect(markup).toContain('Training Complete')
    expect(markup).toContain('Claim Training')
    expect(markup).toContain('+30')
    expect(markup).not.toContain('Training Plan')
    expect(markup).not.toContain('Current Training')
    expect(markup).not.toContain('role="dialog"')
    expect(markup).not.toMatch(/0[123] \/ /)
  })
})
