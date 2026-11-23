import { expect, it } from 'vitest'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
  validateMatureSkillDefinition,
} from './mature-skills'
import { resolveEssenceForBuild } from './essence'
import { P35_REPRESENTATIVE_RESONANCES, resolveResonanceForPair } from './resonance'
import { normalizedResonanceMechanics } from './resonance-v2'
import type { MatureSkillEffectDefinition } from './mature-skills'
const oldRecovery = (e: MatureSkillEffectDefinition) =>
  e.type === 'healing' || (e.type === 'resource-change' && e.delta > 0)
it('current content uses percentage recovery and immutable older Skill definitions stay resolvable', () => {
  const skills = [
    ...latestEnabledMatureSkills(),
    ...[...new Set(latestEnabledMatureSkills().map((s) => s.sourceDisciplineId))].map(
      (id) => resolveEssenceForBuild(id, null)!.skill,
    ),
  ]
  expect(skills.flatMap((s) => s.effects).filter(oldRecovery)).toHaveLength(0)
  const recovery = skills.filter((s) => s.effects.some((e) => e.type === 'percentage-recovery'))
  expect(recovery.length).toBeGreaterThan(10)
  for (const skill of recovery) {
    expect(validateMatureSkillDefinition(skill), skill.id).toEqual([])
    if (!skill.id.startsWith('essence.')) {
      const old = resolveMatureSkillVersion(skill.id, skill.contentVersion - 1)!
      expect(old).not.toBeNull()
      expect(old.effects.some(oldRecovery)).toBe(true)
    }
  }
  const resonances = P35_REPRESENTATIVE_RESONANCES.map((r) =>
    resolveResonanceForPair(...r.disciplinePair)!,
  )
  expect(
    resonances.flatMap((r) => normalizedResonanceMechanics(r).resultEffects).filter(oldRecovery),
  ).toHaveLength(0)
})
it('current Rewind captures cast position and preserves the historical movement-first version', () => {
  const current = latestEnabledMatureSkills().find((s) =>
    s.effects.some((e) => e.type === 'return-to-turn-start'),
  )!
  expect(current.effects.find((e) => e.type === 'return-to-turn-start')).toMatchObject({
    anchorMode: 'cast-position',
  })
  expect(
    resolveMatureSkillVersion(current.id, current.contentVersion - 1)!.effects.find(
      (e) => e.type === 'return-to-turn-start',
    ),
  ).not.toHaveProperty('anchorMode')
})
