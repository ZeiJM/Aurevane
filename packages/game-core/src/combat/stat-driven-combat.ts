import { combatAccuracyStatusModifier } from './combat-accuracy-status'
import { calculateHitChanceBasisPoints } from './combat-skill-accuracy'
export { calculateHitChanceBasisPoints } from './combat-skill-accuracy'
import { mitigateDamageByDefense } from './damage-mitigation'
export { mitigateDamageByDefense } from './damage-mitigation'
import type { DerivedStatSnapshot } from '../character/derived-stats'
import { advanceBattleRng, spendAction, type BattleRngState } from './battle-state'
import {
  applyCurrentBurnBacklash,
  evaluateCombatAction,
  removeGameplayTags,
  executeCombatAction,
  shouldApplyCurrentBurnBacklash,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatActionEvaluation,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatResolutionEvent,
  type CombatTargetSelection,
} from './actions'

export const STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V1 = 1 as const
export const STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V2 = 2 as const
export const STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V3 = 3 as const
export const STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION = 4 as const
export const STAT_DRIVEN_COMBAT_RULES_V1 = 1 as const
export const STAT_DRIVEN_COMBAT_RULES_V2 = 2 as const
export const STAT_DRIVEN_COMBAT_RULES_V3 = 3 as const
export const STAT_DRIVEN_COMBAT_RULES_VERSION = 4 as const
export const COMBAT_BASIS_POINTS = 10_000 as const

export type CombatStatProvenanceKind = 'character-derived' | 'scenario'
export type CombatDefenseKind = 'armor' | 'ward'
export type CombatOffensivePowerKind = 'physical-power' | 'mystic-power'

export interface CombatStatProvenance {
  kind: CombatStatProvenanceKind
  sourceId: string
  sourceRulesVersion: number
}

export interface StatDrivenCombatProfileV1 {
  combatantId: string
  provenance: CombatStatProvenance
  accuracy: number
  evasion: number
  armor: number
  ward: number
  jump: number
}

/** Compatibility/persisted shape. V2 validation requires both optional ratings to be present. */
export interface StatDrivenCombatProfile extends StatDrivenCombatProfileV1 {
  physicalPower?: number
  mysticPower?: number
  level?: number
  criticalChance?: number
}

export interface StatDrivenCombatProfileV2 extends StatDrivenCombatProfileV1 {
  physicalPower: number
  mysticPower: number
}

export interface StatDrivenCombatProfileV3 extends StatDrivenCombatProfileV2 {
  level: number
}

export interface StatDrivenCombatProfileV4 extends StatDrivenCombatProfileV3 {
  criticalChance: number
}

/** Broad persisted boundary. Validation pairs schema/rules versions and row shape. */
export interface StatDrivenCombatBridgeState {
  schemaVersion:
    | typeof STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V1
    | typeof STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V2
    | typeof STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V3
    | typeof STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION
  rulesVersion:
    | typeof STAT_DRIVEN_COMBAT_RULES_V1
    | typeof STAT_DRIVEN_COMBAT_RULES_V2
    | typeof STAT_DRIVEN_COMBAT_RULES_V3
    | typeof STAT_DRIVEN_COMBAT_RULES_VERSION
  combatants: readonly StatDrivenCombatProfile[]
}

export interface StatDrivenCombatBridgeStateV1 extends StatDrivenCombatBridgeState {
  schemaVersion: typeof STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V1
  rulesVersion: typeof STAT_DRIVEN_COMBAT_RULES_V1
  combatants: readonly StatDrivenCombatProfileV1[]
}

export interface StatDrivenCombatBridgeStateV2 extends StatDrivenCombatBridgeState {
  schemaVersion: typeof STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V2
  rulesVersion: typeof STAT_DRIVEN_COMBAT_RULES_V2
  combatants: readonly StatDrivenCombatProfileV2[]
}

export interface StatDrivenCombatBridgeStateV3 extends StatDrivenCombatBridgeState {
  schemaVersion: typeof STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V3
  rulesVersion: typeof STAT_DRIVEN_COMBAT_RULES_V3
  combatants: readonly StatDrivenCombatProfileV3[]
}

export interface StatDrivenCombatBridgeStateV4 extends StatDrivenCombatBridgeState {
  schemaVersion: typeof STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION
  rulesVersion: typeof STAT_DRIVEN_COMBAT_RULES_VERSION
  combatants: readonly StatDrivenCombatProfileV4[]
}

export interface StatDrivenCombatEncounterState extends CombatEncounterState {
  statBridge: StatDrivenCombatBridgeState
}

export interface StatDrivenCombatEncounterStateV1 extends CombatEncounterState {
  statBridge: StatDrivenCombatBridgeStateV1
}

export interface StatDrivenCombatEncounterStateV2 extends CombatEncounterState {
  statBridge: StatDrivenCombatBridgeStateV2
}

export interface StatDrivenCombatEncounterStateV3 extends CombatEncounterState {
  statBridge: StatDrivenCombatBridgeStateV3
}

export interface StatDrivenCombatEncounterStateV4 extends CombatEncounterState {
  statBridge: StatDrivenCombatBridgeStateV4
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
      rulesVersion: StatDrivenCombatBridgeState['rulesVersion']
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
  level: number,
  snapshot: DerivedStatSnapshot,
): StatDrivenCombatProfileV4 {
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
    level,
    physicalPower: snapshot.stats.physicalPower.value,
    mysticPower: snapshot.stats.mysticPower.value,
    criticalChance: snapshot.stats.criticalChance.value,
  }
}

export function createStatDrivenCombatEncounterState(
  base: CombatEncounterState,
  profiles: readonly StatDrivenCombatProfile[],
): StatDrivenCombatEncounterState {
  const incompleteProfile = profiles.find(hasIncompleteOffensiveRatings)
  if (incompleteProfile) {
    throw new TypeError('Stat-driven combat profiles require both offensive ratings or neither.')
  }

  const currentCount = profiles.filter(isCurrentProfile).length
  if (currentCount !== 0 && currentCount !== profiles.length) {
    throw new TypeError(
      'Stat-driven combat profiles cannot mix historical rows with offensive ratings.',
    )
  }

  const levelCount = profiles.filter(isLevelProfile).length
  if (levelCount !== 0 && levelCount !== profiles.length) {
    throw new TypeError('Stat-driven combat profiles cannot mix v3 Level rows with older rows.')
  }

  const criticalChanceCount = profiles.filter(
    (profile) => profile.criticalChance !== undefined,
  ).length
  if (criticalChanceCount !== 0 && criticalChanceCount !== profiles.length) {
    throw new TypeError(
      'Stat-driven combat profiles cannot mix v4 Critical Chance rows with older rows.',
    )
  }
  if (criticalChanceCount === profiles.length) {
    return createCurrentStatDrivenCombatEncounterState(
      base,
      profiles as readonly StatDrivenCombatProfileV4[],
    )
  }
  if (levelCount === profiles.length) {
    return createV3StatDrivenCombatEncounterState(
      base,
      profiles as readonly StatDrivenCombatProfileV3[],
    )
  }
  if (currentCount === profiles.length) {
    return createV2StatDrivenCombatEncounterState(
      base,
      profiles as readonly StatDrivenCombatProfileV2[],
    )
  }

  const state: StatDrivenCombatEncounterStateV1 = {
    ...base,
    statBridge: {
      schemaVersion: STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V1,
      rulesVersion: STAT_DRIVEN_COMBAT_RULES_V1,
      combatants: [...profiles]
        .map(copyHistoricalProfile)
        .sort((left, right) => compareStableString(left.combatantId, right.combatantId)),
    },
  }
  assertValidStatDrivenCombatEncounterState(state)
  return state
}

export function createCurrentStatDrivenCombatEncounterState(
  base: CombatEncounterState,
  profiles: readonly StatDrivenCombatProfileV4[],
): StatDrivenCombatEncounterStateV4 {
  const state: StatDrivenCombatEncounterStateV4 = {
    ...base,
    statBridge: {
      schemaVersion: STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION,
      rulesVersion: STAT_DRIVEN_COMBAT_RULES_VERSION,
      combatants: [...profiles]
        .map(copyCurrentProfile)
        .sort((left, right) => compareStableString(left.combatantId, right.combatantId)),
    },
  }

  assertValidStatDrivenCombatEncounterState(state)
  return state
}

function createV3StatDrivenCombatEncounterState(
  base: CombatEncounterState,
  profiles: readonly StatDrivenCombatProfileV3[],
): StatDrivenCombatEncounterStateV3 {
  const state: StatDrivenCombatEncounterStateV3 = {
    ...base,
    statBridge: {
      schemaVersion: STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V3,
      rulesVersion: STAT_DRIVEN_COMBAT_RULES_V3,
      combatants: [...profiles]
        .map(copyV3Profile)
        .sort((left, right) => compareStableString(left.combatantId, right.combatantId)),
    },
  }

  assertValidStatDrivenCombatEncounterState(state)
  return state
}

function createV2StatDrivenCombatEncounterState(
  base: CombatEncounterState,
  profiles: readonly StatDrivenCombatProfileV2[],
): StatDrivenCombatEncounterStateV2 {
  const state: StatDrivenCombatEncounterStateV2 = {
    ...base,
    statBridge: {
      schemaVersion: STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V2,
      rulesVersion: STAT_DRIVEN_COMBAT_RULES_V2,
      combatants: [...profiles]
        .map(copyV2Profile)
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
  const state: StatDrivenCombatEncounterState = {
    ...base,
    statBridge: copyBridge(bridge),
  }
  assertValidStatDrivenCombatEncounterState(state)
  return state
}

export function validateStatDrivenCombatEncounterState(
  state: StatDrivenCombatEncounterState,
): readonly StatDrivenCombatIssue[] {
  const issues: StatDrivenCombatIssue[] = validateCombatEncounterState(state).map((issue) => ({
    field: issue.field,
    message: issue.message,
  }))

  const bridge = state.statBridge
  const isV1 =
    bridge?.schemaVersion === STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V1 &&
    bridge.rulesVersion === STAT_DRIVEN_COMBAT_RULES_V1
  const isV2 =
    bridge?.schemaVersion === STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V2 &&
    bridge.rulesVersion === STAT_DRIVEN_COMBAT_RULES_V2
  const isV3 =
    bridge?.schemaVersion === STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V3 &&
    bridge.rulesVersion === STAT_DRIVEN_COMBAT_RULES_V3
  const isV4 =
    bridge?.schemaVersion === STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION &&
    bridge.rulesVersion === STAT_DRIVEN_COMBAT_RULES_VERSION
  if (!bridge || (!isV1 && !isV2 && !isV3 && !isV4)) {
    issues.push({
      field: 'statBridge.schemaVersion',
      message: 'Unsupported or mismatched stat-bridge schema/rules version.',
    })
    return issues
  }

  const expectedIds = state.tactical.battle.combatants
    .map((combatant) => combatant.id)
    .sort(compareStableString)
  const actualIds = bridge.combatants.map((profile) => profile.combatantId)
  if (!arraysEqual(actualIds, expectedIds)) {
    issues.push({
      field: 'statBridge.combatants',
      message: 'Stat profiles must cover every combatant exactly once in stable ID order.',
    })
  }

  const seen = new Set<string>()
  for (const [index, profile] of bridge.combatants.entries()) {
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
    collectNonNegativeIntegerIssue(issues, profile.jump, `${prefix}.jump`)
    if (seen.has(profile.combatantId)) {
      issues.push({
        field: `${prefix}.combatantId`,
        message: 'Combatant stat profiles must be unique.',
      })
    }
    seen.add(profile.combatantId)
  }

  if (isV2 || isV3 || isV4) {
    for (const [index, profile] of bridge.combatants.entries()) {
      const prefix = `statBridge.combatants.${index}`
      collectNonNegativeIntegerIssue(issues, profile.physicalPower, `${prefix}.physicalPower`)
      collectNonNegativeIntegerIssue(issues, profile.mysticPower, `${prefix}.mysticPower`)
      if (isV3 || isV4) collectLevelIssue(issues, profile.level, `${prefix}.level`)
      if (isV4) collectBasisPointIssue(issues, profile.criticalChance ?? -1, `${prefix}.criticalChance`)
    }
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

export function getStatDrivenOffensivePower(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
  kind: CombatOffensivePowerKind,
): number {
  const bridge = state.statBridge
  const supportsOffensivePower =
    (bridge.schemaVersion === STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V2 &&
      bridge.rulesVersion === STAT_DRIVEN_COMBAT_RULES_V2) ||
    (bridge.schemaVersion === STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V3 &&
      bridge.rulesVersion === STAT_DRIVEN_COMBAT_RULES_V3) ||
    (bridge.schemaVersion === STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION &&
      bridge.rulesVersion === STAT_DRIVEN_COMBAT_RULES_VERSION)
  if (!supportsOffensivePower) {
    throw new TypeError('Scaled damage requires stat-bridge schema version 2 or newer.')
  }
  const profile = bridge.combatants.find((candidate) => candidate.combatantId === combatantId)
  if (!profile) {
    throw new Error(`Missing stat-driven combat profile for ${combatantId}.`)
  }
  if (!isCurrentProfile(profile)) {
    throw new TypeError('Scaled damage requires complete offensive stat ratings.')
  }
  return kind === 'physical-power' ? profile.physicalPower : profile.mysticPower
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
    hitChanceBasisPoints: calculateHitChanceBasisPoints(
      actor,
      target,
      combatAccuracyStatusModifier(state, baseline.actorId, baseline.primaryCombatantId, content),
    ),
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

  const burnBacklashApplies = shouldApplyCurrentBurnBacklash(
    state,
    forecast.evaluation.actorId,
    action,
  )
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
    rulesVersion: state.statBridge.rulesVersion,
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
  const revealed = removeGameplayTags(
    rolledState,
    forecast.evaluation.actorId,
    forecast.evaluation.actorId,
    action.id,
    ['Invisible'],
    content,
  )
  const spent = spendAction(rolledState.tactical.battle)
  let nextState: StatDrivenCombatEncounterState = {
    ...rolledState,
    ...revealed.state,
    statBridge: rolledState.statBridge,
    tactical: { ...rolledState.tactical, battle: spent.state },
  }
  const events: StatDrivenCombatResolutionEvent[] = [
    resolutionEvent,
    ...spent.events,
    ...revealed.events,
    {
      event: 'combat_action_used',
      actionId: action.id,
      actorId: forecast.evaluation.actorId,
    },
  ]
  if (burnBacklashApplies) {
    const backlash = applyCurrentBurnBacklash(nextState, forecast.evaluation.actorId)
    nextState = reattachStatDrivenCombatBridge(backlash.state, state.statBridge)
    events.push(...backlash.events)
  }
  assertValidStatDrivenCombatEncounterState(nextState)
  return { state: nextState, events }
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

function hasIncompleteOffensiveRatings(profile: StatDrivenCombatProfile): boolean {
  const hasPhysical = profile.physicalPower !== undefined
  const hasMystic = profile.mysticPower !== undefined
  if (hasPhysical !== hasMystic) return true
  if (!hasPhysical) return false
  return !isCurrentProfile(profile)
}

function isCurrentProfile(profile: StatDrivenCombatProfile): profile is StatDrivenCombatProfileV2 {
  return (
    Number.isSafeInteger(profile.physicalPower) &&
    (profile.physicalPower ?? -1) >= 0 &&
    Number.isSafeInteger(profile.mysticPower) &&
    (profile.mysticPower ?? -1) >= 0
  )
}

function isLevelProfile(profile: StatDrivenCombatProfile): profile is StatDrivenCombatProfileV3 {
  return (
    Number.isSafeInteger(profile.level) && (profile.level ?? 0) >= 1 && isCurrentProfile(profile)
  )
}

function copyCurrentProfile(profile: StatDrivenCombatProfileV4): StatDrivenCombatProfileV4 {
  return {
    ...profile,
    provenance: { ...profile.provenance },
  }
}

function copyV3Profile(profile: StatDrivenCombatProfileV3): StatDrivenCombatProfileV3 {
  return {
    ...profile,
    provenance: { ...profile.provenance },
  }
}

function copyV2Profile(profile: StatDrivenCombatProfileV2): StatDrivenCombatProfileV2 {
  return {
    ...profile,
    provenance: { ...profile.provenance },
  }
}

function copyHistoricalProfile(profile: StatDrivenCombatProfileV1): StatDrivenCombatProfileV1 {
  return {
    combatantId: profile.combatantId,
    provenance: { ...profile.provenance },
    accuracy: profile.accuracy,
    evasion: profile.evasion,
    armor: profile.armor,
    ward: profile.ward,
    jump: profile.jump,
  }
}

function copyBridge(bridge: StatDrivenCombatBridgeState): StatDrivenCombatBridgeState {
  return {
    schemaVersion: bridge.schemaVersion,
    rulesVersion: bridge.rulesVersion,
    combatants: bridge.combatants.map((profile) => ({
      ...profile,
      provenance: { ...profile.provenance },
    })),
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
  value: number | undefined,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || (value ?? -1) < 0) {
    issues.push({ field, message: 'Value must be a non-negative safe integer.' })
  }
}

function collectLevelIssue(
  issues: StatDrivenCombatIssue[],
  value: number | undefined,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || (value ?? 0) < 1 || (value ?? 101) > 100) {
    issues.push({ field, message: 'Level must be a safe integer from 1 to 100.' })
  }
}

function compareStableString(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}
