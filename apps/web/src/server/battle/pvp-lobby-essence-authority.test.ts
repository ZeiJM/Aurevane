import type { CharacterRecord } from '@aurevane/db/character'
import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
} from '@aurevane/game-core/combat/essence'
import {
  resonanceSnapshotReference,
  resolveResonanceForPair,
} from '@aurevane/game-core/combat/resonance'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { CharacterCommittedBuildSnapshotRecord } from '@/server/character/character-build-service'

import { createPvpEncounter, type PvpLobbyMemberView } from './pvp-lobby-service'

const CREATED_AT = '2026-09-04T04:30:00.000Z'
const USER_A_ID = '11111111-1111-4111-8111-111111111111'
const USER_B_ID = '22222222-2222-4222-8222-222222222222'
const CHARACTER_A_ID = '33333333-3333-4333-8333-333333333333'
const CHARACTER_B_ID = '44444444-4444-4444-8444-444444444444'

function characterRecord(id: string, userId: string, name: string): CharacterRecord {
  return {
    id,
    userId,
    slotIndex: 0,
    rulesVersion: 1,
    name,
    nameKey: name.toLowerCase(),
    presentationId: 'androgynous',
    pronounPresetId: 'they_them',
    portraitRef: 'portrait.starter.wayfarer-01',
    starterAppearanceRef: 'appearance.starter.roadworn',
    foundationDisciplineId: 'vanguard',
    might: 6,
    finesse: 6,
    vitality: 6,
    agility: 6,
    intellect: 6,
    resolve: 6,
    level: 1,
    xp: 0,
    progressionCycle: 1,
    createdAt: CREATED_AT,
    cycleStartedAt: CREATED_AT,
    lastActiveAt: CREATED_AT,
  }
}

function lobbyMember(
  userId: string,
  characterId: string,
  characterName: string,
  teamIndex: number,
): PvpLobbyMemberView {
  return {
    userId,
    characterId,
    characterName,
    characterLevel: 1,
    portraitRef: 'portrait.starter.wayfarer-01',
    profileImageUrl: null,
    teamIndex,
    seatIndex: 0,
    seated: true,
    ready: true,
    isHost: teamIndex === 0,
  }
}

function pureSnapshot(): CharacterCommittedBuildSnapshotRecord {
  const essence = resolveEssenceForBuild('vanguard', null)
  if (!essence) throw new Error('Expected representative Vanguard Essence.')
  return {
    schemaVersion: 2,
    buildVersion: 7,
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
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

function mixedSnapshot(): CharacterCommittedBuildSnapshotRecord {
  const resonance = resolveResonanceForPair('vanguard', 'lifebinder')
  if (!resonance) throw new Error('Expected representative Vanguard/Lifebinder Resonance.')
  return {
    schemaVersion: 2,
    buildVersion: 8,
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
    secondary: { disciplineId: 'lifebinder', definitionVersion: 1 },
    disciplineSkills: [],
    extensions: {
      resonance: resonanceSnapshotReference(resonance),
      essence: null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

describe('P3.6 direct PvP Essence authority', () => {
  it('pins each seated character committed extension authority into the PvP encounter', () => {
    const encounter = createPvpEncounter(
      [
        {
          member: lobbyMember(USER_A_ID, CHARACTER_A_ID, 'Aster', 0),
          character: characterRecord(CHARACTER_A_ID, USER_A_ID, 'Aster'),
          buildSnapshot: pureSnapshot(),
        },
        {
          member: lobbyMember(USER_B_ID, CHARACTER_B_ID, 'Briar', 1),
          character: characterRecord(CHARACTER_B_ID, USER_B_ID, 'Briar'),
          buildSnapshot: mixedSnapshot(),
        },
      ],
      [1, 1, 0],
    )

    expect(encounter.buildAuthority).toMatchObject({
      schemaVersion: 1,
      combatContext: 'pvp',
      combatants: [
        {
          combatantId: `character:${CHARACTER_A_ID}`,
          characterId: CHARACTER_A_ID,
          buildVersion: 7,
          primary: { disciplineId: 'vanguard' },
          secondary: null,
          extensions: {
            resonance: null,
            essence: {
              essenceId: 'essence.vanguard.unbroken-strike',
              skillId: 'essence.vanguard.unbroken-strike',
            },
          },
        },
        {
          combatantId: `character:${CHARACTER_B_ID}`,
          characterId: CHARACTER_B_ID,
          buildVersion: 8,
          primary: { disciplineId: 'vanguard' },
          secondary: { disciplineId: 'lifebinder' },
          extensions: {
            resonance: expect.objectContaining({
              disciplinePair: ['vanguard', 'lifebinder'],
            }),
            essence: null,
          },
        },
      ],
    })
  })
})
