import 'server-only'
import { capturedMatureSkillAbilitySource } from '@aurevane/game-core/combat/combat-action-source'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
  type BasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { parseSupportActionId } from '@aurevane/game-core/combat/support-actions'
import { prepareCombatAbilityCommand } from '@aurevane/game-core/combat/combat-ability-command'
import type { CapturedCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { COMBAT_EFFECT_TIMING_TAGS } from '@aurevane/game-core/combat/combat-effect-timing'
import {
  combatAbilityCommandContext,
  combatAbilityBehavior,
  primeCombatControlledAbility,
  reconcileCombatAbilitySources,
  combatControlledAbilityAvailability,
  isControlledCombatAbility,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import { omitCombatExecutionMetadata } from '../battle/battle-live-viewer-projection'
import { createCombatGroundArea } from '@aurevane/game-core/combat/combat-ground-areas'
import { projectPublicCombatGroundAreas } from '@aurevane/game-core/combat/combat-ground-visuals'

import {
  createCombatEncounterState,
  type CombatTargetSelection,
  type CombatActionDefinition,
} from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState, type GridPosition } from '@aurevane/game-core/combat/board'
import { normalizeCombatEffectState } from '@aurevane/game-core/combat/combat-effect-state'
import { combatActionPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
import {
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  createPv1fTemporaryResources,
  evaluatePv1fMatureSkill,
  evaluatePv1fMovement,
  preparePv1fTurnEconomy,
  readPv1fActionEconomy,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  createDuelBalancedCombatEncounterState,
  reattachStatDrivenCombatBridge,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfileV4,
} from '@aurevane/game-core/combat/stat-driven-combat'

const ACTOR_ID = 'master-preview-actor'
const ALLY_ID = 'master-preview-ally'
const ENEMY_ID = 'master-preview-enemy'
const SECOND_ENEMY_ID = 'master-preview-enemy-2'
const PREVIEW_ROUND = 4
const ACTOR_POSITION = { x: 2, y: 1 } as const

export const DEFAULT_COMBAT_CONTENT_PREVIEW_SEED = 0x4d415354

export interface CombatContentPreviewOptions {
  readonly behaviorId?: string
  readonly seed?: number
  readonly combatContext?: MatureSkillCombatContext
}

function assertPreviewSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > 0xffff_ffff) {
    throw new RangeError('Combat content preview seed must be a non-zero unsigned 32-bit integer.')
  }
}

interface PreviewGeometry {
  readonly id: string
  readonly contentVersion: number
  readonly target: CombatActionDefinition['target']
  readonly groundFire?: boolean
}

function primaryUnitId(definition: Pick<PreviewGeometry, 'target'>): string | null {
  if (definition.target.kind !== 'unit') return null
  if (definition.target.teamPolicy === 'self') return ACTOR_ID
  if (definition.target.teamPolicy === 'ally') return ALLY_ID
  return ENEMY_ID
}

function previewDistance(definition: Pick<PreviewGeometry, 'target'>): number {
  if (
    definition.target.kind === 'self' ||
    (definition.target.kind === 'unit' && definition.target.teamPolicy === 'self')
  ) {
    return 0
  }

  if (definition.target.geometryVersion === 2 && definition.target.shape.kind !== 'single') return 1
  const minimum = definition.target.minimumRange
  const maximum = definition.target.maximumRange
  if (minimum > maximum) return minimum

  const needsUnoccupiedNeighbor =
    definition.target.kind === 'empty-tile' ||
    (definition.target.kind === 'unit' && definition.target.teamPolicy !== 'self')
  const desired = needsUnoccupiedNeighbor ? Math.max(1, minimum) : minimum
  return Math.min(desired, maximum)
}

function previewTargetPosition(
  definition: Pick<PreviewGeometry, 'target'>,
  origin: GridPosition = ACTOR_POSITION,
): GridPosition {
  return {
    x: origin.x + previewDistance(definition),
    y: origin.y,
  }
}

function previewSelection(
  definition: PreviewGeometry,
  targetPosition: GridPosition,
): CombatTargetSelection {
  const groundFire =
    definition.target.kind === 'ground-tile' &&
    definition.target.teamPolicy === 'enemy' &&
    definition.groundFire === true
  if (definition.target.geometryVersion === 2) {
    if (definition.target.shape.kind === 'line')
      return { kind: 'direction', direction: 'east', ...(groundFire ? { ground: true } : {}) }
    if (definition.target.shape.kind === 'circle' || definition.target.shape.kind === 'all')
      return { kind: 'activate', ...(groundFire ? { ground: true } : {}) }
  }
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
  overrides: Partial<Pick<StatDrivenCombatProfileV4, 'accuracy' | 'evasion'>> = {},
): StatDrivenCombatProfileV4 {
  return {
    combatantId,
    provenance: {
      kind: 'scenario',
      sourceId: `scenario:master-panel-preview:${combatantId}`,
      sourceRulesVersion: 2,
    },
    accuracy: overrides.accuracy ?? 8_500,
    evasion: overrides.evasion ?? 0,
    armor: 0,
    ward: 0,
    jump: 1,
    physicalPower: 30,
    mysticPower: 30,
    level: 1,
    criticalChance: 0,
    statusResistance: 0,
  }
}

function previewState(
  definition: PreviewGeometry,
  seed: number,
  targetOrigin: GridPosition = ACTOR_POSITION,
): {
  readonly state: StatDrivenCombatEncounterState
  readonly selection: CombatTargetSelection
} {
  const targetPosition = previewTargetPosition(definition, targetOrigin)
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
    percentageDotPolicyVersion: 1 as const,
    dotTriggerPolicyVersion: 2 as const,
    skillPacketPolicyVersion: 1 as const,
    groundEffectPolicyVersion: 1 as const,
    frozenGroundPolicyVersion: 1 as const,
    airbornePolicyVersion: 1 as const,
    airborneJumpPolicyVersion: 1 as const,
    elementalDamagePolicyVersion: 2 as const,
    dynamicInitiativePolicyVersion: 1 as const,
    healingDownPolicyVersion: 1 as const,
    blindsideActivationPolicyVersion: 1 as const,
    displacementPolicyVersion: 1 as const,
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
    state: createDuelBalancedCombatEncounterState(withFixtureState, [
      profile(ACTOR_ID),
      profile(ALLY_ID),
      profile(ENEMY_ID, { evasion: 1_500 }),
      profile(SECOND_ENEMY_ID, { evasion: 2_000 }),
    ]),
    selection: previewSelection(definition, targetPosition),
  }
}

function sensoryConditions(definition: Pick<MatureSkillDefinition, 'effects'>) {
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

function previewMovementPath(behavior: AbilityBehavior): readonly GridPosition[] | undefined {
  return behavior.effects.some((effect) => effect.payload.type === 'move')
    ? [{ ...ACTOR_POSITION }, { x: ACTOR_POSITION.x + 1, y: ACTOR_POSITION.y }]
    : undefined
}

function evaluateCanonicalPreview(
  state: StatDrivenCombatEncounterState,
  source: CapturedCombatAbilitySource,
  behavior: AbilityBehavior,
  selection: CombatTargetSelection,
  movementPath?: readonly GridPosition[],
) {
  let prepared = preparePv1fTurnEconomy(state)
  if (behavior.effects.some((effect) => effect.payload.type === 'summon')) {
    // Preserve this seeded fixture's immediate defaults while supporting explicit queued packets.
    prepared = {
      ...prepared,
      effectTimingPolicy: {
        version: 1,
        modes: Object.fromEntries(
          COMBAT_EFFECT_TIMING_TAGS.map((tag) => [tag, 'instant' as const]),
        ),
      },
    }
  }
  let preparation: 'free-controlled-prime' | undefined
  if (isControlledCombatAbility(behavior)) {
    const sources = [
      ...(prepared.capturedAbilitySources ?? []).filter(
        (row) => row.sourceInstanceId !== source.sourceInstanceId,
      ),
      source,
    ]
    prepared = reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources(prepared, sources),
      prepared.statBridge,
    )
    const input = {
      state: prepared,
      actorId: ACTOR_ID,
      sourceInstanceId: source.sourceInstanceId,
      behaviorId: behavior.id,
    }
    if (combatControlledAbilityAvailability(input)?.canPrime) {
      prepared = reattachStatDrivenCombatBridge(
        primeCombatControlledAbility(input).state,
        prepared.statBridge,
      )
      preparation = 'free-controlled-prime'
    }
  }
  const quote = prepareCombatAbilityCommand({
    state: prepared,
    actorId: ACTOR_ID,
    root: { kind: 'canonical', source, behaviorId: behavior.id },
    selection,
    ...(movementPath ? { movementPath } : {}),
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(prepared, source),
  })
  return {
    ...quote,
    prepared,
    preparation,
    cost: quote.costs.find((row) => row.resource === 'ap')?.amount ?? 0,
    repeatPenaltyApplied: false,
  }
}

export function previewCombatContentDefinition(
  definition: MatureSkillDefinition,
  options: CombatContentPreviewOptions = {},
) {
  const seed = options.seed ?? DEFAULT_COMBAT_CONTENT_PREVIEW_SEED
  const combatContext = options.combatContext ?? 'pve'
  assertPreviewSeed(seed)

  const fixture = previewState(
    {
      ...definition,
      groundFire: definition.effects.some(
        (effect) => effect.type === 'damage' && effect.element === 'fire',
      ),
    },
    seed,
  )
  const source = capturedMatureSkillAbilitySource(fixture.state, definition)
  const behavior = source ? combatAbilityBehavior(source, options.behaviorId) : null
  const movementPath = behavior ? previewMovementPath(behavior) : undefined
  const geometryDefinition = behavior?.targeting
    ? {
        ...definition,
        target: behavior.targeting,
        groundFire: behavior.effects.some(
          (effect) => effect.payload.type === 'damage' && effect.payload.element === 'fire',
        ),
      }
    : {
        ...definition,
        groundFire: definition.effects.some(
          (effect) => effect.type === 'damage' && effect.element === 'fire',
        ),
      }
  const { state, selection } = behavior
    ? previewState(geometryDefinition, seed, movementPath?.at(-1))
    : fixture
  const rngBefore = structuredClone(state.tactical.battle.rng)
  const canonical =
    source && behavior
      ? evaluateCanonicalPreview(state, source, behavior, selection, movementPath)
      : null
  const evaluated =
    canonical ?? evaluatePv1fMatureSkill(state, definition, selection, combatContext)
  const rngAfter = evaluated.prepared.tactical.battle.rng
  const summonProfile =
    canonical?.summon?.input.profile ?? (!source ? definition.summonProfile : undefined)

  if (!sameRng(rngBefore, rngAfter)) {
    throw new Error('Combat content preview must not consume battle RNG.')
  }

  const economy = readPv1fActionEconomy(evaluated.prepared, ACTOR_ID)
  const actionEconomyBefore = economy?.current ?? 0
  const actionEconomyAfter = Math.max(0, actionEconomyBefore - evaluated.cost)
  const targetHitChances = evaluated.evaluation.targetHitChances ?? []

  return {
    actionId: definition.id,
    ...(behavior ? { behaviorId: behavior.id } : {}),
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
    derivedTags: [...combatActionPresentationTags(source ? evaluated.action : definition)],
    simulation: {
      seed,
      actorCombatantId: ACTOR_ID,
      primaryCombatantId: evaluated.evaluation.primaryCombatantId,
      rngConsumed: false as const,
      ...(canonical?.preparation ? { preparation: canonical.preparation } : {}),
    },
    groundAreas:
      evaluated.evaluation.legal && evaluated.action.groundArea
        ? projectPublicCombatGroundAreas(
            createCombatGroundArea(
              evaluated.prepared,
              ACTOR_ID,
              evaluated.action,
              evaluated.evaluation.affectedTiles,
              PV1F_COMBAT_CONTENT,
            ).groundAreas ?? [],
            evaluated.prepared.tactical.battle.round,
            evaluated.prepared.tactical.battle.lifecycle,
          )
        : [],
    targeting: {
      target: structuredClone(geometryDefinition.target),
      selection: structuredClone(selection),
      affectedTiles: evaluated.evaluation.affectedTiles.map((position) => ({ ...position })),
      affectedCombatantIds: [...evaluated.evaluation.affectedCombatantIds],
    },
    costs: {
      actionEconomy: evaluated.cost,
      mp: evaluated.evaluation.mpCost,
      hp: canonical?.costs.find((row) => row.resource === 'hp')?.amount ?? 0,
      actionEconomyBefore,
      actionEconomyAfter,
    },
    ...(canonical?.movement
      ? {
          movement: {
            path: canonical.movement.path.map((point) => ({ ...point })),
            maximumTiles: canonical.movement.maximumTiles,
          },
        }
      : {}),
    accuracy: {
      targetHitChances: targetHitChances.map((chance) => ({ ...chance })),
      projectionsAssumeHits: evaluated.evaluation.projectionsAssumeHits === true,
    },
    projections: {
      effects: evaluated.evaluation.projectedEffects.map((effect) => ({ ...effect })),
      terrain: evaluated.evaluation.projectedTerrain.map((terrain) => structuredClone(terrain)),
      events: evaluated.evaluation.projectedEvents.map(omitCombatExecutionMetadata),
    },
    summon: summonProfile
      ? {
          spawnPosition:
            selection.kind === 'tile'
              ? { ...selection.position }
              : previewTargetPosition(definition),
          profile: {
            id: summonProfile.id,
            name: summonProfile.name,
            description: summonProfile.description,
            flavorLine: summonProfile.flavorLine,
            portraitKey: summonProfile.portraitKey,
            tags: [...summonProfile.tags],
            maxHp: summonProfile.maxHp,
            maxMp: summonProfile.maxMp,
            initiative: summonProfile.initiative,
            movementBudget: summonProfile.movementBudget,
            stats: structuredClone(summonProfile.stats),
            aiProfile: summonProfile.aiProfile,
            aiPurposeTags: [...summonProfile.aiPurposeTags],
            lifetimeTurns: summonProfile.lifetimeTurns,
          },
          abilities: summonProfile.abilities.map((ability) => ({
            id: ability.id,
            name: ability.name,
            description: ability.description,
            apCost: ability.apCost,
            mpCost: ability.mpCost,
            tags: [...ability.tags],
            target: structuredClone(ability.target),
            effects: ability.effects.map((effect) => structuredClone(effect)),
            ai: structuredClone(ability.ai),
          })),
        }
      : null,
    vengeanceBasis: (evaluated.evaluation.vengeanceBasis ?? []).map((basis) =>
      structuredClone(basis),
    ),
    conditionalEffects: sensoryConditions(
      source ? { ...definition, effects: evaluated.action.effects } : definition,
    ),
    repeatPenaltyApplied: evaluated.repeatPenaltyApplied,
  }
}

export function previewBasicCombatContentDefinition(
  definition: BasicSkillDefinition,
  options: CombatContentPreviewOptions = {},
) {
  const seed = options.seed ?? DEFAULT_COMBAT_CONTENT_PREVIEW_SEED
  assertPreviewSeed(seed)
  const sources = captureBasicSkillSources({
    ownerCombatantId: ACTOR_ID,
    supportActionId: parseSupportActionId(definition.id) ?? 'basic.guard',
    definitions: defaultBasicSkills().map((basic) =>
      basic.id === definition.id ? definition : basic,
    ),
  })
  const source = sources.find((row) => row.abilityId === definition.id)!
  const behavior = combatAbilityBehavior(source, options.behaviorId)
  if (!behavior.targeting)
    throw new TypeError('Basic preview requires a supported Manual action target.')
  const movementPath = previewMovementPath(behavior)
  const geometry: PreviewGeometry = {
    id: definition.id,
    contentVersion: definition.contentVersion,
    target: behavior.targeting,
    groundFire: behavior.effects.some(
      (effect) => effect.payload.type === 'damage' && effect.payload.element === 'fire',
    ),
  }
  const fixture = previewState(geometry, seed, movementPath?.at(-1))
  const state = { ...fixture.state, capturedAbilitySources: sources }
  const rngBefore = structuredClone(state.tactical.battle.rng)
  if (
    definition.execution.kind === 'basic-move' &&
    definition.execution.costBasis === 'per-terrain-point'
  ) {
    const evaluated = evaluatePv1fMovement(state, movementPath ?? [])
    if (!sameRng(rngBefore, evaluated.prepared.tactical.battle.rng))
      throw new Error('Basic preview must not consume battle RNG.')
    const before = readPv1fActionEconomy(evaluated.prepared, ACTOR_ID)?.current ?? 0
    const affordable = before >= evaluated.economyCost
    return {
      actionId: definition.id,
      behaviorId: behavior.id,
      contentVersion: definition.contentVersion,
      legal: evaluated.movement.legal && affordable,
      issues: [
        ...evaluated.movement.issues.map((issue) => ({ code: issue.code, message: issue.message })),
        ...(affordable
          ? []
          : [
              {
                code: 'insufficient-action-economy',
                message: 'Preview fixture does not have enough Action Economy for this path.',
              },
            ]),
      ],
      derivedTags: [...definition.tags],
      simulation: {
        seed,
        actorCombatantId: ACTOR_ID,
        primaryCombatantId: ACTOR_ID,
        rngConsumed: false as const,
      },
      groundAreas: [],
      targeting: {
        target: structuredClone(behavior.targeting),
        selection: structuredClone(fixture.selection),
        affectedTiles: evaluated.movement.path.slice(1).map((point) => ({ ...point })),
        affectedCombatantIds: [ACTOR_ID],
      },
      costs: {
        actionEconomy: evaluated.economyCost,
        mp: 0,
        hp: 0,
        actionEconomyBefore: before,
        actionEconomyAfter: Math.max(0, before - evaluated.economyCost),
      },
      movement: {
        path: evaluated.movement.path.map((point) => ({ ...point })),
        terrainCost: evaluated.terrainCost,
        movementRemainingAfter: evaluated.movement.movementRemainingAfter,
      },
      accuracy: { targetHitChances: [], projectionsAssumeHits: false },
      projections: { effects: [], terrain: [], events: [] },
      summon: null,
      vengeanceBasis: [],
      conditionalEffects: [],
      repeatPenaltyApplied: false,
    }
  }
  const evaluated = evaluateCanonicalPreview(
    state,
    source,
    behavior,
    fixture.selection,
    movementPath,
  )
  if (!sameRng(rngBefore, evaluated.prepared.tactical.battle.rng))
    throw new Error('Basic preview must not consume battle RNG.')
  const before = readPv1fActionEconomy(evaluated.prepared, ACTOR_ID)?.current ?? 0
  return {
    actionId: definition.id,
    behaviorId: behavior.id,
    contentVersion: definition.contentVersion,
    legal: evaluated.evaluation.legal,
    issues: evaluated.evaluation.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
    })),
    derivedTags: [...combatActionPresentationTags(evaluated.action)],
    simulation: {
      seed,
      actorCombatantId: ACTOR_ID,
      primaryCombatantId: evaluated.evaluation.primaryCombatantId,
      rngConsumed: false as const,
      ...(evaluated.preparation ? { preparation: evaluated.preparation } : {}),
    },
    groundAreas:
      evaluated.evaluation.legal && evaluated.action.groundArea
        ? projectPublicCombatGroundAreas(
            createCombatGroundArea(
              evaluated.prepared,
              ACTOR_ID,
              evaluated.action,
              evaluated.evaluation.affectedTiles,
              PV1F_COMBAT_CONTENT,
            ).groundAreas ?? [],
            evaluated.prepared.tactical.battle.round,
            evaluated.prepared.tactical.battle.lifecycle,
          )
        : [],
    targeting: {
      target: structuredClone(behavior.targeting),
      selection: structuredClone(fixture.selection),
      affectedTiles: evaluated.evaluation.affectedTiles.map((point) => ({ ...point })),
      affectedCombatantIds: [...evaluated.evaluation.affectedCombatantIds],
    },
    costs: {
      actionEconomy: evaluated.cost,
      mp: evaluated.evaluation.mpCost,
      hp: evaluated.costs.find((cost) => cost.resource === 'hp')?.amount ?? 0,
      actionEconomyBefore: before,
      actionEconomyAfter: Math.max(0, before - evaluated.cost),
    },
    ...(evaluated.movement
      ? {
          movement: {
            path: evaluated.movement.path.map((point) => ({ ...point })),
            maximumTiles: evaluated.movement.maximumTiles,
          },
        }
      : {}),
    accuracy: {
      targetHitChances: evaluated.evaluation.targetHitChances?.map((row) => ({ ...row })) ?? [],
      projectionsAssumeHits: evaluated.evaluation.projectionsAssumeHits === true,
    },
    projections: {
      effects: evaluated.evaluation.projectedEffects.map((row) => ({ ...row })),
      terrain: evaluated.evaluation.projectedTerrain.map((row) => structuredClone(row)),
      events: evaluated.evaluation.projectedEvents.map(omitCombatExecutionMetadata),
    },
    summon: null,
    vengeanceBasis: evaluated.evaluation.vengeanceBasis?.map((row) => structuredClone(row)) ?? [],
    conditionalEffects: sensoryConditions({ effects: evaluated.action.effects }),
    repeatPenaltyApplied: false,
  }
}

export type CombatContentPreviewResult =
  | ReturnType<typeof previewCombatContentDefinition>
  | ReturnType<typeof previewBasicCombatContentDefinition>
