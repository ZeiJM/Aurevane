import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@aurevane/game-core/character/wayfarers-practice', () => ({
  calculatePassiveTrainingXp: (window: string) =>
    window === 'short' ? 30 : window === 'overnight' ? 56 : 96,
  getPassiveTrainingXpPerHour: (window: string) =>
    window === 'short' ? 10 : window === 'overnight' ? 7 : 4,
  passiveTrainingWindowLabel: (window: string) =>
    window === 'short' ? 'Short' : window === 'overnight' ? 'Medium' : 'Extended',
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
  it.each([false, true])('keeps the report inline when hasReport is %s', (hasReport) => {
    const markup = renderToStaticMarkup(
      createElement(PracticePlanCard, {
        practice,
        hasReport,
        report: createElement(
          'aside',
          { 'aria-label': 'Training report workspace' },
          hasReport ? 'Completed training rewards' : 'No report waiting',
        ),
      }),
    )

    expect(markup).toContain('aria-label="Training report workspace"')
    expect(markup).toContain(hasReport ? 'Completed training rewards' : 'No report waiting')
    expect(markup).not.toContain('<details')
    expect(markup).not.toContain('<summary')
    expect(markup).not.toContain('role="dialog"')
    expect(markup).toContain(hasReport ? 'A chapter completed' : 'Ready when you are')
  })

  it('keeps duration choices and adds a permanent current activity panel', () => {
    const markup = renderToStaticMarkup(createElement(PracticePlanCard, { practice }))

    expect(markup).toContain('Choose a training duration.')
    expect((markup.match(/type="radio"/g) ?? []).length).toBe(3)
    expect(markup).toContain('Start Training')
    expect(markup).not.toContain('Start Medium')
    expect(markup).toContain('Training Plan')
    expect(markup).toContain('Current Training')
    expect(markup).toContain('aria-label="Training progress"')
    expect(markup).not.toContain('Training does not start automatically')
    expect(markup).toContain('10 XP/hr')
    expect(markup).toContain('+30 XP')
  })
})
