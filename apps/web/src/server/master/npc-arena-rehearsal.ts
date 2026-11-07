import 'server-only'

import { randomUUID } from 'node:crypto'
import type { BattleSessionRecord, BattleSessionRepository } from '@aurevane/db/battle-session'
import type { CharacterRecord } from '@aurevane/db/character'
import { getRecruitAiProfile } from '@aurevane/game-core/combat/recruit-ai'
import { getTacticalHallArena } from '@aurevane/game-core/combat/tactical-hall-arenas'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { NpcDesignRecord } from '@aurevane/validation/combat/npc-design'

import { createBattleRecruitAiService } from '@/server/battle/battle-recruit-ai-service'
import {
  createBattleSessionService,
  type BattleAuthoritativeEncounterState,
} from '@/server/battle/battle-session-service'

/** One bounded AI turn uses a request-local repository and a synthetic character. */
export async function rehearseNpcArenaTurn(record: NpcDesignRecord) {
  const { name, portraitRef, imageUrl, uses, arena } = record.draft
  if (!name || !arena || !uses.includes('arena')) {
    throw new AurevaneError('INVALID_REQUEST', 'Save a named Arena fighter before testing.')
  }

  const userId = randomUUID()
  const characterId = randomUUID()
  const battleSessionId = randomUUID()
  const controlledId = `character:${characterId}`
  const now = new Date().toISOString()
  const character: CharacterRecord = {
    id: characterId,
    userId,
    slotIndex: 0,
    rulesVersion: 1,
    name: 'Practice character',
    nameKey: 'practice character',
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
    createdAt: now,
    cycleStartedAt: now,
    lastActiveAt: now,
  }

  let localBattle: BattleSessionRecord | null = null
  const battles: BattleSessionRepository = {
    async createBattleSession(input) {
      localBattle = {
        battleSessionId,
        battleId: input.battleId,
        battleVersion: 1,
        rulesVersion: input.rulesVersion,
        contentVersion: input.contentVersion,
        lifecycle: 'active',
        snapshot: input.initialSnapshot,
        controlledCombatantIds: [controlledId],
        updatedAt: now,
      }
      return {
        replayed: false,
        result: {
          battleSessionId,
          battleVersion: 1,
          snapshot: input.initialSnapshot,
          createdAt: now,
        },
      }
    },
    async findBattleSession(ownerId, id) {
      return ownerId === userId && id === battleSessionId ? localBattle : null
    },
    async findBattleIntentReplay() {
      return null
    },
    async commitBattleIntent(input) {
      if (
        !localBattle ||
        input.userId !== userId ||
        input.battleSessionId !== battleSessionId ||
        localBattle.battleVersion !== input.expectedBattleVersion
      ) {
        throw new AurevaneError('STALE_VERSION', 'The Arena rehearsal changed unexpectedly.')
      }
      const snapshot = input.nextSnapshot as BattleAuthoritativeEncounterState
      const battleVersion = localBattle.battleVersion + 1
      localBattle = {
        ...localBattle,
        battleVersion,
        snapshot,
        lifecycle: snapshot.tactical.battle.lifecycle,
      }
      return {
        replayed: false,
        result: { battleSessionId, battleVersion, snapshot, committedAt: now },
      }
    },
  }
  const service = createBattleSessionService({
    battles,
    characters: {
      findByOwnerId: async (ownerId, id) =>
        ownerId === userId && id === characterId ? character : null,
      findByOwnerSlot: async () => null,
      createBaseCharacter: async () => {
        throw new Error('The rehearsal character is already available.')
      },
    },
    readArenaNpc: async (id) =>
      id === record.id
        ? {
            ...arena,
            id,
            name,
            portraitRef,
            imageUrl,
            revision: record.revision,
          }
        : null,
    readUsageProvenance: async (source) => ({ version: 1, source, eligible: false }),
  })
  let battle = await service.createSession({
    userId,
    characterId,
    arenaNpcId: record.id,
    idempotencyKey: randomUUID(),
  })
  if (battle.snapshot.tactical.battle.currentTurn?.combatantId === controlledId) {
    battle = await service.submitIntent({
      userId,
      battleSessionId,
      expectedBattleVersion: battle.battleVersion,
      idempotencyKey: randomUUID(),
      intent: { kind: 'face', facing: 'east' },
    })
  }

  const trace = await createBattleRecruitAiService(battles).runTurn({
    userId,
    battleSessionId,
    expectedBattleVersion: battle.battleVersion,
  })
  const finalBattle = trace.snapshot.tactical.battle
  const next = finalBattle.currentTurn?.combatantId
  return {
    opponentName: name,
    revision: record.revision,
    arenaName: getTacticalHallArena(arena.arenaId).name,
    profileId: getRecruitAiProfile(arena.aiDifficulty).id,
    decisions: trace.decisions.map(({ reason }) => ({ reason })),
    nextTurn: next === controlledId ? character.name : next ? name : null,
    combatants: finalBattle.combatants.map(({ id, hp, maxHp }) => ({
      name: id === controlledId ? character.name : name,
      hp,
      maxHp,
    })),
  }
}

export type NpcArenaRehearsal = Awaited<ReturnType<typeof rehearseNpcArenaTurn>>
