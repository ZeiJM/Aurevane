import { expect, it } from 'vitest'
import { defaultBasicSkills } from './combat-basic-actions'
import { applyAbilityTimingDefaults, parseAbilityDefinition } from './combat-definition'
import { parseCombatEffectTimingPolicy } from './combat-effect-timing'
import { readFileSync } from 'node:fs'

const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!

it('resolves persistent Ground timing globally while preserving old authored timing', () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  const ground = parseAbilityDefinition(
    manifest.records.find((row: { id: string }) => row.id === 'wildwarden.venom-shot').after
      .ability,
  ).behaviors[0]!
  const policy = {
    version: 8,
    tagAuthority: 'global' as const,
    modes: { 'ground-area': 'instant' as const },
  }
  expect(applyAbilityTimingDefaults(ground, policy).groundArea?.timing).toBe('instant')
  expect(
    applyAbilityTimingDefaults(ground, { version: 7, modes: { 'ground-area': 'instant' } })
      .groundArea?.timing,
  ).toBe('next-round')
  expect(ground.groundArea?.timing).toBe('next-round')
})

it.each(['instant', 'next-round', 'delayed', 'controlled'] as const)(
  'uses the global %s timing for every instance of a tag despite conflicting authored timing',
  (timing) => {
    const policy = parseCombatEffectTimingPolicy({
      version: 8,
      tagAuthority: 'global',
      modes: { damage: timing },
    })
    const behavior = parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: [
        {
          ...base,
          effects: [
            {
              id: 'one',
              timing: 'instant',
              payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
            },
            {
              id: 'two',
              timing: 'delayed',
              payload: { type: 'damage', recipient: 'primary-unit', amount: 3 },
            },
          ],
        },
      ],
    }).behaviors[0]!
    const before = JSON.stringify(behavior)
    const resolved = applyAbilityTimingDefaults(behavior, policy)
    expect(resolved.effects.map((effect) => effect.timing)).toEqual([timing, timing])
    expect(JSON.stringify(behavior)).toBe(before)
  },
)

it('keeps explicitly authored timing in old battle policies without global authority', () => {
  const behavior = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        effects: [
          {
            id: 'hit',
            timing: 'delayed',
            payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
          },
        ],
      },
    ],
  }).behaviors[0]!
  expect(
    applyAbilityTimingDefaults(behavior, { version: 7, modes: { damage: 'instant' } }).effects[0]!
      .timing,
  ).toBe('delayed')
})

it('does not accept arbitrary tag authority values in a stored policy', () => {
  expect(() =>
    parseCombatEffectTimingPolicy({ version: 8, tagAuthority: 'per-client', modes: {} }),
  ).toThrow()
})
