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
    variant: _variant,
    ...props
  }: React.ComponentProps<'button'> & { variant?: string }) =>
    createElement('button', props, children),
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
  it('keeps the duration choice while removing redundant idle copy', () => {
    const markup = renderToStaticMarkup(createElement(PracticePlanCard, { practice }))

    expect(markup).toContain('Choose a training duration.')
    expect(markup).not.toContain('Training Plan')
    expect(markup).not.toContain('Training does not start automatically')
    expect(markup).toContain('10 XP/hr')
    expect(markup).toContain('+30 XP')
  })
})
