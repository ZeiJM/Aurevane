import 'server-only'
import {
  capturedMatureSkillAbilitySource,
  capturedResonanceAbilitySource,
} from '@aurevane/game-core/combat/combat-action-source'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
  type BasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { parseSupportActionId } from '@aurevane/game-core/combat/support-actions'
import {
  prepareCombatAbilityCommand,
  commitCombatAbilityCommand,
  combatAbilityUsageKey,
  type ManualCombatModifierSelection,
} from '@aurevane/game-core/combat/combat-ability-command'
import type { CapturedCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  applyAbilityTimingDefaults,
  type AbilityBehavior,
} from '@aurevane/game-core/combat/combat-definition'
import type { CombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { COMBAT_EFFECT_TIMING_TAGS } from '@aurevane/game-core/combat/combat-effect-timing'
import {
  combatTargetCategories,
  enumerateCombatTargetSelections,
} from '@aurevane/game-core/combat/combat-targeting-shapes'
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
  resolveCombatTargeting,
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
  executePv1fMatureSkill,
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

import {
  createResonanceCombatState,
  forecastResonanceForSkill,
  constrainResonanceForecastToTarget,
  type AnyResonanceDefinition,
  type ResonanceCombatEvent,
} from '@aurevane/game-core/combat/resonance'
import { normalizedResonanceMechanics } from '@aurevane/game-core/combat/resonance-v2'
import { executePv1fMatureSkillWithResonance } from '@aurevane/game-core/combat/pv1f-resonance'
import { currentBarrierAmount } from '@aurevane/game-core/combat/combat-barrier'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import type { CombatContentEventSample } from '@/components/master/combat-content/combat-content-workflow'
import { readCombatContentEventSample } from './combat-content-event-sample'

const ACTOR_ID = 'master-preview-actor'
const ALLY_ID = 'master-preview-ally'
const ENEMY_ID = 'master-preview-enemy'
const SECOND_ENEMY_ID = 'master-preview-enemy-2'
const PREVIEW_ROUND = 4
const ACTOR_POSITION = { x: 2, y: 1 } as const

export const DEFAULT_COMBAT_CONTENT_PREVIEW_SEED = 0x4d415354

export interface CombatContentPreviewOptions {
  readonly effectTimingPolicy?: CombatEffectTimingPolicy
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
  if (definition.target.geometryVersion === 3) {
    const categories = combatTargetCategories(definition.target)
    if (categories.includes('enemy')) return ENEMY_ID
    if (categories.includes('ally')) return ALLY_ID
    return categories.includes('self') ? ACTOR_ID : null
  }
  if (definition.target.kind !== 'unit') return null
  if (definition.target.teamPolicy === 'self') return ACTOR_ID
  if (definition.target.teamPolicy === 'ally') return ALLY_ID
  return ENEMY_ID
}

function previewDistance(definition: Pick<PreviewGeometry, 'target'>): number {
  if (definition.target.geometryVersion === 3) {
    if (definition.target.shape.kind !== 'single') return 1
    if (combatTargetCategories(definition.target).every((category) => category === 'self')) return 0
    // Other units need a distinct tile even when a zero-range draft cannot reach them.
    return Math.max(
      1,
      Math.min(Math.max(1, definition.target.minimumRange), definition.target.maximumRange),
    )
  }
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
  state: StatDrivenCombatEncounterState,
  targetOrigin: GridPosition,
): CombatTargetSelection {
  const groundFire =
    definition.target.geometryVersion !== 3 &&
    definition.target.kind === 'ground-tile' &&
    definition.target.teamPolicy === 'enemy' &&
    definition.groundFire === true
  if (definition.target.geometryVersion === 2 || definition.target.geometryVersion === 3) {
    if (definition.target.shape.kind === 'line')
      return { kind: 'direction', direction: 'east', ...(groundFire ? { ground: true } : {}) }
    if (definition.target.shape.kind === 'circle' || definition.target.shape.kind === 'all')
      return { kind: 'activate', ...(groundFire ? { ground: true } : {}) }
  }
  const preferred: CombatTargetSelection =
    definition.target.geometryVersion === 3 && primaryUnitId(definition) === null
      ? { kind: 'tile', position: { ...targetPosition } }
      : definition.target.kind === 'self'
        ? { kind: 'self' }
        : definition.target.kind === 'unit'
          ? { kind: 'unit', combatantId: primaryUnitId(definition) ?? ENEMY_ID }
          : { kind: 'tile', position: { ...targetPosition } }
  if (definition.target.geometryVersion === 3) {
    // Use the native target authority at the selected Move destination, without moving the fixture.
    const spatialState = {
      ...state,
      tactical: {
        ...state.tactical,
        placements: state.tactical.placements.map((row) =>
          row.combatantId === ACTOR_ID ? { ...row, position: targetOrigin } : row,
        ),
      },
    }
    const maximum = definition.target.maximumSelections ?? 1
    const seen = new Set<string>()
    const selections: Extract<CombatTargetSelection, { kind: 'self' | 'unit' | 'tile' }>[] = []
    for (const candidate of [
      preferred,
      ...enumerateCombatTargetSelections(spatialState, ACTOR_ID, definition.target),
    ]) {
      if (candidate.kind !== 'self' && candidate.kind !== 'unit' && candidate.kind !== 'tile')
        continue
      const identity =
        candidate.kind === 'self'
          ? `unit:${ACTOR_ID}`
          : candidate.kind === 'unit'
            ? `unit:${candidate.combatantId}`
            : `tile:${candidate.position.x}:${candidate.position.y}`
      if (seen.has(identity)) continue
      seen.add(identity)
      if (
        resolveCombatTargeting(
          spatialState,
          ACTOR_ID,
          definition.target,
          candidate,
          PV1F_COMBAT_CONTENT,
        ).issues.length
      )
        continue
      selections.push(candidate)
      if (selections.length === maximum) break
    }
    if (selections.length) return maximum > 1 ? { kind: 'selections', selections } : selections[0]!
  }
  return preferred
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
  timingPolicy?: CombatEffectTimingPolicy,
): {
  readonly state: StatDrivenCombatEncounterState
  readonly selection: CombatTargetSelection
} {
  const targetPosition = previewTargetPosition(definition, targetOrigin)
  const primaryId = primaryUnitId(definition)
  const width = Math.max(10, targetPosition.x + 8)

  const allyPosition =
    primaryId === ALLY_ID ||
    (definition.target.geometryVersion === 3 &&
      primaryId === null &&
      combatTargetCategories(definition.target).includes('ground') &&
      definition.target.friendlyFire === 'allies-only')
      ? targetPosition
      : ({ x: 0, y: 0 } satisfies GridPosition)
  const enemyOccupiesGround =
    definition.target.geometryVersion === 3
      ? primaryId === null &&
        combatTargetCategories(definition.target).includes('ground') &&
        definition.target.friendlyFire !== 'allies-only'
      : definition.target.kind === 'ground-tile' && definition.target.teamPolicy !== 'ally'
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
    ...(timingPolicy ? { effectTimingPolicy: structuredClone(timingPolicy) } : {}),
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
    modularSkillPolicyVersion: 1 as const,
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

  const state = createDuelBalancedCombatEncounterState(withFixtureState, [
    profile(ACTOR_ID),
    profile(ALLY_ID),
    profile(ENEMY_ID, { evasion: 1_500 }),
    profile(SECOND_ENEMY_ID, { evasion: 2_000 }),
  ])
  return {
    state,
    selection: previewSelection(definition, targetPosition, state, targetOrigin),
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
  manualModifiers?: readonly ManualCombatModifierSelection[],
) {
  behavior = applyAbilityTimingDefaults(behavior, state.effectTimingPolicy)
  let prepared = preparePv1fTurnEconomy(state)
  if (
    !prepared.effectTimingPolicy &&
    behavior.effects.some((effect) => effect.payload.type === 'summon')
  ) {
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
      ...(manualModifiers ? { manualModifiers } : {}),
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
    ...(manualModifiers ? { manualModifiers } : {}),
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

function projectPreviewSummon(
  summonProfile: NonNullable<MatureSkillDefinition['summonProfile']>,
  spawnPosition: GridPosition,
) {
  return {
    spawnPosition: { ...spawnPosition },
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
    undefined,
    options.effectTimingPolicy,
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
    ? previewState(geometryDefinition, seed, movementPath?.at(-1), options.effectTimingPolicy)
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
      ? projectPreviewSummon(
          summonProfile,
          selection.kind === 'tile' ? selection.position : previewTargetPosition(definition),
        )
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
  const fixture = previewState(geometry, seed, movementPath?.at(-1), options.effectTimingPolicy)
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
  return projectCanonicalPreview(definition, behavior, seed, fixture.selection, evaluated)
}

function projectCanonicalPreview(
  definition: Pick<PreviewGeometry, 'id' | 'contentVersion'>,
  behavior: { readonly id: string; readonly targeting: CombatActionDefinition['target'] | null },
  seed: number,
  selection: CombatTargetSelection,
  evaluated: Pick<
    ReturnType<typeof evaluateCanonicalPreview>,
    'prepared' | 'action' | 'evaluation' | 'cost' | 'costs' | 'preparation'
  > &
    Partial<Pick<ReturnType<typeof evaluateCanonicalPreview>, 'summon' | 'movement'>>,
) {
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
      selection: structuredClone(selection),
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
    summon: evaluated.summon
      ? projectPreviewSummon(evaluated.summon.input.profile, evaluated.summon.input.position)
      : null,
    vengeanceBasis: evaluated.evaluation.vengeanceBasis?.map((row) => structuredClone(row)) ?? [],
    conditionalEffects: sensoryConditions({ effects: evaluated.action.effects }),
    repeatPenaltyApplied: false,
  }
}

export function previewResonanceCombatContentDefinition(
  definition: AnyResonanceDefinition,
  options: CombatContentPreviewOptions = {},
) {
  const seed = options.seed ?? DEFAULT_COMBAT_CONTENT_PREVIEW_SEED
  assertPreviewSeed(seed)
  const behavior = definition.ability?.behaviors.find((row) => row.id === options.behaviorId)
  if (
    !behavior ||
    behavior.activation !== 'manual' ||
    behavior.mode !== 'action' ||
    !behavior.targeting
  )
    throw new TypeError('Resonance preview requires a selected Manual action group.')
  const movementPath = previewMovementPath(behavior)
  const fixture = previewState(
    {
      id: definition.id,
      contentVersion: definition.contentVersion,
      target: behavior.targeting,
      groundFire: behavior.effects.some(
        (effect) => effect.payload.type === 'damage' && effect.payload.element === 'fire',
      ),
    },
    seed,
    movementPath?.at(-1),
    options.effectTimingPolicy,
  )
  const source = capturedResonanceAbilitySource(
    fixture.state,
    ACTOR_ID,
    definition,
    definition.disciplinePair,
  )
  if (!source) throw new TypeError('Resonance preview requires a canonical Ability definition.')
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(fixture.state, [source]),
    fixture.state.statBridge,
  )
  const rngBefore = structuredClone(state.tactical.battle.rng)
  const evaluated = evaluateCanonicalPreview(
    state,
    source,
    behavior,
    fixture.selection,
    movementPath,
  )
  if (!sameRng(rngBefore, evaluated.prepared.tactical.battle.rng))
    throw new Error('Resonance preview must not consume battle RNG.')
  return projectCanonicalPreview(definition, behavior, seed, fixture.selection, evaluated)
}

/** A modifier is quoted only as part of a real, separately captured reference action. */
export function previewModifierCombatContentDefinition(
  definition: MatureSkillDefinition | AnyResonanceDefinition,
  reference: MatureSkillDefinition | BasicSkillDefinition,
  options: CombatContentPreviewOptions & { readonly rootBehaviorId?: string } = {},
) {
  const seed = options.seed ?? DEFAULT_COMBAT_CONTENT_PREVIEW_SEED
  assertPreviewSeed(seed)
  const modifier = definition.ability?.behaviors.find((row) => row.id === options.behaviorId)
  if (
    !modifier ||
    (modifier.activation !== 'manual' && modifier.activation !== 'ongoing') ||
    modifier.mode !== 'modifier'
  )
    throw new TypeError('Modifier preview requires a selected Manual or Ongoing modifier group.')
  const rootBehavior = reference.ability?.behaviors.find((row) => row.id === options.rootBehaviorId)
  const target = rootBehavior?.targeting ?? ('target' in reference ? reference.target : null)
  if (!target) throw new TypeError('Modifier preview requires reference action targeting.')
  const movementPath = rootBehavior ? previewMovementPath(rootBehavior) : undefined
  const fixture = previewState(
    {
      id: definition.id,
      contentVersion: definition.contentVersion,
      target,
      groundFire: rootBehavior
        ? rootBehavior.effects.some(
            (effect) => effect.payload.type === 'damage' && effect.payload.element === 'fire',
          )
        : 'effects' in reference &&
          reference.effects.some((effect) => effect.type === 'damage' && effect.element === 'fire'),
    },
    seed,
    movementPath?.at(-1),
    options.effectTimingPolicy,
  )
  const modifierSource =
    'disciplinePair' in definition
      ? capturedResonanceAbilitySource(
          fixture.state,
          ACTOR_ID,
          definition,
          definition.disciplinePair,
        )
      : capturedMatureSkillAbilitySource(fixture.state, definition, ACTOR_ID)
  const rootSource =
    'execution' in reference
      ? captureBasicSkillSources({
          ownerCombatantId: ACTOR_ID,
          supportActionId: parseSupportActionId(reference.id) ?? 'basic.guard',
          definitions: defaultBasicSkills().map((row) =>
            row.id === reference.id ? reference : row,
          ),
        }).find((row) => row.abilityId === reference.id)
      : capturedMatureSkillAbilitySource(fixture.state, reference, ACTOR_ID)
  if (!modifierSource) throw new TypeError('A canonical modifier source is required.')
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(fixture.state, [
      ...(rootSource ? [rootSource] : []),
      modifierSource,
    ]),
    fixture.state.statBridge,
  )
  const rngBefore = structuredClone(state.tactical.battle.rng)
  const manualModifiers =
    modifier.activation === 'manual'
      ? [{ sourceInstanceId: modifierSource.sourceInstanceId, behaviorId: modifier.id }]
      : []
  const referenceAction = {
    id: reference.id,
    contentVersion: reference.contentVersion,
    ...(rootBehavior ? { behaviorId: rootBehavior.id } : {}),
  }
  const identity = {
    actionId: definition.id,
    behaviorId: modifier.id,
    contentVersion: definition.contentVersion,
    referenceAction,
    modifier: { activation: modifier.activation, mode: modifier.mode },
  }
  try {
    const evaluated =
      rootSource && rootBehavior
        ? evaluateCanonicalPreview(
            state,
            rootSource,
            rootBehavior,
            fixture.selection,
            movementPath,
            manualModifiers,
          )
        : (() => {
            if ('execution' in reference) throw new TypeError('Canonical Basic reference required.')
            const native = evaluatePv1fMatureSkill(
              state,
              reference,
              fixture.selection,
              options.combatContext ?? 'pve',
              { manualModifiers },
            )
            return { ...native, costs: native.quote?.costs ?? [], preparation: undefined }
          })()
    if (!sameRng(rngBefore, evaluated.prepared.tactical.battle.rng))
      throw new Error('Modifier preview must not consume battle RNG.')
    return {
      ...projectCanonicalPreview(
        definition,
        { id: modifier.id, targeting: target },
        seed,
        fixture.selection,
        evaluated,
      ),
      ...identity,
    }
  } catch (error) {
    // Native composition rejects an explicit incompatible/unqualified modifier before quoting.
    // Do not fabricate an unmodified successful result, costs, or damage for that command.
    if (
      !(error instanceof TypeError) ||
      !['modifier-requirement-not-met', 'modifier-root-incompatible'].includes(error.message)
    )
      throw error
    return {
      ...identity,
      legal: false,
      costs: undefined,
      groundAreas: [],
      targeting: {
        target: structuredClone(target),
        selection: structuredClone(fixture.selection),
        affectedTiles: [] as GridPosition[],
        affectedCombatantIds: [] as string[],
      },
      projections: { effects: [], terrain: [], events: [] } as ReturnType<
        typeof projectCanonicalPreview
      >['projections'],
      issues: [
        {
          code: error.message,
          message:
            error.message === 'modifier-requirement-not-met'
              ? 'The selected modifier Requirements are not met by this sample command.'
              : 'The selected modifier is incompatible with this reference action.',
        },
      ],
      simulation: { seed, actorCombatantId: ACTOR_ID, rngConsumed: false as const },
    }
  }
}

/** Commit one command only in a new local fixture; native dispatch owns every reaction. */
export function previewAutomaticCombatContentDefinition(
  definition: MatureSkillDefinition | AnyResonanceDefinition,
  reference: MatureSkillDefinition | BasicSkillDefinition,
  options: CombatContentPreviewOptions & {
    readonly rootBehaviorId?: string
    readonly eventSample?: CombatContentEventSample
  } = {},
) {
  const seed = options.seed ?? DEFAULT_COMBAT_CONTENT_PREVIEW_SEED
  assertPreviewSeed(seed)
  const scenario = readCombatContentEventSample(options.eventSample)
  const behavior = definition.ability?.behaviors.find((row) => row.id === options.behaviorId)
  if (!behavior || behavior.activation !== 'automatic' || behavior.mode !== 'action')
    throw new TypeError('Event preview requires a selected Automatic action group.')
  const rootBehavior = reference.ability?.behaviors.find((row) => row.id === options.rootBehaviorId)
  const target = rootBehavior?.targeting ?? ('target' in reference ? reference.target : null)
  if (!target) throw new TypeError('Event preview requires reference action targeting.')
  const movementPath = rootBehavior ? previewMovementPath(rootBehavior) : undefined
  const fixture = previewState(
    {
      id: definition.id,
      contentVersion: definition.contentVersion,
      target,
      groundFire: rootBehavior
        ? rootBehavior.effects.some(
            (effect) => effect.payload.type === 'damage' && effect.payload.element === 'fire',
          )
        : 'effects' in reference &&
          reference.effects.some((effect) => effect.type === 'damage' && effect.element === 'fire'),
    },
    seed,
    movementPath?.at(-1),
    options.effectTimingPolicy,
  )
  const ownerId = scenario.referenceActor === 'owner' ? ACTOR_ID : ENEMY_ID
  let sample = {
    ...fixture.state,
    tactical: {
      ...fixture.state.tactical,
      battle: {
        ...fixture.state.tactical.battle,
        combatants: fixture.state.tactical.battle.combatants.map((unit) =>
          unit.id !== ownerId
            ? unit
            : {
                ...unit,
                hp: Math.max(1, Math.floor((unit.maxHp * scenario.ownerHpPercent) / 100)),
                mp: Math.floor((unit.maxMp * scenario.ownerMpPercent) / 100),
              },
        ),
      },
    },
  }
  if (scenario.ownerStatus === 'poison') {
    const poison = PV1F_COMBAT_CONTENT.statuses.find((row) => row.id === 'poison')!
    sample = {
      ...sample,
      statusState: sample.statusState.map((row) =>
        row.combatantId !== ownerId
          ? row
          : {
              ...row,
              statuses: [
                ...row.statuses,
                {
                  statusId: poison.id,
                  statusVersion: poison.version,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: ownerId === ACTOR_ID ? ENEMY_ID : ACTOR_ID,
                },
              ],
            },
      ),
    }
  }
  const source =
    'disciplinePair' in definition
      ? capturedResonanceAbilitySource(sample, ownerId, definition, definition.disciplinePair)
      : capturedMatureSkillAbilitySource(sample, definition, ownerId)
  const rootSource =
    'execution' in reference
      ? captureBasicSkillSources({
          ownerCombatantId: ACTOR_ID,
          supportActionId: parseSupportActionId(reference.id) ?? 'basic.guard',
          definitions: defaultBasicSkills().map((row) =>
            row.id === reference.id ? reference : row,
          ),
        }).find((row) => row.abilityId === reference.id)
      : capturedMatureSkillAbilitySource(sample, reference, ACTOR_ID)
  if (!source) throw new TypeError('A canonical Automatic source is required.')
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(sample, [...(rootSource ? [rootSource] : []), source]),
    fixture.state.statBridge,
  )
  const evaluated =
    rootSource && rootBehavior
      ? evaluateCanonicalPreview(state, rootSource, rootBehavior, fixture.selection, movementPath)
      : (() => {
          if ('execution' in reference) throw new TypeError('Canonical Basic reference required.')
          const native = evaluatePv1fMatureSkill(
            state,
            reference,
            fixture.selection,
            options.combatContext ?? 'pve',
          )
          return { ...native, costs: native.quote?.costs ?? [], preparation: undefined }
        })()
  const forecast = projectCanonicalPreview(
    reference,
    { id: rootBehavior?.id ?? evaluated.action.id, targeting: target },
    seed,
    fixture.selection,
    evaluated,
  )
  const beforeRng = structuredClone(evaluated.prepared.tactical.battle.rng)
  // This clone has no connection to any persisted encounter or real player's RNG.
  const copy = reattachStatDrivenCombatBridge(
    structuredClone(evaluated.prepared),
    evaluated.prepared.statBridge,
  )
  const result = !evaluated.evaluation.legal
    ? { state: copy, events: [] }
    : rootSource && rootBehavior
      ? commitCombatAbilityCommand({
          state: copy,
          actorId: ACTOR_ID,
          root: { kind: 'canonical', source: rootSource, behaviorId: rootBehavior.id },
          selection: fixture.selection,
          ...(movementPath ? { movementPath } : {}),
          content: PV1F_COMBAT_CONTENT,
          context: combatAbilityCommandContext(copy, rootSource),
        })
      : (() => {
          if ('execution' in reference) throw new TypeError('Canonical Basic reference required.')
          return executePv1fMatureSkill(
            copy,
            reference,
            fixture.selection,
            options.combatContext ?? 'pve',
          )
        })()
  const finalState = reattachStatDrivenCombatBridge(
    result.state,
    (result.state as Partial<StatDrivenCombatEncounterState>).statBridge ??
      evaluated.prepared.statBridge,
  )
  const before = evaluated.prepared.tactical.battle.combatants.find((unit) => unit.id === ownerId)!
  const after = finalState.tactical.battle.combatants.find((unit) => unit.id === ownerId)!
  const usageKey = combatAbilityUsageKey(copy, source, behavior)
  return {
    ...forecast,
    actionId: definition.id,
    contentVersion: definition.contentVersion,
    behaviorId: behavior.id,
    referenceAction: {
      id: reference.id,
      contentVersion: reference.contentVersion,
      ...(rootBehavior ? { behaviorId: rootBehavior.id } : {}),
    },
    simulation: {
      ...forecast.simulation,
      localFixtureOnly: true,
      rngConsumed: !sameRng(beforeRng, result.state.tactical.battle.rng),
    },
    eventSample: {
      ran: evaluated.evaluation.legal,
      scenario,
      activated: result.state.abilityRuntime?.usage.some((row) => row.key === usageKey) ?? false,
      ownerStatusChanges: result.events.flatMap((event) => {
        if (
          typeof event !== 'object' ||
          event === null ||
          !('event' in event) ||
          !['status_applied', 'status_removed'].includes(event.event as string) ||
          !('targetCombatantId' in event) ||
          event.targetCombatantId !== ownerId ||
          !('statusId' in event) ||
          typeof event.statusId !== 'string'
        )
          return []
        return [
          {
            kind: event.event === 'status_removed' ? ('removed' as const) : ('applied' as const),
            statusId: event.statusId,
            name: combatStatusDetails(event.statusId).name,
          },
        ]
      }),
      eventTypes: [
        ...new Set(
          result.events.flatMap((event) =>
            typeof event === 'object' &&
            event !== null &&
            'event' in event &&
            typeof event.event === 'string'
              ? [event.event]
              : [],
          ),
        ),
      ],
      owner: {
        hpBefore: before.hp,
        hpAfter: after.hp,
        maxHp: after.maxHp,
        mpBefore: before.mp,
        mpAfter: after.mp,
        maxMp: after.maxMp,
        apBefore: readPv1fActionEconomy(evaluated.prepared, ownerId)?.current ?? 0,
        apAfter: readPv1fActionEconomy(finalState, ownerId)?.current ?? 0,
        barrierBefore: currentBarrierAmount(evaluated.prepared, ownerId),
        barrierAfter: currentBarrierAmount(result.state, ownerId),
      },
    },
  }
}

export type CombatContentPreviewResult =
  | ReturnType<typeof previewHistoricalResonanceCombatContentDefinition>
  | ReturnType<typeof previewAutomaticCombatContentDefinition>
  | ReturnType<typeof previewModifierCombatContentDefinition>
  | ReturnType<typeof previewCombatContentDefinition>
  | ReturnType<typeof previewBasicCombatContentDefinition>
  | ReturnType<typeof previewResonanceCombatContentDefinition>

function historicalSampleResources(state: StatDrivenCombatEncounterState, id: string) {
  const unit = state.tactical.battle.combatants.find((row) => row.id === id)
  if (!unit) return { present: false, hp: null, mp: null, ap: null, barrier: null }
  return {
    present: true,
    hp: unit.hp,
    mp: unit.mp,
    ap: readPv1fActionEconomy(state, id)?.current ?? 0,
    barrier: currentBarrierAmount(state, id),
  }
}

function historicalResonanceEvents(events: readonly unknown[]) {
  return events.flatMap<{
    event: ResonanceCombatEvent['event']
    resonanceId: string
    contentVersion: number
    setupActionId: string | null
    triggerActionId?: string
    interruptedByActionId?: string
  }>((event) => {
    if (typeof event !== 'object' || event === null || !('event' in event)) return []
    if (
      !['resonance_armed', 'resonance_activated', 'resonance_expired'].includes(String(event.event))
    )
      return []
    const row = event as ResonanceCombatEvent
    // Explicit public projection: never forward arbitrary native event fields.
    const identity = { resonanceId: row.resonanceId, contentVersion: row.contentVersion }
    if (row.event === 'resonance_armed')
      return [{ ...identity, event: row.event, setupActionId: row.setupActionId }]
    if (row.event === 'resonance_activated')
      return [
        {
          ...identity,
          event: row.event,
          setupActionId: row.setupActionId,
          triggerActionId: row.triggerActionId,
        },
      ]
    return [
      {
        ...identity,
        event: row.event,
        setupActionId: row.setupActionId,
        interruptedByActionId: row.interruptedByActionId,
      },
    ]
  })
}

/** Actual commands in one isolated turn; this does not forecast or simulate later turns. */
export function previewHistoricalResonanceCombatContentDefinition(
  definition: AnyResonanceDefinition,
  trigger: MatureSkillDefinition,
  options: CombatContentPreviewOptions & { readonly setup?: MatureSkillDefinition } = {},
) {
  const seed = options.seed ?? DEFAULT_COMBAT_CONTENT_PREVIEW_SEED
  assertPreviewSeed(seed)
  const mechanics = normalizedResonanceMechanics(definition)
  if (
    !definition.enabled ||
    trigger.ability ||
    options.setup?.ability ||
    !trigger.enabled ||
    (options.setup && !options.setup.enabled)
  )
    throw new TypeError('Historical sample requires enabled native content.')
  if (mechanics.mode === 'sequence' ? !options.setup : options.setup !== undefined)
    throw new TypeError(
      'Historical sequence samples require a setup Skill; immediate samples do not.',
    )
  const fixture = previewState(
    {
      ...trigger,
      groundFire: trigger.effects.some(
        (effect) => effect.type === 'damage' && effect.element === 'fire',
      ),
    },
    seed,
    undefined,
    options.effectTimingPolicy,
  )
  let state = preparePv1fTurnEconomy(fixture.state)
  let resonanceState = createResonanceCombatState(definition)
  const initialRng = structuredClone(state.tactical.battle.rng)
  const references = options.setup ? [options.setup, trigger] : [trigger]
  const steps = []
  for (const skill of references) {
    const geometry = {
      ...skill,
      groundFire: skill.effects.some(
        (effect) => effect.type === 'damage' && effect.element === 'fire',
      ),
    }
    const selection = previewSelection(
      geometry,
      previewTargetPosition(skill),
      state,
      ACTOR_POSITION,
    )
    const before = state
    let issues: { code: string; message: string }[] = []
    let costs: { actionEconomy: number; mp: number } | undefined
    let events: readonly unknown[] = []
    if (!state.tactical.battle.currentTurn) {
      issues = [
        { code: 'sample-turn-unavailable', message: 'The sample no longer has an active turn.' },
      ]
    } else {
      const context = options.combatContext ?? 'pve'
      const base = evaluatePv1fMatureSkill(state, skill, selection, context)
      const forecast = constrainResonanceForecastToTarget(
        forecastResonanceForSkill(definition, resonanceState, skill),
        skill,
        selection,
        base.evaluation.affectedCombatantIds,
      )
      // Match the native adapter's augmented action, including Result targeting/legality.
      const evaluated = forecast.willActivate
        ? evaluatePv1fMatureSkill(
            state,
            { ...skill, effects: [...skill.effects, ...forecast.bonusEffects] },
            selection,
            context,
          )
        : base
      const ap = readPv1fActionEconomy(evaluated.prepared, ACTOR_ID)?.current ?? 0
      issues = evaluated.evaluation.issues.map((row) => ({ code: row.code, message: row.message }))
      if (ap < evaluated.cost)
        issues.push({
          code: 'insufficient-action-economy',
          message: 'Not enough Action Economy remains in this same-turn sample.',
        })
      costs = { actionEconomy: evaluated.cost, mp: evaluated.evaluation.mpCost }
      if (evaluated.evaluation.legal && issues.length === 0) {
        const result = executePv1fMatureSkillWithResonance({
          state,
          resonance: definition,
          resonanceState,
          skill,
          combatContext: context,
          selection,
        })
        state = reattachStatDrivenCombatBridge(
          result.state,
          result.state.statBridge ?? state.statBridge,
        )
        resonanceState = result.resonanceState
        events = result.events
      }
    }
    const ids = new Set([
      ...before.tactical.battle.combatants.map((unit) => unit.id),
      ...state.tactical.battle.combatants.map((unit) => unit.id),
    ])
    const resources = [...ids].map((id) => {
      const old = historicalSampleResources(before, id)
      const next = historicalSampleResources(state, id)
      return {
        id,
        presentBefore: old.present,
        presentAfter: next.present,
        hpBefore: old.hp,
        hpAfter: next.hp,
        mpBefore: old.mp,
        mpAfter: next.mp,
        apBefore: old.ap,
        apAfter: next.ap,
        barrierBefore: old.barrier,
        barrierAfter: next.barrier,
      }
    })
    steps.push({
      referenceAction: { id: skill.id, contentVersion: skill.contentVersion },
      legal: issues.length === 0,
      ran: issues.length === 0,
      issues,
      ...(costs ? { costs } : {}),
      selection: structuredClone(selection),
      combatants: resources,
      owner: resources.find((unit) => unit.id === ACTOR_ID)!,
      resonanceEvents: historicalResonanceEvents(events),
    })
    if (issues.length) break
  }
  const emptyProjections: ReturnType<typeof projectCanonicalPreview>['projections'] = {
    effects: [],
    terrain: [],
    events: [],
  }
  return {
    actionId: definition.id,
    contentVersion: definition.contentVersion,
    legal: steps.length === references.length && steps.every((step) => step.legal),
    issues: steps.flatMap((step) => step.issues),
    derivedTags: [],
    simulation: {
      seed,
      actorCombatantId: ACTOR_ID,
      localFixtureOnly: true,
      rngConsumed: !sameRng(initialRng, state.tactical.battle.rng),
    },
    groundAreas: [],
    targeting: {
      target: structuredClone(trigger.target),
      selection: structuredClone(fixture.selection),
      affectedTiles: [],
      affectedCombatantIds: [],
    },
    costs: undefined,
    accuracy: { targetHitChances: [], projectionsAssumeHits: false },
    projections: emptyProjections,
    summon: null,
    vengeanceBasis: [],
    conditionalEffects: [],
    repeatPenaltyApplied: false,
    historicalSample: {
      mode: mechanics.mode,
      sameTurnOnly: true,
      activated: steps.some((step) =>
        step.resonanceEvents.some((event) => event.event === 'resonance_activated'),
      ),
      armedByActionId: resonanceState.armedByActionId,
      steps,
    },
  }
}
