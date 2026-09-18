import { describe, expect, it } from 'vitest'
import {
  latestEnabledMatureSkills,
  toCombatActionDefinition,
  validateMatureSkillDefinition,
  type MatureSkillDefinition,
} from './mature-skills'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import type { CombatActionDefinition } from './actions'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'

function cloneSkill(mode: 'amplify' | 'curse' = 'amplify'): MatureSkillDefinition {
  const previous = latestEnabledMatureSkills().find((definition) => definition.id === 'chronist.slow')
  if (!previous) throw new Error('Expected current Chronist Slow fixture.')
  return {
    ...previous,
    effects: [{ type: 'copy-statuses', recipient: 'primary-unit', mode }],
  } as unknown as MatureSkillDefinition
}

function status(id: string) {
  const definition = PV1F_COMBAT_CONTENT.statuses.find((candidate) => candidate.id === id)
  if (!definition) throw new Error(`Missing combat status ${id}.`)
  return definition
}

describe('Status copying: mature Skill publication boundary', () => {
  it.each(['amplify', 'curse'] as const)(
    'accepts a canonical %s clone block at the mature Skill boundary',
    (mode) => {
      const definition = cloneSkill(mode)
      expect(validateMatureSkillDefinition(definition)).toEqual([])
      expect(() => toCombatActionDefinition(definition, 'pve')).not.toThrow()
    },
  )

  it('keeps the old Basic Attack path closed to copy-statuses', () => {
    const action = {
      id: 'test.copy-basic',
      version: 1,
      sourceType: 'basic-attack',
      tags: [],
      target: {
        kind: 'unit',
        teamPolicy: 'enemy',
        shape: { kind: 'single' },
        minimumRange: 1,
        maximumRange: 3,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
        friendlyFire: 'enemies-only',
      },
      cost: { spendsAction: true, mp: 0 },
      requirements: [],
      effects: cloneSkill().effects,
    } as CombatActionDefinition
    expect(() => validateCombatActionDefinition(action)).toThrow()
  })

  it('publishes only the explicitly approved ordinary current status copy policy', () => {
    for (const id of ['guarded', 'haste', 'inspired', 'invisible']) {
      expect(status(id), id).toMatchObject({
        polarity: 'positive',
        amplifyCopyable: true,
        reactionClass: 'ordinary',
      })
    }

    for (const id of ['exposed', 'hexed', 'slow', 'root']) {
      expect(status(id), id).toMatchObject({
        polarity: 'negative',
        curseCopyable: true,
        reactionClass: 'ordinary',
      })
    }

    for (const id of ['lowered-guard', 'reckless', 'fortified', 'marked']) {
      expect(status(id).amplifyCopyable, `${id}:amplify`).not.toBe(true)
      expect(status(id).curseCopyable, `${id}:curse`).not.toBe(true)
    }
  })
})
