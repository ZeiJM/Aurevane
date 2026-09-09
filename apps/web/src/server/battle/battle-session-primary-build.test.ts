import type { BattleSessionRepository, CreateBattleSessionInput } from '@aurevane/db/battle-session'
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
} from '@aurevane/game-core/combat/essence'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type {
  CharacterActiveBuildRecord,
  CharacterBuildRepository,
  CharacterCommittedBuildSnapshotRecord,
} from '../character/character-build-service'
import { createBattleSessionService } from './battle-session-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const NOW = '2026-09-09T12:00:00.000Z'

function character(): CharacterRecord {
  return {
    id: CHARACTER_ID,
    userId: USER_ID,
    slotIndex: 0,
    rulesVersion: 1,
    name: 'Wayfarer',
    nameKey: 'wayfarer',
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
    createdAt: NOW,
    cycleStartedAt: NOW,
    lastActiveAt: NOW,
  }
}

function activeBuild(): CharacterActiveBuildRecord {
  return {
    characterId: CHARACTER_ID,
    schemaVersion: 2,
    buildVersion: 7,
    primaryDefinition: {
      id: 'farstrider',
      definitionVersion: 1,
      name: 'Farstrider',
      summary: 'Mobile ranged pressure.',
      enabledForPrimary: true,
      enabledForSecondary: true,
    },
    primaryProfile: {
      disciplineId: 'farstrider',
      profileVersion: 1,
      statOffsets: { evasion: 150, accuracy: 300, movement: 1, initiative: 2 },
    },
    secondaryDefinition: null,
    primaryAttunementLockedUntil: null,
    secondaryAttunementLockedUntil: null,
    attunementPolicy: {
      version: 1,
      primaryCooldownSeconds: 0,
      secondaryCooldownSeconds: 0,
    },
    serverNow: NOW,
    updatedAt: NOW,
  }
}

function committedSnapshot(): CharacterCommittedBuildSnapshotRecord {
  const essence = resolveEssenceForBuild('farstrider', null)
  return {
    schemaVersion: 2,
    buildVersion: 7,
    primary: {
      disciplineId: 'farstrider',
      definitionVersion: 1,
      profileVersion: 1,
    },
    secondary: null,
    disciplineSkills: [],
    extensions: {
      resonance: null,
      essence: essence ? essenceSnapshotReference(essence) : null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

describe('battle session committed Primary stat authority', () => {
  it('uses the committed Primary profile for Movement and other derived battle values', async () => {
    const characterRecord = character()
    const characters: CharacterRepository = {
      findByOwnerSlot: vi.fn(async () => characterRecord),
      createBaseCharacter: vi.fn(async () => {
        throw new Error('Not used.')
      }),
    }

    let createInput: CreateBattleSessionInput | null = null
    const readCreateInput = (): CreateBattleSessionInput | null => createInput
    const battles: BattleSessionRepository = {
      createBattleSession: vi.fn(async (input) => {
        createInput = input
        return {
          replayed: false,
          result: {
            battleSessionId: SESSION_ID,
            battleVersion: 1,
            snapshot: input.initialSnapshot,
            createdAt: NOW,
          },
        }
      }),
      findBattleSession: vi.fn(async () => null),
      findBattleIntentReplay: vi.fn(async () => null),
      commitBattleIntent: vi.fn(async () => {
        throw new Error('Not used.')
      }),
    }

    const build = activeBuild()
    const snapshot = committedSnapshot()
    const builds: CharacterBuildRepository = {
      findActiveBuild: vi.fn(async () => build),
      listDisciplines: vi.fn(async () => []),
      listLearnedSkills: vi.fn(async () => []),
      listEquippedDisciplineSkills: vi.fn(async () => []),
      loadCommittedBuildSnapshot: vi.fn(async () => snapshot),
      changeDisciplines: vi.fn(async () => {
        throw new Error('Not used.')
      }),
      saveDisciplineSkills: vi.fn(async () => {
        throw new Error('Not used.')
      }),
    }

    const service = createBattleSessionService({ characters, battles, builds })
    await service.createSession({
      userId: USER_ID,
      characterId: CHARACTER_ID,
      idempotencyKey: '44444444-4444-4444-8444-444444444444',
    })

    const persistedInput = readCreateInput()
    if (!persistedInput) throw new Error('Expected a persisted battle snapshot.')
    const state = persistedInput.initialSnapshot as StatDrivenCombatEncounterState
    const player = state.tactical.battle.combatants.find(
      (combatant) => combatant.id === `character:${CHARACTER_ID}`,
    )
    const profile = state.statBridge.combatants.find(
      (candidate) => candidate.combatantId === `character:${CHARACTER_ID}`,
    )

    // Raw Level-1 Agility 6 yields Movement 2 in V2. Farstrider's committed +1 profile must be
    // present in battle, matching the Profile-derived snapshot rather than raw attributes alone.
    expect(player?.baseMovementBudget).toBe(3)
    expect(state.tactical.battle.currentTurn?.movementRemaining).toBe(3)
    expect(profile?.accuracy).toBe(6_950)
    expect(profile?.evasion).toBe(320)
  })
})
