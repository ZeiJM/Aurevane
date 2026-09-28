import {
  validateBattleState,
  type BattleCombatant,
  type BattleFacing,
  type BattleState,
} from './battle-state'
import {
  validateTacticalBattleState,
  type CombatMovementProfile,
  type CombatPlacement,
  type GridPosition,
  type TacticalBattleState,
} from './board'
import {
  normalizeCombatEffectState,
  type CombatEffectState,
  type CombatSummonInstance,
} from './combat-effect-state'
import {
  STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION,
  STAT_DRIVEN_COMBAT_RULES_VERSION,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfileV4,
} from './stat-driven-combat'
import {
  validateSummonProfileDefinition,
  type SummonProfileDefinition,
} from './summon-content'

export type CombatSummonRemovalReason = 'expired' | 'defeated'

export type CombatSummonEvent =
  | {
      readonly event: 'summon_spawned'
      readonly combatantId: string
      readonly ownerCombatantId: string
      readonly sourceSkillId: string
      readonly sourceSkillVersion: number
      readonly profileId: string
    }
  | {
      readonly event: 'summon_expired' | 'summon_defeated'
      readonly combatantId: string
      readonly ownerCombatantId: string
      readonly sourceSkillId: string
      readonly sourceSkillVersion: number
      readonly profileId: string
    }

export interface CombatSummonTransition {
  readonly state: StatDrivenCombatEncounterState
  readonly events: readonly CombatSummonEvent[]
}

export interface SpawnCombatSummonInput {
  readonly ownerCombatantId: string
  readonly sourceSkillId: string
  readonly sourceSkillVersion: number
  readonly profile: SummonProfileDefinition
  readonly position: GridPosition
  readonly facing: BattleFacing
}

function stableCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function positionsEqual(left: GridPosition, right: GridPosition): boolean {
  return left.x === right.x && left.y === right.y
}

function summonMovementProfileId(profileId: string): string {
  return `summon.${profileId}.movement`
}

function pinnedProfile(profile: SummonProfileDefinition): SummonProfileDefinition {
  return structuredClone(profile)
}

function nextSummonId(
  state: StatDrivenCombatEncounterState,
  input: SpawnCombatSummonInput,
): string {
  const existing = normalizeCombatEffectState(state.effectState).summons ?? []
  const ordinal =
    existing.filter(
      (row) =>
        row.ownerCombatantId === input.ownerCombatantId &&
        row.sourceSkillId === input.sourceSkillId &&
        row.sourceSkillVersion === input.sourceSkillVersion &&
        row.spawnedRound === state.tactical.battle.round,
    ).length + 1

  return `summon:${input.ownerCombatantId}:${input.sourceSkillId}:v${input.sourceSkillVersion}:r${state.tactical.battle.round}:t${state.tactical.battle.turnNumber}:${ordinal}`
}

function summonCombatant(
  combatantId: string,
  teamId: string,
  profile: SummonProfileDefinition,
): BattleCombatant {
  return {
    id: combatantId,
    teamId,
    kind: 'summon',
    initiative: profile.initiative,
    baseMovementBudget: profile.movementBudget,
    hp: profile.maxHp,
    maxHp: profile.maxHp,
    mp: profile.maxMp,
    maxMp: profile.maxMp,
    temporaryResources: [],
  }
}

function summonStatProfile(
  combatantId: string,
  profile: SummonProfileDefinition,
): StatDrivenCombatProfileV4 {
  return {
    combatantId,
    provenance: {
      kind: 'scenario',
      sourceId: profile.id,
      sourceRulesVersion: STAT_DRIVEN_COMBAT_RULES_VERSION,
    },
    accuracy: profile.stats.accuracy,
    evasion: profile.stats.evasion,
    armor: profile.stats.armor,
    ward: profile.stats.ward,
    jump: profile.stats.jump,
    level: 1,
    physicalPower: profile.stats.physicalPower,
    mysticPower: profile.stats.mysticPower,
    criticalChance: 0,
  }
}

function appendMovementProfile(
  state: TacticalBattleState,
  profile: SummonProfileDefinition,
): readonly CombatMovementProfile[] {
  const id = summonMovementProfileId(profile.id)
  if (state.movementProfiles.some((row) => row.id === id)) return state.movementProfiles
  return [
    ...state.movementProfiles,
    { id, maxElevationStep: profile.stats.jump, terrainCostOverrides: [] },
  ].sort((left, right) => stableCompare(left.id, right.id))
}

function assertCurrentStatBridge(state: StatDrivenCombatEncounterState): void {
  if (
    state.statBridge.schemaVersion !== STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION ||
    state.statBridge.rulesVersion !== STAT_DRIVEN_COMBAT_RULES_VERSION
  ) {
    throw new TypeError('Current summons require the current stat-driven combat bridge.')
  }
}

function assertSpawnTile(
  state: StatDrivenCombatEncounterState,
  position: GridPosition,
): void {
  const tile = state.tactical.tiles.find((candidate) => positionsEqual(candidate.position, position))
  if (!tile) throw new RangeError('Summon target must be a valid empty battle tile.')
  if (state.tactical.placements.some((row) => positionsEqual(row.position, position))) {
    throw new RangeError('Summon target tile is occupied; summons require empty ground.')
  }
  const terrain = state.tactical.terrains.find((candidate) => candidate.id === tile.terrainId)
  if (!terrain || terrain.traversalCost === null) {
    throw new RangeError('Summon target must be passable empty ground.')
  }
}

function assertValidSummonEncounter(state: StatDrivenCombatEncounterState): void {
  const battleIssues = validateBattleState(state.tactical.battle)
  const tacticalIssues = validateTacticalBattleState(state.tactical)
  const statIssues = validateStatDrivenCombatEncounterState(state)
  const issues = [
    ...battleIssues.map((issue) => `battle.${issue.field}: ${issue.message}`),
    ...tacticalIssues.map((issue) => `tactical.${issue.field}: ${issue.message}`),
    ...statIssues.map((issue) => `stat.${issue.field}: ${issue.message}`),
  ]
  if (issues.length > 0) {
    throw new TypeError(`Invalid summon encounter state: ${issues.join('; ')}`)
  }
}

export function spawnCombatSummon(
  state: StatDrivenCombatEncounterState,
  input: SpawnCombatSummonInput,
): CombatSummonTransition {
  if (state.tactical.battle.lifecycle !== 'active') {
    throw new Error('Summons can spawn only during an active battle.')
  }
  assertCurrentStatBridge(state)

  const summonIssues = validateSummonProfileDefinition(input.profile)
  if (summonIssues.length > 0) {
    throw new TypeError(`Invalid summon profile: ${summonIssues.join(', ')}.`)
  }
  if (!Number.isSafeInteger(input.sourceSkillVersion) || input.sourceSkillVersion < 1) {
    throw new RangeError('Summon source Skill version must be a positive safe integer.')
  }
  if (!input.sourceSkillId.trim()) throw new TypeError('Summon source Skill ID is required.')

  const owner = state.tactical.battle.combatants.find(
    (combatant) => combatant.id === input.ownerCombatantId,
  )
  if (!owner || owner.hp <= 0) throw new RangeError('Summon owner must be a living combatant.')

  assertSpawnTile(state, input.position)

  const combatantId = nextSummonId(state, input)
  const profile = pinnedProfile(input.profile)
  const movementProfileId = summonMovementProfileId(profile.id)
  const combatant = summonCombatant(combatantId, owner.teamId, profile)
  const effectState = normalizeCombatEffectState(state.effectState)
  const instance: CombatSummonInstance = {
    combatantId,
    ownerCombatantId: input.ownerCombatantId,
    sourceSkillId: input.sourceSkillId,
    sourceSkillVersion: input.sourceSkillVersion,
    profile,
    spawnedRound: state.tactical.battle.round,
    turnsCompleted: 0,
  }

  const battle: BattleState = {
    ...state.tactical.battle,
    combatants: [...state.tactical.battle.combatants, combatant],
    deferredInitiativeCombatantIds: [
      ...(state.tactical.battle.deferredInitiativeCombatantIds ?? []),
      combatantId,
    ].sort(stableCompare),
  }

  const placement: CombatPlacement = {
    combatantId,
    position: { ...input.position },
    facing: input.facing,
    movementProfileId,
  }

  const next: StatDrivenCombatEncounterState = {
    ...state,
    tactical: {
      ...state.tactical,
      battle,
      movementProfiles: appendMovementProfile(state.tactical, profile),
      placements: [...state.tactical.placements, placement].sort((left, right) =>
        stableCompare(left.combatantId, right.combatantId),
      ),
    },
    statBridge: {
      ...state.statBridge,
      combatants: [
        ...(state.statBridge.combatants as readonly StatDrivenCombatProfileV4[]),
        summonStatProfile(combatantId, profile),
      ].sort((left, right) => stableCompare(left.combatantId, right.combatantId)),
    },
    statusState: [
      ...state.statusState,
      { combatantId, statuses: [] },
    ].sort((left, right) => stableCompare(left.combatantId, right.combatantId)),
    effectState: {
      ...effectState,
      summons: [...(effectState.summons ?? []), instance].sort((left, right) =>
        stableCompare(left.combatantId, right.combatantId),
      ),
    },
  }

  assertValidSummonEncounter(next)

  return {
    state: next,
    events: [
      {
        event: 'summon_spawned',
        combatantId,
        ownerCombatantId: input.ownerCombatantId,
        sourceSkillId: input.sourceSkillId,
        sourceSkillVersion: input.sourceSkillVersion,
        profileId: profile.id,
      },
    ],
  }
}

function cleanupEffectState(effectState: CombatEffectState, combatantId: string): CombatEffectState {
  return {
    ...effectState,
    ongoingRecovery: effectState.ongoingRecovery.filter(
      (row) =>
        row.sourceCombatantId !== combatantId && row.targetCombatantId !== combatantId,
    ),
    poison: effectState.poison.filter(
      (row) =>
        row.sourceCombatantId !== combatantId && row.targetCombatantId !== combatantId,
    ),
    bleed: effectState.bleed.filter(
      (row) =>
        row.sourceCombatantId !== combatantId && row.targetCombatantId !== combatantId,
    ),
    burn: effectState.burn.filter(
      (row) =>
        row.sourceCombatantId !== combatantId && row.targetCombatantId !== combatantId,
    ),
    temporarySkills: effectState.temporarySkills.filter(
      (row) =>
        row.combatantId !== combatantId && row.sourceCombatantId !== combatantId,
    ),
    damageHistory: effectState.damageHistory.filter((row) => row.combatantId !== combatantId),
    ...(effectState.barriers === undefined
      ? {}
      : {
          barriers: effectState.barriers.filter(
            (row) =>
              row.sourceCombatantId !== combatantId && row.targetCombatantId !== combatantId,
          ),
        }),
    ...(effectState.summons === undefined
      ? {}
      : {
          summons: effectState.summons.filter((row) => row.combatantId !== combatantId),
        }),
  }
}

export function removeCombatSummon(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
  reason: CombatSummonRemovalReason,
): CombatSummonTransition {
  assertCurrentStatBridge(state)
  const effectState = normalizeCombatEffectState(state.effectState)
  const instance = (effectState.summons ?? []).find((row) => row.combatantId === combatantId)
  if (!instance) throw new RangeError(`Unknown active summon ${combatantId}.`)
  if (state.tactical.battle.currentTurn?.combatantId === combatantId) {
    throw new Error('Active summon removal must be resolved through the turn lifecycle.')
  }

  const initiativeOrder = state.tactical.battle.initiativeOrder.filter((id) => id !== combatantId)
  const currentTurn = state.tactical.battle.currentTurn
  const nextCurrentTurn =
    currentTurn === null
      ? null
      : {
          ...currentTurn,
          initiativeIndex: initiativeOrder.indexOf(currentTurn.combatantId),
        }
  if (nextCurrentTurn && nextCurrentTurn.initiativeIndex < 0) {
    throw new Error('Summon removal would orphan the active turn.')
  }

  const placements = state.tactical.placements.filter((row) => row.combatantId !== combatantId)
  const movementProfileId = summonMovementProfileId(instance.profile.id)
  const movementProfileStillUsed = placements.some(
    (row) => row.movementProfileId === movementProfileId,
  )

  const next: StatDrivenCombatEncounterState = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.filter((row) => row.id !== combatantId),
        initiativeOrder,
        deferredInitiativeCombatantIds: (
          state.tactical.battle.deferredInitiativeCombatantIds ?? []
        ).filter((id) => id !== combatantId),
        roundInitiativeModifiers: (state.tactical.battle.roundInitiativeModifiers ?? []).filter(
          (row) => row.combatantId !== combatantId,
        ),
        currentTurn: nextCurrentTurn,
      },
      placements,
      movementProfiles: movementProfileStillUsed
        ? state.tactical.movementProfiles
        : state.tactical.movementProfiles.filter((row) => row.id !== movementProfileId),
    },
    statBridge: {
      ...state.statBridge,
      combatants: state.statBridge.combatants.filter((row) => row.combatantId !== combatantId),
    },
    statusState: state.statusState.filter((row) => row.combatantId !== combatantId),
    effectState: cleanupEffectState(effectState, combatantId),
    ...(state.turnOrigin?.combatantId === combatantId ? { turnOrigin: undefined } : {}),
  }

  assertValidSummonEncounter(next)

  return {
    state: next,
    events: [
      {
        event: reason === 'expired' ? 'summon_expired' : 'summon_defeated',
        combatantId,
        ownerCombatantId: instance.ownerCombatantId,
        sourceSkillId: instance.sourceSkillId,
        sourceSkillVersion: instance.sourceSkillVersion,
        profileId: instance.profile.id,
      },
    ],
  }
}

export function advanceCombatSummonOwnerTurn(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
): CombatSummonTransition {
  const effectState = normalizeCombatEffectState(state.effectState)
  const instance = (effectState.summons ?? []).find((row) => row.combatantId === combatantId)
  if (!instance) throw new RangeError(`Unknown active summon ${combatantId}.`)

  const turnsCompleted = instance.turnsCompleted + 1
  if (turnsCompleted >= instance.profile.lifetimeTurns) {
    return removeCombatSummon(state, combatantId, 'expired')
  }

  const next: StatDrivenCombatEncounterState = {
    ...state,
    effectState: {
      ...effectState,
      summons: (effectState.summons ?? []).map((row) =>
        row.combatantId === combatantId ? { ...row, turnsCompleted } : row,
      ),
    },
  }
  assertValidSummonEncounter(next)
  return { state: next, events: [] }
}
