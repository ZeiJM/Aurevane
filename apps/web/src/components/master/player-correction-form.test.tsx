import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { disciplineCorrectionFromForm } from '@/master/player-discipline-correction'
import type { MasterPlayerFacts, MasterPlayerView } from '@/master/players'
import { PlayerCorrectionReview } from './player-correction-form'
const build = (secondary: string | null): MasterPlayerFacts['build'] => ({
  buildVersion: 1,
  primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
  secondary: secondary ? { disciplineId: secondary, definitionVersion: 1 } : null,
  disciplineSkills: [],
  supportActionId: 'basic.guard',
  extensions: { essence: null, resonance: null },
})
it.each([
  [null, 'vanguard', 'arcanist', { kind: 'disciplines', secondary: 'arcanist' }],
  ['arcanist', 'vanguard', '', { kind: 'disciplines', secondary: null }],
  [null, 'ironfist', '', { kind: 'disciplines', primary: 'ironfist' }],
  ['arcanist', 'ironfist', 'arcanist', { kind: 'disciplines', primary: 'ironfist' }],
] as const)(
  'form fields preserve omitted Discipline flags: %s → %s / %s',
  (secondary, primary, selectedSecondary, expected) => {
    const data = new FormData()
    data.set('primary', primary)
    data.set('secondary', selectedSecondary)
    expect(disciplineCorrectionFromForm(build(secondary), data)).toEqual(expected)
  },
)
it.each([null, 'arcanist'])('rejects unchanged Discipline selections including %s', (secondary) => {
  const data = new FormData()
  data.set('primary', 'vanguard')
  data.set('secondary', secondary ?? '')
  expect(() => disciplineCorrectionFromForm(build(secondary), data)).toThrow(
    'Choose a different Primary or Secondary.',
  )
})
it('review retains omitted Secondary and distinguishes explicit removal', () => {
  const player = { facts: { build: build('arcanist') } } as MasterPlayerView
  const preserved = renderToStaticMarkup(
    createElement(PlayerCorrectionReview, {
      player,
      command: { kind: 'disciplines', primary: 'ironfist' },
    }),
  )
  expect(preserved).toContain('Arcanist → <strong>Arcanist</strong>')
  const removed = renderToStaticMarkup(
    createElement(PlayerCorrectionReview, {
      player,
      command: { kind: 'disciplines', secondary: null },
    }),
  )
  expect(removed).toContain('Arcanist → <strong>None</strong>')
  expect(removed).toContain('Vanguard → <strong>Vanguard</strong>')
})
