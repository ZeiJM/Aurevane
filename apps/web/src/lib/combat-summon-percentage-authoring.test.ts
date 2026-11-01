import { expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import {
  combatPercentageEditIsWithinBounds,
  currentCombatPercentageIssues,
} from './combat-percentage-authoring'

it('lets Summon profiles exceed ordinary percentage defaults without widening nested status potency', () => {
  const native = resolveMatureSkillVersion('wildwarden.renewing-herbs')!
  const profile = { ...native.summonProfile!, potencyBasisPoints: 123456 }
  const canonical = { type: 'summon', recipient: 'selected-tile', profile }
  expect(currentCombatPercentageIssues(canonical)).toEqual([])
  expect(currentCombatPercentageIssues({ ...native, summonProfile: profile })).toEqual([])
  expect(combatPercentageEditIsWithinBounds({}, canonical)).toBe(true)
  expect(combatPercentageEditIsWithinBounds(native.summonProfile, profile)).toBe(true)
  const status = {
    type: 'apply-status',
    recipient: 'actor',
    statusId: 'guarded',
    potencyBasisPoints: 100000,
  }
  expect(currentCombatPercentageIssues(status)).toHaveLength(1)
  expect(combatPercentageEditIsWithinBounds({}, status)).toBe(false)
  expect(
    currentCombatPercentageIssues({
      ...canonical,
      profile: { ...profile, abilities: [{ effects: [status] }] },
    }),
  ).toHaveLength(1)
})
