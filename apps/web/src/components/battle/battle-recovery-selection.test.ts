import { describe, expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { battleActionUsesRecoverySelection } from './battle-recovery-selection'

describe('recovery selection colors', () => {
  it.each(['basic.recover', 'basic.recover.mp'])('colors %s green', (actionId) => {
    expect(battleActionUsesRecoverySelection(actionId, null)).toBe(true)
  })
  it('keeps plain Guard and non-recovery buffs blue', () => {
    expect(battleActionUsesRecoverySelection('basic.guard', null)).toBe(false)
    expect(
      battleActionUsesRecoverySelection('buff', {
        tags: ['defense'],
        definition: { effects: [{ type: 'apply-status' }] },
      }),
    ).toBe(false)
  })
  it.each(['heal', 'recovery', 'Heal [24]', 'MP Restore [3]'])(
    'recognizes the %s tag without relying on command category',
    (tag) => {
      expect(battleActionUsesRecoverySelection('buff', { tags: [tag] })).toBe(true)
    },
  )
  it('recognizes mixed healing and MP restoration effects in any skill slot', () => {
    expect(
      battleActionUsesRecoverySelection('mixed', {
        tags: ['defense'],
        definition: { effects: [{ type: 'apply-status' }, { type: 'healing' }] },
      }),
    ).toBe(true)
    expect(
      battleActionUsesRecoverySelection('mana', {
        tags: ['support'],
        definition: { effects: [{ type: 'resource-change', delta: 3 }] },
      }),
    ).toBe(true)
  })
  it('does not mistake MP drain or damage for recovery', () => {
    expect(
      battleActionUsesRecoverySelection('drain', {
        tags: ['attack'],
        definition: { effects: [{ type: 'resource-change', delta: -3 }, { type: 'damage' }] },
      }),
    ).toBe(false)
  })
  it('colors the current Sacred Guard heal green and plain Steady Footing blue', () => {
    const sacredGuard = resolveMatureSkillVersion('dawnshield.sacred-guard')!
    const steadyFooting = resolveMatureSkillVersion('bastion.steady-footing')!
    expect(
      battleActionUsesRecoverySelection(sacredGuard.id, {
        tags: sacredGuard.tags,
        definition: sacredGuard,
      }),
    ).toBe(true)
    expect(
      battleActionUsesRecoverySelection(steadyFooting.id, {
        tags: steadyFooting.tags,
        definition: steadyFooting,
      }),
    ).toBe(false)
  })
})
