import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@aurevane/ui', () => ({
  Kicker: ({ children }: { children: React.ReactNode }) => createElement('span', null, children),
  Surface: ({ children, ...props }: React.ComponentProps<'section'>) =>
    createElement('section', props, children),
}))
vi.mock('@/components/character/character-identity-card', () => ({
  CharacterIdentityCard: () => createElement('aside', { 'data-testid': 'character-profile' }, 'Aster'),
}))
vi.mock('@/components/media/aurevane-image', () => ({
  AurevaneImage: (props: React.ComponentProps<'img'>) => createElement('img', props),
}))
vi.mock('@/components/shell/authenticated-game-shell', () => ({
  AuthenticatedShellFrame: ({ children }: { children: React.ReactNode }) =>
    createElement(Fragment, null, children),
}))
vi.mock('./practice-plan-card', () => ({
  PracticePlanCard: () => createElement('div', null, 'Practice plan'),
}))
vi.mock('./training-report-card', () => ({
  TrainingReportCard: () => createElement('div', null, 'Training report'),
}))

import { OfflineTrainingShell } from './offline-training-shell'

describe('offline training shell', () => {
  it('keeps the Passive Training title, shared rail, and removes redundant section navigation', () => {
    const markup = renderToStaticMarkup(
      createElement(OfflineTrainingShell, {
        identity: {} as never,
        practicePlan: {} as never,
        trainingReport: null,
      }),
    )

    expect(markup).toContain('Passive Training')
    expect(markup).not.toContain('Background progression')
    expect(markup).not.toContain('Start a timed training block')
    expect(markup).not.toContain('Simple rule')
    expect(markup).toContain('data-testid="character-profile"')
    expect(markup).not.toContain('aria-label="Training sections"')
  })
})
