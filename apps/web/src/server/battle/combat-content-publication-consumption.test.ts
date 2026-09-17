import { describe, expect, it } from 'vitest'

import {
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'

import type {
  CharacterCommittedBuildSnapshotRecord,
  CharacterDisciplineSkillLoadoutView,
} from '@/server/character/character-build-service'
import { resolveCurrentCharacterSkillDetails } from '@/server/character/current-skill-detail-loader'
import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'

import {
  createBattleBuildAuthoritySnapshot,
  createResolvedBattleBuildAuthoritySnapshot,
} from './battle-build-authority'

const CHARACTER_ID = '00000000-0000-4000-8000-000000009901'
const COMBATANT_ID = `character:${CHARACTER_ID}`

function staticSkill(skillId: string): MatureSkillDefinition {
  const definition = resolveMatureSkillVersion(skillId)
  if (!definition) throw new Error(`Missing static Skill fixture ${skillId}.`)
  return structuredClone(definition)
}

function publishedForcefulStrike(): MatureSkillDefinition {
  return {
    ...staticSkill('vanguard.forceful-strike'),
    contentVersion: 7,
    apCost: 37,
  }
}

function resolver(): CombatContentResolver {
  return {
    async resolveCurrentSkillDefinition(skillId) {
      if (skillId === 'vanguard.forceful-strike') return publishedForcefulStrike()
      return resolveMatureSkillVersion(skillId)
    },
    async resolvePinnedSkillDefinition(skillId, contentVersion) {
      return resolveMatureSkillVersion(skillId, contentVersion)
    },
  }
}

function loadout(): CharacterDisciplineSkillLoadoutView {
  const definition = staticSkill('vanguard.forceful-strike')
  return {
    capacity: 3,
    learnedSkills: [
      {
        definition,
        learnedAt: '2026-09-17T10:00:00.000Z',
        activeSource: true,
      },
    ],
    equippedSkills: [
      {
        definition,
        slotIndex: 1,
        equippedAt: '2026-09-17T10:05:00.000Z',
      },
    ],
    extensions: {
      resonance: null,
      essence: null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

function committedSnapshot(): CharacterCommittedBuildSnapshotRecord {
  const forceful = staticSkill('vanguard.forceful-strike')
  return {
    schemaVersion: 3,
    buildVersion: 41,
    primary: {
      disciplineId: 'vanguard',
      definitionVersion: 1,
      profileVersion: 1,
    },
    secondary: null,
    disciplineSkills: [
      {
        slotIndex: 1,
        skillId: forceful.id,
        contentVersion: forceful.contentVersion,
        sourceDisciplineId: forceful.sourceDisciplineId,
      },
    ],
    extensions: {
      resonance: null,
      essence: null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

describe('published combat content consumption', () => {
  it('shows the current publication in player Skill details without mutating persisted references', async () => {
    const before = loadout()
    const persistedVersion = before.equippedSkills[0]!.definition.contentVersion

    const current = await resolveCurrentCharacterSkillDetails(before, resolver())

    expect(current.learnedSkills[0]!.definition).toMatchObject({
      id: 'vanguard.forceful-strike',
      contentVersion: 7,
      apCost: 37,
    })
    expect(current.equippedSkills[0]!.definition.contentVersion).toBe(7)
    expect(before.equippedSkills[0]!.definition.contentVersion).toBe(persistedVersion)
  })

  it('pins the publication into a new battle while an existing battle keeps its old Skill version', async () => {
    const snapshot = committedSnapshot()
    const oldVersion = snapshot.disciplineSkills[0]!.contentVersion

    const existingBattle = createBattleBuildAuthoritySnapshot('pve', [
      { combatantId: COMBATANT_ID, characterId: CHARACTER_ID, snapshot },
    ])
    const newBattle = await createResolvedBattleBuildAuthoritySnapshot(
      'pve',
      [{ combatantId: COMBATANT_ID, characterId: CHARACTER_ID, snapshot }],
      resolver(),
    )

    expect(existingBattle.catalogVersion).toBe(2)
    expect(existingBattle.combatants[0]!.disciplineSkills[0]!.contentVersion).toBe(oldVersion)
    expect(newBattle.catalogVersion).toBe(3)
    expect(newBattle.combatants[0]!.disciplineSkills[0]!.contentVersion).toBe(7)
  })
})
