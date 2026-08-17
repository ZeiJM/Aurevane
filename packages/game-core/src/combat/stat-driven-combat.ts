import type { DerivedStatSnapshot } from '../character/derived-stats'
import { advanceBattleRng, spendAction, type BattleRngState } from './battle-state'
import {
  evaluateCombatAction,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatActionEvaluation,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatResolutionEvent,
  type CombatTargetSelection,
} from './actions'

export const STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION = 1 as const
export const STAT_DRIVEN_COMBAT_RULES_VERSION = 1 as const
export const COMBAT_BASIS_POINTS = 10_000 as const

export type CombatStatProvenanceKind = 'character-derived' | 'scenario'
export type CombatDefenseKind = 'armor' | 'ward'

export interface CombatStatProvenance {
  kind: CombatStatProvenanceKind
  sourceId: string
  sourceRulesVersion: number
}

export interface StatDrivenCombatProfile {
  combatantId: string
  provenance: CombatStatProvenance
  accuracy: number
  evasion: number
  armor: number
  ward: number
  jump: number
}

export interface StatDrivenCombatBridgeState {
  schemaVersion: typeof STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION
  rulesVersion: typeof STAT_DRIVEN_COMBAT_RULES_VERSION
  combatants: readonly StatDrivenCombatProfile[]
}

export interface StatDrivenCombatEncounterState extends CombatEncounterState {
  statBridge: StatDrivenCombatBridgeState
}

export interface StatDrivenAttackForecast {
  evaluation: CombatActionEvaluation
  hitChanceBasisPoints: number | null
  defenseKind: CombatDefenseKind
  defenseRating: number | null
  mitigatedBaseDamage: number | null
}

export type StatDrivenCombatResolutionEvent =
  | CombatResolutionEvent
  | {
      event: 'stat_driven_attack_resolved'
      actorId: string
      targetId: string
      hitChanceBasisPoints: number
      rollBasisPoints: number
      hit: boolean
      defenseKind: CombatDefenseKind
      defenseRating: number
      rulesVersion: typeof STAT_DRIVEN_COMBAT_RULES_VERSION
    }

export interface StatDrivenCombatTransition {
  state: StatDrivenCombatEncounterState
  events: readonly StatDrivenCombatResolutionEvent[]
}

export interface StatDrivenCombatIssue {
  field: string
  message: string
}

export function createCharacterDerivedCombatProfile(
  combatantId: string,
  characterId: string,
  snapshot: DerivedStatSnapshot,
): StatDrivenCombatProfile {
  return {
    combatantId,
    provenance: {
      kind: 'character-derived',
      sourceId: `character:${characterId}`,
      sourceRulesVersion: snapshot.rulesVersion,
    },
    accuracy: snapshot.stats.accuracy.value,
    evasion: snapshot.stats.evasion.value,
    armor: snapshot.stats.armor.value,
    ward: snapshot.stats.ward.value,
    jump: snapshot.stats.jump.value,
  }
}

export function createStatDrivenCombatEncounterState(
  base: CombatEncounterState,
  profiles: readonly StatDrivenCombatProfile[],
): StatDrivenCombatEncounterState {
  const state: StatDrivenCombatEncounterState = {
    ...base,
    statBridge: {
      schemaVersion: STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION,
      rulesVersion: STAT_DRIVEN_COMBAT_RULES_VERSION,
      combatants: [...profiles]
        .map(copyProfile)
        .sort((left, right) => compareStableString(left.combatantId, right.combatantId)),
    },
  }

  assertValidStatDrivenCombatEncounterState(state)
  return state
}

export function reattachStatDrivenCombatBridge(
  base: CombatEncounterState,
  bridge: StatDrivenCombatBridgeState,
): StatDrivenCombatEncounterState {
  return createStatDrivenCombatEncounterState(base, bridge.combatants)
}

export function validateStatDrivenCombatEncounterState(
  state: StatDrivenCombatEncounterState,
): readonly StatDrivenCombatIssue[] {
  const issues: StatDrivenCombatIssue[] = validateCombatEncounterState(state).map((issue) => ({
    field: issue.field,
    message: issue.message,
  }))

  if (state.statBridge?.schemaVersion !== STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION) {
    issues.push({ field: 'statBridge.schemaVersion', message: 'Unsupported stat-bridge schema.' })
    return issues
  }
  if (state.statBridge.rulesVersion !== STAT_DRIVEN_COMBAT_RULES_VERSION) {
    issues.push({ field: 'statBridge.rulesVersion', message: 'Unsupported stat-bridge rules.' })
  }

  const expectedIds = state.tactical.battle.combatants
    .map((combatant) => combatant.id)
    .sort(compareStableString)
  const actualIds = state.statBridge.combatants.map((profile) => profile.combatantId)
  if (!arraysEqual(actualIds, expectedIds)) {
    issues.push({
      field: 'statBridge.combatants',
      message: 'Stat profiles must cover every combatant exactly once in stable ID order.',
    })
  }

  const seen = new Set<string>()
  for (const [index, profile] of state.statBridge.combatants.entries()) {
    const prefix = `statBridge.combatants.${index}`
    collectIdentityIssue(issues, profile.combatantId, `${prefix}.combatantId`)
    collectIdentityIssue(issues, profile.provenance.sourceId, `${prefix}.provenance.sourceId`)
    collectPositiveIntegerIssue(
      issues,
      profile.provenance.sourceRulesVersion,
      `${prefix}.provenance.sourceRulesVersion`,
    )
    if (profile.provenance.kind !== 'character-derived' && profile.provenance.kind !== 'scenario') {
      issues.push({ field: `${prefix}.provenance.kind`, message: 'Unknown stat provenance kind.' })
    }
    collectBasisPointIssue(issues, profile.accuracy, `${prefix}.accuracy`)
    collectBasisPointIssue(issues, profile.evasion, `${prefix}.evasion`)
    collectNonNegativeIntegerIssue(issues, profile.armor, `${prefix}.armor`)
    collectNonNegativeIntegerIssue(issues, profile.ward, `${prefix}.ward`)
    collectPositiveIntegerIssue(issues, profile.jump, `${prefix}.jump`)
    if (seen.has(profile.combatantId)) {
      issues.push({
        field: `${prefix}.combatantId`,
        message: 'Combatant stat profiles must be unique.',
      })
    }
    seen.add(profile.combatantId)
  }

  return issues
}

export function getStatDrivenCombatProfile(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
): StatDrivenCombatProfile {
  const profile = state.statBridge.combatants.find(
    (candidate) => candidate.combatantId === combatantId,
  )
  if (!profile) {
    throw new Error(`Missing stat-driven combat profile for ${combatantId}.`)
  }
  return profile
}

export function calculateHitChanceBasisPoints(
  actor: StatDrivenCombatProfile,
  target: StatDrivenCombatProfile,
): number {
  return Math.max(0, Math.min(COMBAT_BASIS_POINTS, actor.accuracy - target.evasion))
}

export function mitigateDamageByDefense(rawDamage: number, defenseRating: number): number {
  assertPositiveSafeInteger(rawDamage, 'raw damage')
  assertNonNegativeSafeInteger(defenseRating, 'defense rating')
  const scaled = (BigInt(rawDamage) * 100n) / (100n + BigInt(defenseRating))
  return Math.max(1, Number(scaled))
}

export function forecastStatDrivenAttack(
  state: StatDrivenCombatEncounterState,
  action: CombatActionDefinition,
  selection: CombatTargetSelection,
  content: CombatContentCatalog,
  defenseKind: CombatDefenseKind = 'armor',
): StatDrivenAttackForecast {
  assertValidStatDrivenCombatEncounterState(state)
  assertBasicAttack(action)

  const baseline = evaluateCombatAction(state, action, selection, content)
  if (!baseline.legal || !baseline.actorId || !baseline.primaryCombatantId) {
    return {
      evaluation: baseline,
      hitChanceBasisPoints: null,
      defenseKind,
      defenseRating: null,
      mitigatedBaseDamage: null,
    }
  }

  const actor = getStatDrivenCombatProfile(state, baseline.actorId)
  const target = getStatDrivenCombatProfile(state, baseline.primaryCombatantId)
  const defenseRating = target[defenseKind]
  const mitigatedAction = withMitigatedDamage(action, defenseRating)
  const evaluation = evaluateCombatAction(state, mitigatedAction, selection, content)

  return {
    evaluation,
    hitChanceBasisPoints: calculateHitChanceBasisPoints(actor, target),
    defenseKind,
    defenseRating,
    mitigatedBaseDamage: firstDamageAmount(mitigatedAction),
  }
}

export function executeStatDrivenAttack(
  state: StatDrivenCombatEncounterState,
  action: CombatActionDefinition,
  selection: CombatTargetSelection,
  content: CombatContentCatalog,
  defenseKind: CombatDefenseKind = 'armor',
): StatDrivenCombatTransition {
  const forecast = forecastStatDrivenAttack(state, action, selection, content, defenseKind)
  if (
    !forecast.evaluation.legal ||
    !forecast.evaluation.actorId ||
    !forecast.evaluation.primaryCombatantId ||
    forecast.hitChanceBasisPoints === null ||
    forecast.defenseRating === null
  ) {
    executeCombatAction(state, action, selection, content)
    throw new Error('Stat-driven attack unexpectedly returned after illegal-action validation.')
  }

  const draw = advanceBattleRng(state.tactical.battle.rng)
  const rolledState = withRng(state, draw.state)
  const rollBasisPoints = draw.value % COMBAT_BASIS_POINTS
  const hit = rollBasisPoints < forecast.hitChanceBasisPoints
  const resolutionEvent: StatDrivenCombatResolutionEvent = {
    event: 'stat_driven_attack_resolved',
    actorId: forecast.evaluation.actorId,
    targetId: forecast.evaluation.primaryCombatantId,
    hitChanceBasisPoints: forecast.hitChanceBasisPoints,
    rollBasisPoints,
    hit,
    defenseKind,
    defenseRating: forecast.defenseRating,
    rulesVersion: STAT_DRIVEN_COMBAT_RULES_VERSION,
  }

  if (hit) {
    const transition = executeCombatAction(
      rolledState,
      withMitigatedDamage(action, forecast.defenseRating),
      selection,
      content,
    )
    const nextState = reattachStatDrivenCombatBridge(transition.state, state.statBridge)
    return { state: nextState, events: [resolutionEvent, ...transition.events] }
  }

  if (action.cost.mp !== 0) {
    throw new Error('Stat-driven miss handling currently supports zero-MP basic attacks only.')
  }
  const spent = spendAction(rolledState.tactical.battle)
  const nextState: StatDrivenCombatEncounterState = {
    ...rolledState,
    tactical: { ...rolledState.tactical, battle: spent.state },
  }
  assertValidStatDrivenCombatEncounterState(nextState)
  return {
    state: nextState,
    events: [
      resolutionEvent,
      ...spent.events,
      {
        event: 'combat_action_used',
        actionId: action.id,
        actorId: forecast.evaluation.actorId,
      },
    ],
  }
}

function withMitigatedDamage(
  action: CombatActionDefinition,
  defenseRating: number,
): CombatActionDefinition {
  return {
    ...action,
    effects: action.effects.map((effect) =>
      effect.type === 'damage'
        ? { ...effect, amount: mitigateDamageByDefense(effect.amount, defenseRating) }
        : effect,
    ),
  }
}

function firstDamageAmount(action: CombatActionDefinition): number | null {
  return action.effects.find((effect) => effect.type === 'damage')?.amount ?? null
}

function withRng(
  state: StatDrivenCombatEncounterState,
  rng: BattleRngState,
): StatDrivenCombatEncounterState {
  const nextState: StatDrivenCombatEncounterState = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: { ...state.tactical.battle, rng },
    },
  }
  assertValidStatDrivenCombatEncounterState(nextState)
  return nextState
}

function assertBasicAttack(action: CombatActionDefinition): void {
  if (action.sourceType !== 'basic-attack') {
    throw new Error('Stat-driven reliability currently applies only to basic attacks.')
  }
  if (!action.effects.some((effect) => effect.type === 'damage')) {
    throw new Error('Stat-driven basic attack requires a damage effect.')
  }
}

function copyProfile(profile: StatDrivenCombatProfile): StatDrivenCombatProfile {
  return {
    ...profile,
    provenance: { ...profile.provenance },
  }
}

function assertValidStatDrivenCombatEncounterState(state: StatDrivenCombatEncounterState): void {
  const issues = validateStatDrivenCombatEncounterState(state)
  if (issues.length > 0) {
    throw new Error(`Invalid stat-driven combat state: ${issues[0].field}: ${issues[0].message}`)
  }
}

function collectIdentityIssue(issues: StatDrivenCombatIssue[], value: string, field: string): void {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    issues.push({ field, message: 'Identity must be a non-empty trimmed string.' })
  }
}

function collectBasisPointIssue(
  issues: StatDrivenCombatIssue[],
  value: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > COMBAT_BASIS_POINTS) {
    issues.push({ field, message: 'Value must be a safe integer from 0 to 10000 basis points.' })
  }
}

function collectPositiveIntegerIssue(
  issues: StatDrivenCombatIssue[],
  value: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    issues.push({ field, message: 'Value must be a positive safe integer.' })
  }
}

function collectNonNegativeIntegerIssue(
  issues: StatDrivenCombatIssue[],
  value: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    issues.push({ field, message: 'Value must be a non-negative safe integer.' })
  }
}

function assertPositiveSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive safe integer.`)
  }
}

function assertNonNegativeSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer.`)
  }
}

function compareStableString(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}
