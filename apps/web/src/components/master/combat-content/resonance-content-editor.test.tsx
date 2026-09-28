import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => undefined }),
}))

import {
  ResonanceContentEditor,
  type ResonanceContentEditorOption,
} from './resonance-content-editor'

function option(
  primaryDisciplineId: string,
  secondaryDisciplineId: string,
): ResonanceContentEditorOption {
  const definition = resolveResonanceForPair(primaryDisciplineId, secondaryDisciplineId)
  if (!definition) throw new Error('Expected current Resonance fixture.')
  return {
    id: definition.id,
    label: definition.name,
    disciplinePair: [...definition.disciplinePair],
    currentVersion: definition.contentVersion,
    baseVersion: definition.contentVersion,
    draftVersion: null,
    definition,
    history: [
      {
        contentVersion: definition.contentVersion,
        source: 'static-baseline',
        current: true,
        publishedAt: null,
      },
    ],
  }
}

describe('Master Panel Resonance v2 editor', () => {
  it('authors sequence Resonance as Setup, Trigger and Result without Payoff terminology', () => {
    const resonance = option('lifebinder', 'vanguard')
    const markup = renderToStaticMarkup(
      createElement(ResonanceContentEditor, {
        resonances: [resonance],
        initialResonanceId: resonance.id,
      }),
    )

    expect(markup).toContain('aria-label="Resonance mode"')
    expect(markup).toContain('Sequence · Setup → Trigger → Result')
    expect(markup).toContain('<legend>Setup</legend>')
    expect(markup).toContain('<legend>Trigger</legend>')
    expect(markup).toContain('<legend>Result</legend>')
    expect(markup).toContain('aria-label="Resonance Setup tags"')
    expect(markup).toContain('aria-label="Resonance Trigger tags"')
    expect(markup).not.toContain('<legend>Payoff</legend>')
    expect(markup).not.toContain('AI payoff utility')
  })

  it('shows no Setup editor for immediate Resonance and caps Result effects at two', () => {
    const resonance = option('farstrider', 'lifebinder')
    const markup = renderToStaticMarkup(
      createElement(ResonanceContentEditor, {
        resonances: [resonance],
        initialResonanceId: resonance.id,
      }),
    )

    expect(markup).toContain('<option value="immediate" selected="">')
    expect(markup).toContain('None. This Resonance activates immediately when its Trigger matches')
    expect(markup).not.toContain('aria-label="Resonance Setup Discipline"')
    expect(markup).toContain('aria-label="Resonance Trigger Discipline"')
    expect(markup).toContain('This section allows at most 2 effects.')
  })
})
