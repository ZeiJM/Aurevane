import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES } from '@aurevane/game-core/character/attribute-allocation'
import { disciplineCorrectionFromForm } from '@/master/player-discipline-correction'
import type { MasterPlayerFacts, MasterPlayerView } from '@/master/players'
import { PlayerCorrectionForm, PlayerCorrectionReview } from './player-correction-form'
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
  const player = { facts: { build: build('arcanist') } } as unknown as MasterPlayerView
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

it('shows the actual pinned Primary bases and caps rather than inviting an illegal stat correction', () => {
  const player = {
    facts: {
      build: build(null),
      xp: 1,
      level: 1,
      attributes: { might: 12, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
    },
    calculated: { personalPointPool: 5 },
    learnedSkills: [],
    attributePolicy: {
      disciplineId: 'vanguard',
      policyVersion: 1,
      baseAttributes: { might: 7, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
      focusAttributes: ['might', 'vitality'],
      attributeCaps: {
        might: 60,
        finesse: 40,
        vitality: 60,
        agility: 40,
        intellect: 40,
        resolve: 40,
      },
    },
  } as unknown as MasterPlayerView
  const html = renderToStaticMarkup(
    createElement(PlayerCorrectionForm, { player, disabled: false, onReview: () => {} }),
  )
  expect(html).toMatch(/<input(?=[^>]*name="might")(?=[^>]*min="7")(?=[^>]*max="60")[^>]*>/)
  expect(html).toMatch(/<input(?=[^>]*name="finesse")(?=[^>]*min="4")(?=[^>]*max="40")[^>]*>/)
  expect(html).toContain('5 / 5 personal points assigned')
})

it('offers lowering Level to remove banked points and includes their change in review', () => {
  const policy = FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES[0]!
  const player = {
    facts: {
      build: build(null),
      xp: 948,
      level: 5,
      attributes: { ...policy.baseAttributes, might: policy.baseAttributes.might + 5 },
    },
    calculated: { personalPointPool: 9 },
    learnedSkills: [],
    attributePolicy: policy,
    progressionCurve: {
      version: 1,
      maxLevel: 6,
      cumulativeXpByLevel: [0, 237, 474, 711, 948, 1185],
    },
  } as unknown as MasterPlayerView
  const html = renderToStaticMarkup(
    createElement(PlayerCorrectionForm, { player, disabled: false, onReview: () => {} }),
  )
  expect(html).toContain('Lower to Level 1 and remove 4 banked points')
  expect(html).toContain('Save as entered to keep these points')
  const review = renderToStaticMarkup(
    createElement(PlayerCorrectionReview, {
      player,
      command: { kind: 'source', xp: 0, attributes: player.facts.attributes },
    }),
  )
  expect(review).toContain('<dt>Banked points</dt><dd>4 → <strong>0</strong>')
  expect(review).toContain('<dt>Level</dt><dd>5 → <strong>1</strong>')
  expect(review).toContain('<dt>Total XP</dt><dd>948 → <strong>0</strong>')
})
