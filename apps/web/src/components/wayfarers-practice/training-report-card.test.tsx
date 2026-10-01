import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@aurevane/ui', () => ({
  GameButton: (props: React.ComponentProps<'button'>) => createElement('button', props),
}))

import { TrainingReportCard, type TrainingReportCardData } from './training-report-card'

const report: TrainingReportCardData = {
  reportId: 'report-1',
  characterId: 'character-1',
  practiceSource: 'planned_balanced',
  plannedWindow: 'overnight',
  plannedWindowSeconds: 28_800,
  plannedElapsedSeconds: 28_800,
  balancedFallbackSeconds: 57_600,
  elapsedSeconds: 86_400,
  creditedPracticeSeconds: 43_200,
  requestedCharacterXp: 1_234_567,
  restedMomentumGain: 12_345,
  directXpCapReached: true,
  restedMomentumCapReached: true,
}

describe('training report card', () => {
  it('preserves every displayed legacy reward and claim action inline', () => {
    const markup = renderToStaticMarkup(createElement(TrainingReportCard, { report }))

    for (const value of [
      'Legacy training provenance',
      'Time measured',
      '1d 0h',
      'Training credited',
      '12h 0m',
      'Character XP',
      '+1,234,567',
      'Rested Momentum',
      '+12,345',
      'Claim Training',
      'Claims are idempotent',
    ])
      expect(markup).toContain(value)
    expect(markup).not.toContain('<details')
    expect(markup).not.toContain('role="dialog"')
  })

  it('preserves the frozen Passive Training duration and XP reward', () => {
    const markup = renderToStaticMarkup(
      createElement(TrainingReportCard, {
        report: {
          ...report,
          practiceSource: 'passive_training',
          elapsedSeconds: 28_800,
          requestedCharacterXp: 56,
        },
      }),
    )

    expect(markup).toContain('Training Complete')
    expect(markup).toContain('Medium complete')
    expect(markup).toContain('Training duration')
    expect(markup).toContain('8h 0m')
    expect(markup).toContain('+56')
    expect(markup).toContain('Claim Training')
    expect(markup).not.toContain('Rested Momentum')
  })
})
