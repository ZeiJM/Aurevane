import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { validateSkillDefinition } from './combat-content-authoring-validation'
it('rejects outcome, triggered-actor and unavailable-value references in legacy activation fields at actual authoring', () => {
  for (const original of [...defaultBasicSkills(), latestEnabledMatureSkills()[0]!]) {
    for (const battleText of ['{outcome.damage}', '{trigger}', '{value.99.power}']) {
      const result = validateSkillDefinition({ ...original, battleText })
      expect(result.issues).toContainEqual(
        expect.objectContaining({ path: 'battleText', code: 'UNAVAILABLE_TEXT_REFERENCE' }),
      )
    }
  }
})
