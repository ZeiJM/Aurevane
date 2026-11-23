/** Local native witness: real admission, preview, commit and criteria with in-memory persistence. */
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import type {
  BattleEventRecord,
  BattleSessionRecord,
  BattleSessionRepository,
} from '@aurevane/db/battle-session'
import type { CharacterBuildRepository } from '@/server/character/character-build-service'
import {
  createBattleSessionService,
  type BattleAuthoritativeEncounterState,
} from '@/server/battle/battle-session-service'
import { createBattlePreviewService } from '@/server/battle/battle-preview-service'
import { createBattleFinalTurnService } from '@/server/battle/battle-final-turn-service'
import { createGuidedTrainingCompletionService } from '@/server/battle/guided-training-completion-service'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
} from '@aurevane/game-core/combat/essence'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import type { BattleEquipmentCapture } from '@aurevane/game-core/combat/combat-equipment'

export async function createGuidedNativeFixture(loadout: string) {
  const userId = 'owner',
    characterId = 'player',
    battleSessionId = 'fixture',
    actorId = 'character:player'
  const now = '2026-11-03T00:00:00.000Z'
  const supportActionId = loadout === 'empty-mp' ? 'basic.recover.mp' : 'basic.recover'
  const catalogue = starterItemDefinitions()
  const equipment: BattleEquipmentCapture = {
    schemaVersion: 2,
    inventoryRevision: 1,
    selectedSupport:
      loadout === 'equipment-support'
        ? { kind: 'equipment', position: 'main-hand', itemId: 'tower-shield', behaviorId: 'guard' }
        : { kind: 'basic', actionId: supportActionId },
    equipment:
      loadout === 'empty-mp'
        ? []
        : [
            {
              position: 'main-hand',
              ownedStackId: 'private-native-stack',
              item: catalogue.find(
                (item) =>
                  item.id ===
                  (loadout === 'equipment-support' ? 'tower-shield' : 'iron-shortsword'),
              )!,
            },
          ],
  }
  const character: CharacterRecord = {
    id: characterId,
    userId,
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
    createdAt: now,
    cycleStartedAt: now,
    lastActiveAt: now,
  }
  const unused = async (): Promise<never> => {
    throw new Error('Unexpected fixture mutation')
  }
  const characters: CharacterRepository = {
    findByOwnerSlot: async () => character,
    createBaseCharacter: unused,
  }
  const builds: CharacterBuildRepository = {
    findActiveBuild: async () => ({
      characterId,
      schemaVersion: 2,
      buildVersion: 1,
      primaryDefinition: {
        id: 'vanguard',
        definitionVersion: 1,
        name: 'Vanguard',
        summary: 'Front-line pressure and durable physical control.',
        enabledForPrimary: true,
        enabledForSecondary: true,
      },
      primaryProfile: {
        disciplineId: 'vanguard',
        profileVersion: 1,
        statOffsets: { maxHp: 20, physicalPower: 2, armor: 5, ward: 1, initiative: -1 },
      },
      secondaryDefinition: null,
      primaryAttunementLockedUntil: null,
      secondaryAttunementLockedUntil: null,
      attunementPolicy: { version: 2, primaryCooldownSeconds: 0, secondaryCooldownSeconds: 0 },
      serverNow: now,
      updatedAt: now,
    }),
    listDisciplines: async () => [],
    listLearnedSkills: async () => [],
    listEquippedDisciplineSkills: async () => [],
    loadCommittedBuildSnapshot: async () => ({
      schemaVersion: 2,
      buildVersion: 1,
      primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
      secondary: null,
      supportActionId,
      disciplineSkills: [],
      extensions: {
        essence: essenceSnapshotReference(resolveEssenceForBuild('vanguard', null)!),
        resonance: null,
        equipmentSkills: [],
        supernatural: null,
        prestige: null,
      },
    }),
    loadBattleEquipment: async () => structuredClone(equipment),
    changeDisciplines: unused,
    saveSupportAction: unused,
    saveDisciplineSkills: unused,
  }
  let record: BattleSessionRecord | null = null
  const events: BattleEventRecord[] = []
  const battles: BattleSessionRepository = {
    findBattleSession: async () => record && JSON.parse(JSON.stringify(record)),
    findBattleIntentReplay: async () => null,
    createBattleSession: async (input) => {
      record = {
        battleSessionId,
        battleId: input.battleId,
        battleVersion: 1,
        rulesVersion: input.rulesVersion,
        contentVersion: input.contentVersion,
        lifecycle: 'active',
        snapshot: input.initialSnapshot,
        controlledCombatantIds: [actorId],
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
    commitBattleIntent: async (input) => {
      if (!record || record.battleVersion !== input.expectedBattleVersion)
        throw new Error('Stale native battle')
      const battleVersion = input.expectedBattleVersion + 1
      record = {
        ...record,
        battleVersion,
        snapshot: JSON.parse(JSON.stringify(input.nextSnapshot)),
      }
      events.push(
        ...input.events.map((event, eventIndex) => ({
          battleVersion,
          eventIndex,
          event,
          createdAt: now,
        })),
      )
      return {
        replayed: false,
        result: { battleSessionId, battleVersion, snapshot: record.snapshot, committedAt: now },
      }
    },
  }
  const resolver = {
    ...createCombatContentResolver({
      findCurrentSkill: async () => null,
      findSkillVersion: async () => null,
    }),
    resolveCurrentItemDefinition: async (id: string) =>
      catalogue.find((item) => item.id === id) ?? null,
    resolvePinnedItemDefinition: async (id: string) =>
      catalogue.find((item) => item.id === id) ?? null,
  }
  const service = createBattleSessionService({
    characters,
    builds,
    battles,
    combatContentResolver: resolver,
    readElevationPolicy: async () => ({
      version: 2,
      model: 'independent-highest',
      level1BasisPoints: 0,
      level2BasisPoints: 0,
      level3BasisPoints: 0,
    }),
  })
  const preview = createBattlePreviewService(battles, resolver)
  const finalTurn = createBattleFinalTurnService(battles)
  const training = createGuidedTrainingCompletionService({
    ...battles,
    findBattleEvents: async () => events,
  })
  await service.createSession({
    userId,
    characterId,
    battleHallRecordId: 'guided-fundamentals',
    idempotencyKey: '88888888-8888-4888-8888-888888888888',
  })
  const stored = await battles.findBattleSession(userId, battleSessionId)
  const state = stored!.snapshot as BattleAuthoritativeEncounterState
  state.tactical.placements = state.tactical.placements.map((placement) => ({
    ...placement,
    position: placement.combatantId === actorId ? { x: 2, y: 1 } : { x: 4, y: 1 },
  }))
  state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) =>
    unit.id === actorId ? { ...unit, hp: unit.maxHp - 20 } : unit,
  )
  record = { ...stored!, snapshot: state }
  return {
    start: async () => ({
      battle: await service.getSession(userId, battleSessionId),
      supportActionId,
    }),
    async request(path: string, body: Record<string, unknown> | null) {
      const input = { ...body, userId, battleSessionId }
      if (path.endsWith('/guided-training')) {
        if (!body) return { progress: await training.getProgress(userId, battleSessionId) }
        await training.complete(input as Parameters<typeof training.complete>[0])
        return { completed: true }
      }
      if (path.endsWith('/preview'))
        return {
          battlePreview: await preview.previewIntent(
            input as Parameters<typeof preview.previewIntent>[0],
          ),
        }
      if (path.endsWith('/final-turn'))
        return {
          battle: await finalTurn.commitFinalTurn(
            input as Parameters<typeof finalTurn.commitFinalTurn>[0],
          ),
        }
      if (/\/(commit|intents)$/.test(path))
        return {
          battle: await service.submitIntent(input as Parameters<typeof service.submitIntent>[0]),
        }
      return { battle: await service.getSession(userId, battleSessionId) }
    },
  }
}
