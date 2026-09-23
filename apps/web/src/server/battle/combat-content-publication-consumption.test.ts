import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
} from '@aurevane/game-core/combat/essence'
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
  resolveBattleDisciplineSkillDefinition,
  resolveBattleEssenceDefinition,
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
      if (skillId === 'vanguard.forceful-strike' && contentVersion === 7) {
        return publishedForcefulStrike()
      }
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

function historicalPureEdgedancerSnapshot(): CharacterCommittedBuildSnapshotRecord {
  const essence = resolveEssenceForBuild('edgedancer', null, 2)
  if (!essence) throw new Error('Expected historical Edgedancer Essence v2.')

  return {
    schemaVersion: 3,
    buildVersion: 42,
    primary: {
      disciplineId: 'edgedancer',
      definitionVersion: 1,
      profileVersion: 1,
    },
    secondary: null,
    disciplineSkills: [],
    extensions: {
      resonance: null,
      essence: essenceSnapshotReference(essence),
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

function committedSnapshot(): CharacterCommittedBuildSnapshotRecord {
  const skillIds = [
    'vanguard.forceful-strike',
    'vanguard.rally',
    'vanguard.brace',
    'lifebinder.barrier',
  ] as const
  const skills = skillIds.map(staticSkill)

  return {
    schemaVersion: 3,
    buildVersion: 41,
    primary: {
      disciplineId: 'vanguard',
      definitionVersion: 1,
      profileVersion: 1,
    },
    secondary: {
      disciplineId: 'lifebinder',
      definitionVersion: 1,
    },
    disciplineSkills: skills.map((definition, index) => ({
      slotIndex: index + 1,
      skillId: definition.id,
      contentVersion: definition.contentVersion,
      sourceDisciplineId: definition.sourceDisciplineId,
    })),
    extensions: {
      resonance: {
        resonanceId: 'resonance.lifebinder-vanguard.mercys-edge',
        contentVersion: 1,
        disciplinePair: ['lifebinder', 'vanguard'],
      },
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

  it('pins the current pure Essence into a new battle without rewriting the committed character snapshot', async () => {
    const snapshot = historicalPureEdgedancerSnapshot()
    expect(snapshot.extensions.essence?.contentVersion).toBe(2)

    const authority = await createResolvedBattleBuildAuthoritySnapshot(
      'pve',
      [{ combatantId: COMBATANT_ID, characterId: CHARACTER_ID, snapshot }],
      resolver(),
    )
    const resolved = resolveBattleEssenceDefinition(authority, COMBATANT_ID)

    expect(snapshot.extensions.essence?.contentVersion).toBe(2)
    expect(authority.combatants[0]!.extensions.essence).toMatchObject({
      essenceId: 'essence.edgedancer.sevenfold-cut',
      contentVersion: 3,
      skillContentVersion: 3,
    })
    expect(resolved?.contentVersion).toBe(3)
    expect(
      resolved?.skill.effects
        .filter((effect) => effect.type === 'damage')
        .map((effect) => effect.amount),
    ).toEqual([4, 4, 4, 4, 4, 4, 4])
  })

  it('resolves the exact pinned publication for catalog-v3 battle execution without static fallback', async () => {
    const snapshot = committedSnapshot()
    const authority = await createResolvedBattleBuildAuthoritySnapshot(
      'pve',
      [{ combatantId: COMBATANT_ID, characterId: CHARACTER_ID, snapshot }],
      resolver(),
    )

    const resolved = await resolveBattleDisciplineSkillDefinition(
      authority,
      COMBATANT_ID,
      'vanguard.forceful-strike',
      resolver(),
    )

    expect(resolved).toMatchObject({
      id: 'vanguard.forceful-strike',
      contentVersion: 7,
      apCost: 37,
    })
    await expect(
      resolveBattleDisciplineSkillDefinition(authority, COMBATANT_ID, 'vanguard.forceful-strike'),
    ).resolves.toBeNull()
  })
})
