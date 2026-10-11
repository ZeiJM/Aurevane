import { combatEffectTimingRoundOffset } from './combat-effect-timing'
import { claimCombatTurnTrigger } from './combat-turn-trigger-state'
import {
  isPercentageDotEffect,
  validateCurrentPercentageDotAuthoring,
} from './combat-percentage-dots'
import { validateCombatEncounterState, combatSourceCommandVisibility } from './actions-legacy'
import type {
  CombatActionDefinition,
  CombatContentCatalog,
  CombatEffectOrigin,
  CombatSourceCommandVisibility,
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
import type { StatDrivenCombatProfile } from './stat-driven-combat'

export interface CombatGroundAreaDefinition {
  durationRounds: number
  visualPresetId: GroundVisualPresetId
  /** Original effect ordinals keep entry payloads aligned with authored cast effects. */
  entryEffectOrdinals: readonly number[]
  /** Omitted uses the pinned Ground timing policy, defaulting to next round. */
  timing?: 'instant' | 'next-round' | 'delayed'
}
export interface CombatGroundAreaInstance {
  /** Converted ice tiles retain the area schedule but no longer apply its ice entry payload. */
  steamTiles?: readonly GridPosition[]
  sourceCommandVisibility?: CombatSourceCommandVisibility
  entryEffectOrigins?: readonly (CombatEffectOrigin | null)[]
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
    statProfile?: StatDrivenCombatProfile
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
  'percentage-recovery',
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
  if (ground.timing !== undefined && !['instant', 'next-round', 'delayed'].includes(ground.timing))
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
  options?: { sourceCommandVisibility?: CombatSourceCommandVisibility },
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
  const activationRound = state.tactical.battle.round + combatEffectTimingRoundOffset(timing)
  const expiresAtRound = activationRound + action.groundArea.durationRounds
  if (!Number.isSafeInteger(expiresAtRound)) throw new RangeError('Ground expiry overflow.')
  const statProfile = state.statBridge?.combatants.find((unit) => unit.combatantId === actorId)
  const area: CombatGroundAreaInstance = JSON.parse(
    JSON.stringify({
      id: `ground.area.${ordinal}`,
      sourceCommandVisibility: options
        ? options.sourceCommandVisibility
        : combatSourceCommandVisibility(state, actorId),
      ...(action.effectOrigins
        ? {
            entryEffectOrigins: action.groundArea.entryEffectOrdinals.map(
              (index) => action.effectOrigins![index] ?? null,
            ),
          }
        : {}),
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
        area.activationRound > state.tactical.battle.round + 2 ||
        !Number.isSafeInteger(area.expiresAtRound) ||
        area.expiresAtRound <= area.activationRound ||
        area.expiresAtRound - area.activationRound > 4 ||
        area.expiresAtRound <= state.tactical.battle.round
      )
        throw new TypeError('Invalid Ground lifetime.')
      if (
        area.sourceCommandVisibility &&
        (area.sourceCommandVisibility.kind !== 'team-only' ||
          area.sourceCommandVisibility.teamId !== area.sourceTeamId)
      )
        throw new TypeError('Invalid Ground source visibility.')
      if (
        area.entryEffectOrigins &&
        (!Array.isArray(area.entryEffectOrigins) ||
          area.entryEffectOrigins.length !== area.entryEffects.length)
      )
        throw new TypeError('Invalid Ground effect origins.')
      validateGroundTiles(state, area.tiles)
      if (area.steamTiles) {
        if (state.elementalDamagePolicyVersion === undefined)
          throw new TypeError('Ice conversion requires its pinned policy.')
        validateGroundTiles(state, area.steamTiles)
        if (
          area.steamTiles.some(
            (tile: GridPosition) =>
              !area.tiles.some(
                (source: GridPosition) => source.x === tile.x && source.y === tile.y,
              ),
          )
        )
          throw new TypeError('Converted tiles must belong to their ice area.')
      }
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
        ...(area.entryEffectOrigins
          ? {
              effectOrigins: area.entryEffectOrigins.map(
                (origin: CombatEffectOrigin | null) => origin ?? undefined,
              ),
            }
          : {}),
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
  if (state.statBridge && profile === undefined)
    throw new TypeError('Missing frozen Ground stat profile.')
  if (profile !== undefined) {
    if (!profile || !nonnegative(profile.armor) || !nonnegative(profile.ward))
      throw new TypeError('Invalid frozen Ground defenses.')
    const required = ['accuracy', 'evasion', 'armor', 'ward', 'jump']
    const bridgeVersion = state.statBridge?.rulesVersion ?? 1
    if (bridgeVersion >= 2) required.push('physicalPower', 'mysticPower')
    if (bridgeVersion >= 3) required.push('level')
    if (bridgeVersion >= 4) required.push('criticalChance')
    if (state.statBalancePolicyVersion === 1) required.push('statusResistance')
    if (required.some((key) => !nonnegative(profile[key as keyof typeof profile])))
      throw new TypeError('Missing or invalid frozen Ground stat.')
    if (
      !profile.provenance ||
      !['scenario', 'character-derived'].includes(profile.provenance.kind) ||
      typeof profile.provenance.sourceId !== 'string' ||
      profile.provenance.sourceId.trim().length === 0 ||
      !Number.isSafeInteger(profile.provenance.sourceRulesVersion) ||
      profile.provenance.sourceRulesVersion < 1
    )
      throw new TypeError('Invalid frozen Ground stat provenance.')
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
        (value as number) >
          (key === 'accuracy' && state.statBalancePolicyVersion === 1
            ? 14000
            : key === 'statusResistance' && state.statBalancePolicyVersion === 1
              ? 1500
              : 10000)
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

/** Authoritative footprint/cycle gate shared by committed steps and read-only simulations. */
export function resolveCombatGroundEntry(
  state: CombatEncounterState,
  combatantId: string,
  position: GridPosition,
  resolver: (
    state: CombatEncounterState,
    area: CombatGroundAreaInstance,
    combatantId: string,
  ) => import('./actions').CombatResolutionTransition,
): import('./actions').CombatResolutionTransition {
  if (state.groundEffectPolicyVersion !== 1 || state.tactical.battle.lifecycle !== 'active')
    return { state, events: [] }
  let next = advanceCombatGroundAreas(state)
  const events: import('./actions').CombatResolutionEvent[] = []
  for (const area of next.groundAreas ?? []) {
    const unit = next.tactical.battle.combatants.find((row) => row.id === combatantId)
    if (!unit || unit.hp <= 0 || next.tactical.battle.lifecycle !== 'active') break
    if (
      area.steamTiles?.some((tile) => tile.x === position.x && tile.y === position.y) ||
      area.activationRound > next.tactical.battle.round ||
      !area.tiles.some((tile) => tile.x === position.x && tile.y === position.y) ||
      !groundAreaAllowsCombatant(area, unit)
    )
      continue
    const claim = claimCombatTurnTrigger(next, combatantId, `ground.entry.${area.id}`)
    next = claim.state
    if (!claim.allowed) continue
    const applied = resolver(next, area, combatantId)
    next = applied.state
    events.push(...applied.events)
  }
  return { state: next, events }
}

export function groundAreaAllowsCombatant(
  area: CombatGroundAreaInstance,
  unit: CombatEncounterState['tactical']['battle']['combatants'][number],
): boolean {
  const friendly = unit.teamId === area.sourceTeamId
  if (
    (area.target.teamPolicy === 'enemy' && friendly) ||
    (area.target.teamPolicy === 'ally' && !friendly) ||
    (area.target.teamPolicy === 'self' && unit.id !== area.sourceCombatantId)
  )
    return false
  return (
    area.target.friendlyFire === 'all-units' ||
    (area.target.friendlyFire === 'enemies-only' && !friendly) ||
    (area.target.friendlyFire === 'allies-only' && friendly) ||
    (area.target.friendlyFire === 'all-except-actor' && unit.id !== area.sourceCombatantId)
  )
}
