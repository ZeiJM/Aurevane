import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { validateMatureSkillDefinition, type MatureSkillDefinition } from './mature-skills'
import { validateEssenceDefinition, type EssenceDefinition } from './essence'
import { validateResonanceDefinition, type AnyResonanceDefinition } from './resonance'
import { validateBasicSkillDefinition } from './combat-basic-actions'
import {
  applyAbilityTimingDefaults,
  parseAbilityDefinition,
  type AbilityDefinition,
} from './combat-definition'
import { combatTargetCategories } from './combat-targeting-shapes'

type Row = {
  kind: 'skill' | 'essence' | 'resonance' | 'basic'
  id: string
  beforeVersion: number
  after: Record<string, unknown> & { contentVersion: number; ability: AbilityDefinition }
}
const read = (name: string): { records: Row[] } =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../docs/superpowers/specs/${name}.json`, import.meta.url),
      'utf8',
    ),
  )
const previous = read('2026-10-10-roster-rebalance-proposals')
const cohort = read('2026-10-18-modular-correction-cohort')
const policy = {
  version: 8,
  tagAuthority: 'global' as const,
  modes: {
    'barrier-change': 'instant' as const,
    blindside: 'instant' as const,
    'return-to-turn-start': 'controlled' as const,
  },
}

it('appends the complete 294-record cohort without changing stable identity, eligibility or media', () => {
  expect(cohort.records).toHaveLength(294)
  expect(cohort.records.map((row) => `${row.kind}:${row.id}`).sort()).toEqual(
    previous.records.map((row) => `${row.kind}:${row.id}`).sort(),
  )
  for (const row of cohort.records) {
    const before = previous.records.find((candidate) => candidate.id === row.id)!.after
    expect(row.beforeVersion, row.id).toBe(before.contentVersion)
    expect(row.after.contentVersion, row.id).toBe(before.contentVersion + 1)
    for (const key of [
      'id',
      'essenceId',
      'sourceDisciplineId',
      'disciplinePair',
      'unlockRequirement',
      'media',
    ])
      if (key in before) expect(row.after[key], `${row.id}.${key}`).toEqual(before[key])
  }
})

it.each(cohort.records)(
  '$kind $id validates with globally resolved timing and current modular rules',
  (row) => {
    const after = row.after
    const issues =
      row.kind === 'skill'
        ? validateMatureSkillDefinition(after as unknown as MatureSkillDefinition)
        : row.kind === 'essence'
          ? validateEssenceDefinition(after as unknown as EssenceDefinition)
          : row.kind === 'resonance'
            ? validateResonanceDefinition(after as unknown as AnyResonanceDefinition)
            : validateBasicSkillDefinition(after)
    expect(issues).toEqual([])
    const ability = parseAbilityDefinition(after.ability)
    for (const behavior of ability.behaviors) {
      expect(behavior.activationLimits ?? []).not.toContain('once-per-battle')
      expect(behavior.groundArea?.timing).toBeUndefined()
      const resolved = applyAbilityTimingDefaults(behavior, policy)
      expect(resolved).toBeDefined()
      for (const effect of behavior.effects) {
        expect(effect.timing).toBeUndefined()
        if (effect.payload.type === 'apply-status') {
          expect(effect.payload.stacks).toBe(1)
          expect(effect.payload.statusId).not.toBe('blindside')
          if (effect.payload.statusId === 'blindside-vulnerability') {
            expect(effect.payload.recipient).not.toBe('actor')
            expect(effect.payload.durationTurns).toBe(1)
          }
        }
        if (effect.payload.type === 'barrier-change')
          expect(effect.payload.basis).toBe('maximum-hp-percent')
        if (effect.payload.type === 'move') {
          expect(behavior.targeting?.kind).toBe('ground-tile')
          expect(combatTargetCategories(behavior.targeting!)).toEqual(['ground'])
        }
      }
    }
    const text = String(after.descriptionRef ?? after.description)
    expect(text.length).toBeLessThanOrEqual(300)
    expect(text).not.toMatch(
      /once.per.battle|once.per.game|\blegal\b|captured|prepaid|kernel|packet|ordinal|next.round|round\+|\d/i,
    )
  },
)

it('keeps nonzero target elevation an uncommon deliberate exception', () => {
  const targets = cohort.records.flatMap((row) =>
    row.after.ability.behaviors.flatMap((behavior) =>
      behavior.targeting && behavior.targeting.kind !== 'self' ? [behavior.targeting] : [],
    ),
  )
  const raised = targets.filter((target) => (target.maximumElevationDifference ?? 0) > 0)
  expect(raised.length).toBeGreaterThan(0)
  expect(raised.length / targets.length).toBeLessThan(0.15)
  expect(raised.some((target) => target.maximumElevationDifference === 3)).toBe(true)
})
