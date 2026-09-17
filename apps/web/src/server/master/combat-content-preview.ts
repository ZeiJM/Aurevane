import 'server-only'

import {
  createCombatEncounterState,
  type CombatTargetSelection,
} from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import {
  createTacticalBattleState,
  type GridPosition,
} from '@aurevane/game-core/combat/board'
import { normalizeCombatEffectState } from '@aurevane/game-core/combat/combat-effect-state'
import { combatActionPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
import {
  toCombatActionDefinition,
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  createPv1fTemporaryResources,
  evaluatePv1fMatureSkill,
  readPv1fActionEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfileV2,
} from '@aurevane/game-core/combat/stat-driven-combat'

const ACTOR_ID = 'master-preview-actor'
const ALLY_ID = 'master-preview-ally'
const ENEMY_ID = 'master-preview-enemy'
const SECOND_ENEMY_ID = 'master-preview-enemy-2'
const PREVIEW_ROUND = 4
const ACTOR_POSITION = { x: 2, y: 1 } as const

export const DEFAULT_COMBAT_CONTENT_PREVIEW_SEED = 0x4d415354

export interface CombatContentPreviewOptions {
  readonly seed?: number
  readonly combatContext?: MatureSkillCombatContext
}

function assertPreviewSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new RangeError('Combat content preview seed must be a non-negative safe integer.')
  }
}

function primaryUnitId(definition: MatureSkillDefinition): string | null {
  if (definition.target.kind !== 'unit') return null
  if (definition.target.teamPolicy === 'self') return ACTOR_ID
  if (definition.target.teamPolicy === 'ally') return ALLY_ID
  return ENEMY_ID
}

function previewDistance(definition: MatureSkillDefinition): number {
  if (
    definition.target.kind === 'self' ||
    (definition.target.kind === 'unit' && definition.target.teamPolicy === 'self')
  ) {
    return 0
  }

  const minimum = definition.target.minimumRange
  const maximum = definition.target.maximumRange
  if (minimum > maximum) return minimum

  const needsUnoccupiedNeighbor =
    definition.target.kind === 'empty-tile' ||
    (definition.target.kind === 'unit' && definition.target.teamPolicy !== 'self')
  const desired = needsUnoccupiedNeighbor ? Math.max(1, minimum) : minimum
  return Math.min(desired, maximum)
}

function previewTargetPosition(definition: MatureSkillDefinition): GridPosition {
  return {
    x: ACTOR_POSITION.x + previewDistance(definition),
    y: ACTOR_POSITION.y,
  }
}

function previewSelection(
  definition: MatureSkillDefinition,
  targetPosition: GridPosition,
): CombatTargetSelection {
  if (definition.target.kind === 'self') return { kind: 'self' }

  if (definition.target.kind === 'unit') {
    return {
      kind: 'unit',
      combatantId: primaryUnitId(definition) ?? ENEMY_ID,
    }
  }

  return {
    kind: 'tile',
    position: { ...targetPosition },
  }
}

function profile(
  combatantId: string,
  overrides: Partial<Pick<StatDrivenCombatProfileV2, 'accuracy' | 'evasion'>> = {},
): StatDrivenCombatProfileV2 {
  return {
    combatantId,
    provenance: {
      kind: 'scenario',
      sourceId: `scenario:master-panel-preview:${combatantId}`,
      sourceRulesVersion: 2,
    },
    accuracy: overrides.accuracy ?? 7_000,
    evasion: overrides.evasion ?? 0,
    armor: 5,
    ward: 5,
    jump: 1,
    physicalPower: 30,
    mysticPower: 30,
  }
}

function previewState(
  definition: MatureSkillDefinition,
  seed: number,
): {
  readonly state: StatDrivenCombatEncounterState
  readonly selection: CombatTargetSelection
} {
  const targetPosition = previewTargetPosition(definition)
  const primaryId = primaryUnitId(definition)
  const width = Math.max(10, targetPosition.x + 8)

  const allyPosition =
    primaryId === ALLY_ID ? targetPosition : ({ x: 0, y: 0 } satisfies GridPosition)
  const enemyOccupiesGround =
    definition.target.kind === 'ground-tile' && definition.target.teamPolicy !== 'ally'
  const enemyPosition =
    primaryId === ENEMY_ID || enemyOccupiesGround
      ? targetPosition
      : ({ x: width - 3, y: 0 } satisfies GridPosition)
  const secondEnemyPosition = {
    x: Math.min(width - 2, targetPosition.x + 1),
    y: 2,
  } satisfies GridPosition

  const started = startBattle(
    createPendingBattle({
      battleId: `battle:master-panel-preview:${definition.id}:${seed}`,
      rulesVersion: 2,
      contentVersion: definition.contentVersion,
      rngSeed: seed,
      combatants: [
        {
          id: ACTOR_ID,
          teamId: 'players',
          initiative: 40,
          baseMovementBudget: 6,
          hp: 60,
          maxHp: 100,
          mp: 30,
          maxMp: 50,
          temporaryResources: createPv1fTemporaryResources(16),
        },
        {
          id: ALLY_ID,
          teamId: 'players',
          initiative: 30,
          baseMovementBudget: 6,
          hp: 55,
          maxHp: 100,
          mp: 20,
          maxMp: 50,
          temporaryResources: createPv1fTemporaryResources(16),
        },
        {
          id: ENEMY_ID,
          teamId: 'enemies',
          initiative: 20,
          baseMovementBudget: 6,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 50,
          temporaryResources: createPv1fTemporaryResources(16),
        },
        {
          id: SECOND_ENEMY_ID,
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 6,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 50,
          temporaryResources: createPv1fTemporaryResources(16),
        },
      ],
    }),
  ).state

  const battle = {
    ...started,
    round: PREVIEW_ROUND,
    turnNumber: 13,
  }
  const tactical = createTacticalBattleState({
    battle,
    width,
    height: 3,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: Array.from({ length: width * 3 }, (_, index) => ({
      position: { x: index % width, y: Math.floor(index / width) },
      elevation: 0,
      terrainId: 'open',
    })),
    movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
    placements: [
      {
        combatantId: ACTOR_ID,
        position: { ...ACTOR_POSITION },
        facing: 'east',
        movementProfileId: 'ground',
      },
      {
        combatantId: ALLY_ID,
        position: { ...allyPosition },
        facing: 'east',
        movementProfileId: 'ground',
      },
      {
        combatantId: ENEMY_ID,
        position: { ...enemyPosition },
        facing: 'west',
        movementProfileId: 'ground',
      },
      {
        combatantId: SECOND_ENEMY_ID,
        position: { ...secondEnemyPosition },
        facing: 'west',
        movementProfileId: 'ground',
      },
    ],
  })

  const base = createCombatEncounterState(tactical)
  const withFixtureState = {
    ...base,
    turnOrigin: {
      combatantId: ACTOR_ID,
      turnNumber: battle.turnNumber,
      position: { x: 1, y: 1 },
    },
    effectState: {
      ...normalizeCombatEffectState(base.effectState),
      damageHistory: [
        { combatantId: ACTOR_ID, round: 2, amount: 8 },
        { combatantId: ACTOR_ID, round: 3, amount: 12 },
        { combatantId: ACTOR_ID, round: 4, amount: 20 },
      ],
    },
  }

  return {
    state: createStatDrivenCombatEncounterState(withFixtureState, [
      profile(ACTOR_ID),
      profile(ALLY_ID),
      profile(ENEMY_ID, { evasion: 1_500 }),
      profile(SECOND_ENEMY_ID, { evasion: 2_000 }),
    ]),
    selection: previewSelection(definition, targetPosition),
  }
}

function sensoryConditions(definition: MatureSkillDefinition) {
  return definition.effects.flatMap((effect) =>
    effect.type === 'sensory'
      ? [
          {
            type: 'sensory' as const,
            condition: 'target-is-covert' as const,
            revealedDurationOwnerTurnStarts: effect.revealedDurationOwnerTurnStarts,
            description: `If the target is Covert: purge eligible positive buffs and apply Revealed ${effect.revealedDurationOwnerTurnStarts}.`,
          },
        ]
      : [],
  )
}

function sameRng(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function previewCombatContentDefinition(
  definition: MatureSkillDefinition,
  options: CombatContentPreviewOptions = {},
) {
  const seed = options.seed ?? DEFAULT_COMBAT_CONTENT_PREVIEW_SEED
  const combatContext = options.combatContext ?? 'pve'
  assertPreviewSeed(seed)

  const { state, selection } = previewState(definition, seed)
  const rngBefore = structuredClone(state.tactical.battle.rng)
  const evaluated = evaluatePv1fMatureSkill(state, definition, selection, combatContext)
  const rngAfter = evaluated.prepared.tactical.battle.rng

  if (!sameRng(rngBefore, rngAfter)) {
    throw new Error('Combat content preview must not consume battle RNG.')
  }

  const economy = readPv1fActionEconomy(evaluated.prepared, ACTOR_ID)
  const actionEconomyBefore = economy?.current ?? 0
  const actionEconomyAfter = Math.max(0, actionEconomyBefore - evaluated.cost)
  const targetHitChances = evaluated.evaluation.targetHitChances ?? []

  return {
    actionId: definition.id,
    contentVersion: definition.contentVersion,
    legal: evaluated.evaluation.legal && actionEconomyBefore >= evaluated.cost,
    issues: [
      ...evaluated.evaluation.issues.map((issue) => ({
        code: issue.code,
        message: issue.message,
      })),
      ...(actionEconomyBefore >= evaluated.cost
        ? []
        : [
            {
              code: 'insufficient-action-economy',
              message: 'Preview fixture does not have enough Action Economy for this Skill.',
            },
          ]),
    ],
    derivedTags: [...combatActionPresentationTags(toCombatActionDefinition(definition, combatContext))],
    simulation: {
      seed,
      actorCombatantId: ACTOR_ID,
      primaryCombatantId: evaluated.evaluation.primaryCombatantId,
      rngConsumed: false as const,
    },
    targeting: {
      target: structuredClone(definition.target),
      selection: structuredClone(selection),
      affectedTiles: evaluated.evaluation.affectedTiles.map((position) => ({ ...position })),
      affectedCombatantIds: [...evaluated.evaluation.affectedCombatantIds],
    },
    costs: {
      actionEconomy: evaluated.cost,
      mp: evaluated.evaluation.mpCost,
      actionEconomyBefore,
      actionEconomyAfter,
    },
    accuracy: {
      targetHitChances: targetHitChances.map((chance) => ({ ...chance })),
      projectionsAssumeHits: evaluated.evaluation.projectionsAssumeHits === true,
    },
    projections: {
      effects: evaluated.evaluation.projectedEffects.map((effect) => ({ ...effect })),
      terrain: evaluated.evaluation.projectedTerrain.map((terrain) => structuredClone(terrain)),
      events: evaluated.evaluation.projectedEvents.map((event) => structuredClone(event)),
    },
    vengeanceBasis: (evaluated.evaluation.vengeanceBasis ?? []).map((basis) => structuredClone(basis)),
    conditionalEffects: sensoryConditions(definition),
    repeatPenaltyApplied: evaluated.repeatPenaltyApplied,
  }
}

export type CombatContentPreviewResult = ReturnType<typeof previewCombatContentDefinition>
