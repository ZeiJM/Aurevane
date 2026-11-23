import { beforeAll, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { publishProposedRoster, resolver } from '@/server/battle/roster-legal-build.test-utils'
import { resolveCurrentCharacterSkillDetails } from './current-skill-detail-loader'

beforeAll(publishProposedRoster, 30_000)

it('shows current published Essence mechanics in Skill Management instead of the historical built-in extension', async () => {
  const essence = resolveEssenceForBuild('edgedancer', null)!
  const result = await resolveCurrentCharacterSkillDetails(
    {
      capacity: 4,
      learnedSkills: [],
      equippedSkills: [],
      extensions: {
        essence,
        resonance: null,
        equipmentSkills: [],
        supernatural: null,
        prestige: null,
      },
    },
    resolver,
  )
  expect(result.extensions.essence?.contentVersion).toBe(6)
  expect(result.extensions.essence?.ability).toBeDefined()
  expect(essence.contentVersion).toBeLessThan(6)
})

it('shows the same published Resonance version as new battle admission', async () => {
  const resonance = resolveResonanceForPair('chronist', 'edgedancer')!
  const result = await resolveCurrentCharacterSkillDetails(
    {
      capacity: 4,
      learnedSkills: [],
      equippedSkills: [],
      extensions: {
        essence: null,
        resonance,
        equipmentSkills: [],
        supernatural: null,
        prestige: null,
      },
    },
    resolver,
  )
  expect(result.extensions.resonance?.contentVersion).toBe(5)
  expect(result.extensions.resonance?.ability).toBeDefined()
  expect(resonance.contentVersion).toBeLessThan(5)
})
