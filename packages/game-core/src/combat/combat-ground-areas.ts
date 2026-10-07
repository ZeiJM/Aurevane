import {
  isPercentageDotEffect,
  validateCurrentPercentageDotAuthoring,
} from './combat-percentage-dots'
import { validateCombatEncounterState } from './actions-legacy'
import type {
  CombatActionDefinition,
  CombatContentCatalog,
  CombatEffectDefinition,
  CombatEncounterIssue,
  CombatEncounterState,
  CombatStatusInstance,
  CombatTargetSpec,
} from './actions'
import {
  validateCombatActionDefinition,
  validateCombatContentCatalog,
} from './combat-authoring-validation'
import { isGroundVisualPresetId, type GroundVisualPresetId } from './combat-ground-visuals'
import type { GridPosition } from './board'

export interface CombatGroundAreaDefinition {
  durationRounds: number
  visualPresetId: GroundVisualPresetId
  /** Original effect ordinals keep entry payloads aligned with authored cast effects. */
  entryEffectOrdinals: readonly number[]
  /** Omitted uses the pinned Ground timing policy, defaulting to next round. */
  timing?: 'instant' | 'next-round'
}
export interface CombatGroundAreaInstance {
  id: string
  sourceCombatantId: string
  sourceTeamId: string
  sourceActionId: string
  sourceActionVersion: number
  target: CombatTargetSpec
  tiles: readonly GridPosition[]
  activationRound: number
  expiresAtRound: number
  visualPresetId: GroundVisualPresetId
  entryEffects: readonly CombatEffectDefinition[]
  /** Internal caster values and definitions must never be projected to battle viewers. */
  caster: {
    combatant: CombatEncounterState['tactical']['battle']['combatants'][number]
    placement: CombatEncounterState['tactical']['placements'][number]
    statuses: readonly CombatStatusInstance[]
    statProfile?: NonNullable<CombatEncounterState['statBridge']>['combatants'][number]
  }
  content: CombatContentCatalog
}

type GroundAuthoring = {
  groundArea?: CombatGroundAreaDefinition
  target: CombatTargetSpec
  effects: readonly { type: string; recipient: string }[]
}
const ENTRY_TYPES = new Set([
  'damage',
  'healing',
  'resource-change',
  'apply-status',
  'remove-status',
  'burn',
  'poison',
  'bleed',
  'barrier-change',
])
export function isCombatGroundEntryEffect(effect: { type: string; recipient: string }): boolean {
  return (
    ENTRY_TYPES.has(effect.type) && ['primary-unit', 'affected-units'].includes(effect.recipient)
  )
}
export function validateCombatGroundAreaDefinition(action: GroundAuthoring): void {
  const ground = action.groundArea
  if (ground === undefined) return
  if (!ground || action.target.kind !== 'ground-tile')
    throw new TypeError('Ground areas require Ground targeting.')
  if (
    !Number.isSafeInteger(ground.durationRounds) ||
    ground.durationRounds < 1 ||
    ground.durationRounds > 4
  )
    throw new RangeError('Ground duration must be one to four rounds.')
  if (!isGroundVisualPresetId(ground.visualPresetId))
    throw new TypeError('Ground visual must use a registered preset.')
  if (ground.timing !== undefined && !['instant', 'next-round'].includes(ground.timing))
    throw new TypeError('Invalid Ground timing.')
  if (
    !Array.isArray(ground.entryEffectOrdinals) ||
    ground.entryEffectOrdinals.length === 0 ||
    new Set(ground.entryEffectOrdinals).size !== ground.entryEffectOrdinals.length ||
    ground.entryEffectOrdinals.some(
      (index: number) =>
        !Number.isSafeInteger(index) ||
        index < 0 ||
        !action.effects[index] ||
        !isCombatGroundEntryEffect(action.effects[index]!),
    )
  )
    throw new TypeError('Ground entry must select distinct supported recipient effects.')
  const entryEffects = ground.entryEffectOrdinals.map(
    (index) => action.effects[index] as CombatEffectDefinition,
  )
  if (entryEffects.some(isPercentageDotEffect))
    validateCurrentPercentageDotAuthoring({
      tags: ['attack'],
      target: action.target,
      effects: entryEffects,
    })
}

export function createCombatGroundArea(
  state: CombatEncounterState,
  actorId: string,
  action: CombatActionDefinition,
  tiles: readonly GridPosition[],
  content: CombatContentCatalog,
): CombatEncounterState {
  if (
    state.groundEffectPolicyVersion !== 1 ||
    !action.groundArea ||
    state.tactical.battle.lifecycle !== 'active'
  )
    return state
  validateCombatGroundAreaDefinition(action)
  validateCombatActionDefinition(action, content)
  validateCombatContentCatalog(content)
  const actor = state.tactical.battle.combatants.find((unit) => unit.id === actorId)
  const placement = state.tactical.placements.find((unit) => unit.combatantId === actorId)
  if (!actor || !placement) throw new TypeError('Ground placement requires a pinned caster.')
  validateGroundTiles(state, tiles)
  const ordinal = state.nextGroundAreaId ?? 1
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal === Number.MAX_SAFE_INTEGER)
    throw new RangeError('Ground area identity overflow.')
  const timing =
    action.groundArea.timing ?? state.effectTimingPolicy?.modes['ground-area'] ?? 'next-round'
  const activationRound = state.tactical.battle.round + (timing === 'instant' ? 0 : 1)
  const expiresAtRound = activationRound + action.groundArea.durationRounds
  if (!Number.isSafeInteger(expiresAtRound)) throw new RangeError('Ground expiry overflow.')
  const statProfile = state.statBridge?.combatants.find((unit) => unit.combatantId === actorId)
  const area: CombatGroundAreaInstance = JSON.parse(
    JSON.stringify({
      id: `ground.area.${ordinal}`,
      sourceCombatantId: actorId,
      sourceTeamId: actor.teamId,
      sourceActionId: action.id,
      sourceActionVersion: action.version,
      target: action.target,
      tiles,
      activationRound,
      expiresAtRound,
      visualPresetId: action.groundArea.visualPresetId,
      entryEffects: action.groundArea.entryEffectOrdinals.map((index) => action.effects[index]!),
      caster: {
        combatant: actor,
        placement,
        statuses: state.statusState.find((row) => row.combatantId === actorId)?.statuses ?? [],
        ...(statProfile ? { statProfile } : {}),
      },
      content,
    }),
  )
  return {
    ...state,
    nextGroundAreaId: ordinal + 1,
    groundAreas: [...(state.groundAreas ?? []), area],
  }
}

export function advanceCombatGroundAreas(state: CombatEncounterState): CombatEncounterState {
  if (!state.groundAreas?.length) return state
  const remaining =
    state.tactical.battle.lifecycle === 'active'
      ? state.groundAreas.filter((area) => area.expiresAtRound > state.tactical.battle.round)
      : []
  if (remaining.length === state.groundAreas.length) return state
  // Discard expired area keys while retaining DoT claims for their complete turn cycle.
  const liveKeys = new Set(remaining.map((area) => `ground.entry.${area.id}`))
  return {
    ...state,
    groundAreas: remaining,
    ...(state.turnTriggerState
      ? {
          turnTriggerState: {
            ...state.turnTriggerState,
            combatants: state.turnTriggerState.combatants.map((row) => ({
              ...row,
              usedKeys: row.usedKeys.filter(
                (key) => !key.startsWith('ground.entry.') || liveKeys.has(key),
              ),
            })),
          },
        }
      : {}),
  }
}

function validateGroundTiles(state: CombatEncounterState, tiles: readonly GridPosition[]): void {
  if (
    !Array.isArray(tiles) ||
    tiles.length === 0 ||
    tiles.length > state.tactical.width * state.tactical.height
  )
    throw new TypeError('Ground footprint requires existing battlefield tiles.')
  const seen = new Set<string>()
  for (const tile of tiles) {
    if (
      !tile ||
      !Number.isSafeInteger(tile.x) ||
      !Number.isSafeInteger(tile.y) ||
      tile.x < 0 ||
      tile.y < 0 ||
      tile.x >= state.tactical.width ||
      tile.y >= state.tactical.height ||
      seen.has(`${tile.x},${tile.y}`) ||
      !state.tactical.tiles.some((row) => row.position.x === tile.x && row.position.y === tile.y)
    )
      throw new TypeError('Ground footprint has an invalid or duplicate tile.')
    seen.add(`${tile.x},${tile.y}`)
  }
}

export function validateCombatGroundAreas(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  const issues: CombatEncounterIssue[] = []
  if (state.groundEffectPolicyVersion !== undefined && state.groundEffectPolicyVersion !== 1)
    issues.push({ field: 'groundEffectPolicyVersion', message: 'Unsupported Ground policy.' })
  if (
    state.nextGroundAreaId !== undefined &&
    (!Number.isSafeInteger(state.nextGroundAreaId) || state.nextGroundAreaId < 1)
  )
    issues.push({ field: 'nextGroundAreaId', message: 'Invalid Ground identity counter.' })
  if (state.groundAreas === undefined) return issues
  if (
    !Array.isArray(state.groundAreas) ||
    (state.groundAreas.length > 0 &&
      (state.groundEffectPolicyVersion !== 1 || state.tactical.battle.lifecycle !== 'active'))
  )
    return [
      ...issues,
      { field: 'groundAreas', message: 'Ground state requires its active pinned policy.' },
    ]
  const ids = new Set<string>()
  for (const area of state.groundAreas) {
    try {
      if (
        !area ||
        !/^ground\.area\.[1-9][0-9]*$/.test(area.id) ||
        ids.has(area.id) ||
        !Number.isSafeInteger(Number(area.id.split('.').at(-1))) ||
        Number(area.id.split('.').at(-1)) >= (state.nextGroundAreaId ?? 1)
      )
        throw new TypeError('Invalid Ground identity.')
      ids.add(area.id)
      if (
        !state.tactical.battle.combatants.some((unit) => unit.id === area.sourceCombatantId) ||
        area.sourceCombatantId !== area.caster?.combatant?.id ||
        area.sourceTeamId !== area.caster.combatant.teamId ||
        area.caster.placement.combatantId !== area.sourceCombatantId ||
        !Array.isArray(area.caster.statuses) ||
        (area.caster.statProfile && area.caster.statProfile.combatantId !== area.sourceCombatantId)
      )
        throw new TypeError('Invalid Ground caster.')
      if (
        !Number.isSafeInteger(area.activationRound) ||
        area.activationRound < 1 ||
        area.activationRound > state.tactical.battle.round + 1 ||
        !Number.isSafeInteger(area.expiresAtRound) ||
        area.expiresAtRound <= area.activationRound ||
        area.expiresAtRound - area.activationRound > 4 ||
        area.expiresAtRound <= state.tactical.battle.round
      )
        throw new TypeError('Invalid Ground lifetime.')
      validateGroundTiles(state, area.tiles)
      validateCombatContentCatalog(area.content)
      validateGroundCaster(state, area)
      const action: CombatActionDefinition = {
        id: area.sourceActionId,
        version: area.sourceActionVersion,
        sourceType: 'discipline-skill',
        tags: [],
        target: area.target,
        cost: { spendsAction: false, mp: 0 },
        requirements: [],
        effects: area.entryEffects,
        groundArea: {
          durationRounds: area.expiresAtRound - area.activationRound,
          visualPresetId: area.visualPresetId,
          entryEffectOrdinals: area.entryEffects.map(
            (_: CombatEffectDefinition, index: number) => index,
          ),
        },
      }
      validateCombatGroundAreaDefinition(action)
      validateCombatActionDefinition(action, area.content)
    } catch (error) {
      issues.push({
        field: 'groundAreas',
        message: error instanceof Error ? error.message : 'Invalid Ground area.',
      })
    }
  }
  return issues
}

function validateGroundCaster(state: CombatEncounterState, area: CombatGroundAreaInstance): void {
  const actor = area.caster.combatant
  const nonnegative = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
  if (
    !nonnegative(actor.hp) ||
    !nonnegative(actor.maxHp) ||
    actor.maxHp === 0 ||
    actor.hp > actor.maxHp ||
    !nonnegative(actor.mp) ||
    !nonnegative(actor.maxMp) ||
    actor.mp > actor.maxMp ||
    !Number.isSafeInteger(actor.initiative) ||
    !nonnegative(actor.baseMovementBudget) ||
    typeof actor.teamId !== 'string' ||
    actor.teamId.trim().length === 0
  )
    throw new TypeError('Invalid frozen Ground combatant values.')
  const placement = area.caster.placement
  validateGroundTiles(state, [placement.position])
  if (
    !['north', 'east', 'south', 'west'].includes(placement.facing) ||
    !state.tactical.movementProfiles.some((profile) => profile.id === placement.movementProfileId)
  )
    throw new TypeError('Invalid frozen Ground placement.')
  const profile = area.caster.statProfile
  if (profile !== undefined) {
    if (!profile || !nonnegative(profile.armor) || !nonnegative(profile.ward))
      throw new TypeError('Invalid frozen Ground defenses.')
    for (const [key, value] of Object.entries(profile)) {
      if (
        [
          'armor',
          'ward',
          'level',
          'criticalChance',
          'statusResistance',
          'accuracy',
          'evasion',
          'physicalPower',
          'mysticPower',
          'jump',
        ].includes(key) &&
        !nonnegative(value)
      )
        throw new TypeError('Invalid frozen Ground stat.')
      if (
        ['criticalChance', 'statusResistance', 'accuracy', 'evasion'].includes(key) &&
        (value as number) > 10000
      )
        throw new TypeError('Invalid frozen Ground percentage.')
      if (key === 'level' && ((value as number) < 1 || (value as number) > 100))
        throw new TypeError('Invalid frozen Ground level.')
    }
  }
  for (const status of area.caster.statuses) {
    if (
      !status ||
      !area.content.statuses.some(
        (definition) =>
          definition.id === status.statusId && definition.version === status.statusVersion,
      )
    )
      throw new TypeError('Missing frozen Ground status definition.')
  }
  const snapshot = {
    ...state,
    groundAreas: undefined,
    statusState: state.statusState.map((row) =>
      row.combatantId === area.sourceCombatantId ? { ...row, statuses: area.caster.statuses } : row,
    ),
  }
  if (validateCombatEncounterState(snapshot).some((issue) => issue.field.startsWith('statusState')))
    throw new TypeError('Invalid frozen Ground status applications.')
}
