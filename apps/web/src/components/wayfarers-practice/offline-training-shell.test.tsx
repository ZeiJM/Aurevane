import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@aurevane/ui', () => ({
  Kicker: ({ children }: { children: React.ReactNode }) => createElement('span', null, children),
  Surface: ({ children, ...props }: React.ComponentProps<'section'>) =>
    createElement('section', props, children),
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
  it('keeps the Passive Training title while removing redundant hero copy', () => {
    const markup = renderToStaticMarkup(
      createElement(OfflineTrainingShell, {
        characterName: 'Aster',
        practicePlan: {} as never,
        trainingReport: null,
      }),
    )

    expect(markup).toContain('Passive Training')
    expect(markup).not.toContain('Background progression')
    expect(markup).not.toContain('Start a timed training block')
    expect(markup).not.toContain('Simple rule')
  })
})
