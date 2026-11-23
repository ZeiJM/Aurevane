import { expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { combatContentForAuthoring } from './combat-content-for-authoring'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { combatAllForAuthoring } from './combat-all-for-authoring'

it.each(['garbage', null, undefined])(
  'does not repair invalid friendly fire %s before strict validation',
  (friendlyFire) => {
    const target = { kind: 'self', friendlyFire }
    const definition = {
      target,
      effects: [{ type: 'damage', recipient: 'affected-units', target: 'all', amount: 20 }],
    }
    expect(combatAllForAuthoring(definition)).toBe(definition)
    expect(target).not.toHaveProperty('allTargetPolicyVersion')
  },
)

it('opts current All authoring into all-units without rewriting its historical source', () => {
  const original = {
    ...resolveMatureSkillVersion('aetherist.arc-bolt')!,
    ability: {
      schemaVersion: 1 as const,
      behaviors: [
        {
          ...defaultBasicSkills()[0]!.ability.behaviors[0]!,
          effects: [
            {
              id: 'hit',
              payload: {
                type: 'damage' as const,
                recipient: 'affected-units' as const,
                target: 'all' as const,
                amount: 20,
              },
            },
          ],
        },
      ],
    },
  }
  const before = JSON.stringify(original)
  const current = combatContentForAuthoring('skill', original) as typeof original
  expect(current.ability.behaviors[0]!.targeting).toMatchObject({
    allTargetPolicyVersion: 1,
    friendlyFire: 'all-units',
  })
  expect(JSON.stringify(original)).toBe(before)
  const explicit = {
    ...current,
    ability: {
      ...current.ability,
      behaviors: current.ability.behaviors.map((behavior) => ({
        ...behavior,
        targeting: { ...behavior.targeting!, friendlyFire: 'enemies-only' as const },
      })),
    },
  }
  expect(combatContentForAuthoring('skill', explicit)).toEqual(explicit)
})
