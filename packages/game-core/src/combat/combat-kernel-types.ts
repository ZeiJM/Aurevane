declare const battleIdBrand: unique symbol
declare const combatantIdBrand: unique symbol
declare const actionDefinitionIdBrand: unique symbol
declare const statusDefinitionIdBrand: unique symbol
declare const tacticalEntityIdBrand: unique symbol
declare const triggerChainIdBrand: unique symbol
declare const combatEffectInstanceIdBrand: unique symbol
declare const contentVersionBrand: unique symbol
declare const rulesetVersionBrand: unique symbol

export type BattleId = string & { readonly [battleIdBrand]: 'BattleId' }
export type CombatantId = string & { readonly [combatantIdBrand]: 'CombatantId' }
export type ActionDefinitionId = string & {
  readonly [actionDefinitionIdBrand]: 'ActionDefinitionId'
}
export type StatusDefinitionId = string & {
  readonly [statusDefinitionIdBrand]: 'StatusDefinitionId'
}
export type TacticalEntityId = string & { readonly [tacticalEntityIdBrand]: 'TacticalEntityId' }
export type TriggerChainId = string & { readonly [triggerChainIdBrand]: 'TriggerChainId' }
export type CombatEffectInstanceId = string & {
  readonly [combatEffectInstanceIdBrand]: 'CombatEffectInstanceId'
}
export type ContentVersion = number & { readonly [contentVersionBrand]: 'ContentVersion' }
export type RulesetVersion = number & { readonly [rulesetVersionBrand]: 'RulesetVersion' }

export const COMBAT_ACTION_SOURCE_KINDS = [
  'basic',
  'discipline-skill',
  'essence',
  'equipment',
  'soulmark',
  'mantle',
  'status-granted',
  'tactical-entity',
  'scenario',
  'temporary-encounter',
  'test',
] as const

export type CombatActionSourceKind = (typeof COMBAT_ACTION_SOURCE_KINDS)[number]

export const COMBAT_RESOLUTION_PIPELINE_VERSION = 1 as const

export const COMBAT_RESOLUTION_STAGES_V1 = Object.freeze([
  'command-validation',
  'legality',
  'target-context',
  'accuracy',
  'pre-hit-reactions',
  'raw-potency',
  'defense',
  'tactical-modifiers',
  'damage-modifiers',
  'barrier-redirect',
  'commit-mutation',
  'after-damage-triggers',
  'bounded-reactions',
  'consequences',
  'battle-state-checks',
  'metadata',
] as const)

export type CombatResolutionStageV1 = (typeof COMBAT_RESOLUTION_STAGES_V1)[number]
export type TriggeredDamagePolicy = 'non-reactive' | 'reactive'

export interface CombatTriggerGuard {
  triggerChainId: TriggerChainId
  maxDepth: number
  remainingReactionBudget: number
  triggeredDamagePolicy: TriggeredDamagePolicy
  executedInstanceIds: readonly string[]
}

export type CombatTriggerAttempt =
  | { accepted: true; guard: CombatTriggerGuard }
  | {
      accepted: false
      reason: 'depth-limit' | 'reaction-budget-exhausted' | 'instance-already-executed'
      guard: CombatTriggerGuard
    }

export interface CreateCombatTriggerGuardInput {
  triggerChainId: string
  maxDepth?: number
  reactionBudget?: number
  triggeredDamagePolicy?: TriggeredDamagePolicy
}

export interface ConsumeCombatTriggerInput {
  instanceId: string
  depth: number
}

export interface CombatActionProvenance {
  rulesetVersion: RulesetVersion
  sourceKind: CombatActionSourceKind
  actionDefinitionId: ActionDefinitionId
  actionVersion: ContentVersion
  sourceCombatantId: CombatantId
  controllerCombatantId: CombatantId
  triggerChainId: TriggerChainId
}

export interface CreateCombatActionProvenanceInput {
  rulesetVersion: number
  sourceKind: CombatActionSourceKind
  actionDefinitionId: string
  actionVersion: number
  sourceCombatantId: string
  controllerCombatantId: string
  triggerChainId: string
}

export interface CombatEffectInstanceProvenance {
  instanceId: CombatEffectInstanceId
  action: CombatActionProvenance
  targetCombatantId: CombatantId
  effectOrdinal: number
  /** Stable zero-based index among copies emitted by this authored effect for this target. */
  copyOrdinal?: number
  createdRound: number
  createdTurn: number
  copiedFromInstanceId?: CombatEffectInstanceId
  inheritedFromInstanceId?: CombatEffectInstanceId
}

export interface CreateCombatEffectInstanceProvenanceInput {
  action: CombatActionProvenance
  targetCombatantId: string
  effectOrdinal: number
  /** Stable zero-based index among copies emitted by this authored effect for this target. */
  copyOrdinal?: number
  createdRound: number
  createdTurn: number
  copiedFromInstanceId?: string
  inheritedFromInstanceId?: string
}

function stableIdentifier<T extends string>(value: string, label: string): T {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new TypeError(`${label} must be a non-empty stable identifier without outer whitespace.`)
  }
  return value as T
}

function positiveVersion<T extends number>(value: number, label: string): T {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
  return value as T
}

function positiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
  return value
}

function nonNegativeSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`)
  }
  return value
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null
}

function stableIdentifierIssue(value: unknown, field: string): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    return `${field} must be a non-empty stable identifier without outer whitespace.`
  }
  return null
}

function positiveIntegerIssue(value: unknown, field: string): string | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
    ? null
    : `${field} must be a positive safe integer.`
}

function nonNegativeIntegerIssue(value: unknown, field: string): string | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? null
    : `${field} must be a non-negative safe integer.`
}

export function combatActionSourceKind(value: unknown): CombatActionSourceKind {
  if (
    typeof value !== 'string' ||
    !COMBAT_ACTION_SOURCE_KINDS.some((sourceKind) => sourceKind === value)
  ) {
    throw new TypeError(`Unknown combat action source kind: ${String(value)}`)
  }
  return value as CombatActionSourceKind
}

export function battleId(value: string): BattleId {
  return stableIdentifier<BattleId>(value, 'Battle ID')
}

export function combatantId(value: string): CombatantId {
  return stableIdentifier<CombatantId>(value, 'Combatant ID')
}

export function actionDefinitionId(value: string): ActionDefinitionId {
  return stableIdentifier<ActionDefinitionId>(value, 'Action definition ID')
}

export function statusDefinitionId(value: string): StatusDefinitionId {
  return stableIdentifier<StatusDefinitionId>(value, 'Status definition ID')
}

export function tacticalEntityId(value: string): TacticalEntityId {
  return stableIdentifier<TacticalEntityId>(value, 'Tactical entity ID')
}

export function triggerChainId(value: string): TriggerChainId {
  return stableIdentifier<TriggerChainId>(value, 'Trigger chain ID')
}

export function combatEffectInstanceId(value: string): CombatEffectInstanceId {
  return stableIdentifier<CombatEffectInstanceId>(value, 'Combat effect instance ID')
}

export function contentVersion(value: number): ContentVersion {
  return positiveVersion<ContentVersion>(value, 'Content version')
}

export function rulesetVersion(value: number): RulesetVersion {
  return positiveVersion<RulesetVersion>(value, 'Ruleset version')
}

export function createCombatTriggerGuard(input: CreateCombatTriggerGuardInput): CombatTriggerGuard {
  const maxDepth = positiveSafeInteger(input.maxDepth ?? 8, 'Trigger max depth')
  const remainingReactionBudget = nonNegativeSafeInteger(
    input.reactionBudget ?? 32,
    'Trigger reaction budget',
  )
  const triggeredDamagePolicy = input.triggeredDamagePolicy ?? 'non-reactive'
  if (triggeredDamagePolicy !== 'non-reactive' && triggeredDamagePolicy !== 'reactive') {
    throw new TypeError(`Unknown triggered damage policy: ${String(triggeredDamagePolicy)}`)
  }

  return {
    triggerChainId: triggerChainId(input.triggerChainId),
    maxDepth,
    remainingReactionBudget,
    triggeredDamagePolicy,
    executedInstanceIds: [],
  }
}

export function consumeCombatTrigger(
  guard: CombatTriggerGuard,
  input: ConsumeCombatTriggerInput,
): CombatTriggerAttempt {
  const instanceId = stableIdentifier<string>(input.instanceId, 'Trigger instance ID')
  const depth = positiveSafeInteger(input.depth, 'Trigger depth')

  if (guard.executedInstanceIds.includes(instanceId)) {
    return { accepted: false, reason: 'instance-already-executed', guard }
  }
  if (depth > guard.maxDepth) {
    return { accepted: false, reason: 'depth-limit', guard }
  }
  if (guard.remainingReactionBudget === 0) {
    return { accepted: false, reason: 'reaction-budget-exhausted', guard }
  }

  return {
    accepted: true,
    guard: {
      ...guard,
      remainingReactionBudget: guard.remainingReactionBudget - 1,
      executedInstanceIds: [...guard.executedInstanceIds, instanceId],
    },
  }
}

export function createCombatActionProvenance(
  input: CreateCombatActionProvenanceInput,
): CombatActionProvenance {
  return {
    rulesetVersion: rulesetVersion(input.rulesetVersion),
    sourceKind: combatActionSourceKind(input.sourceKind),
    actionDefinitionId: actionDefinitionId(input.actionDefinitionId),
    actionVersion: contentVersion(input.actionVersion),
    sourceCombatantId: combatantId(input.sourceCombatantId),
    controllerCombatantId: combatantId(input.controllerCombatantId),
    triggerChainId: triggerChainId(input.triggerChainId),
  }
}

function effectInstanceIdentity(
  chainId: string,
  actionId: string,
  effectOrdinal: number,
  targetId: string,
  copyOrdinal?: number,
): string {
  if (copyOrdinal === undefined) {
    return `effect:${chainId}:${actionId}:${effectOrdinal}:${targetId}`
  }
  // Separate namespace and tuple encoding preserve legacy IDs without delimiter collisions.
  return `effect-copy:${JSON.stringify([chainId, actionId, effectOrdinal, targetId, copyOrdinal])}`
}

export function createCombatEffectInstanceProvenance(
  input: CreateCombatEffectInstanceProvenanceInput,
): CombatEffectInstanceProvenance {
  const targetCombatantId = combatantId(input.targetCombatantId)
  const effectOrdinal = nonNegativeSafeInteger(input.effectOrdinal, 'Effect ordinal')
  const createdRound = positiveSafeInteger(input.createdRound, 'Created round')
  const createdTurn = positiveSafeInteger(input.createdTurn, 'Created turn')
  const copyOrdinal =
    input.copyOrdinal === undefined
      ? undefined
      : nonNegativeSafeInteger(input.copyOrdinal, 'Copy ordinal')
  const instanceId = combatEffectInstanceId(
    effectInstanceIdentity(
      input.action.triggerChainId,
      input.action.actionDefinitionId,
      effectOrdinal,
      targetCombatantId,
      copyOrdinal,
    ),
  )

  return {
    instanceId,
    action: input.action,
    targetCombatantId,
    effectOrdinal,
    ...(copyOrdinal !== undefined ? { copyOrdinal } : {}),
    createdRound,
    createdTurn,
    ...(input.copiedFromInstanceId !== undefined
      ? { copiedFromInstanceId: combatEffectInstanceId(input.copiedFromInstanceId) }
      : {}),
    ...(input.inheritedFromInstanceId !== undefined
      ? { inheritedFromInstanceId: combatEffectInstanceId(input.inheritedFromInstanceId) }
      : {}),
  }
}

export function validateCombatEffectInstanceProvenance(value: unknown): readonly string[] {
  const input = objectRecord(value)
  if (!input) return ['provenance must be an object.']

  const issues: string[] = []
  const instanceIssue = stableIdentifierIssue(input.instanceId, 'instanceId')
  if (instanceIssue) issues.push(instanceIssue)
  const targetIssue = stableIdentifierIssue(input.targetCombatantId, 'targetCombatantId')
  if (targetIssue) issues.push(targetIssue)
  const ordinalIssue = nonNegativeIntegerIssue(input.effectOrdinal, 'effectOrdinal')
  if (ordinalIssue) issues.push(ordinalIssue)
  if (input.copyOrdinal !== undefined) {
    const copyIssue = nonNegativeIntegerIssue(input.copyOrdinal, 'copyOrdinal')
    if (copyIssue) issues.push(copyIssue)
  }
  const roundIssue = positiveIntegerIssue(input.createdRound, 'createdRound')
  if (roundIssue) issues.push(roundIssue)
  const turnIssue = positiveIntegerIssue(input.createdTurn, 'createdTurn')
  if (turnIssue) issues.push(turnIssue)

  if (input.copiedFromInstanceId !== undefined) {
    const issue = stableIdentifierIssue(input.copiedFromInstanceId, 'copiedFromInstanceId')
    if (issue) issues.push(issue)
  }
  if (input.inheritedFromInstanceId !== undefined) {
    const issue = stableIdentifierIssue(input.inheritedFromInstanceId, 'inheritedFromInstanceId')
    if (issue) issues.push(issue)
  }

  const action = objectRecord(input.action)
  if (!action) {
    issues.push('action must be a provenance object.')
  } else {
    const rulesIssue = positiveIntegerIssue(action.rulesetVersion, 'action.rulesetVersion')
    if (rulesIssue) issues.push(rulesIssue)
    const definitionIssue = stableIdentifierIssue(
      action.actionDefinitionId,
      'action.actionDefinitionId',
    )
    if (definitionIssue) issues.push(definitionIssue)
    const actionVersionIssue = positiveIntegerIssue(action.actionVersion, 'action.actionVersion')
    if (actionVersionIssue) issues.push(actionVersionIssue)
    const sourceIssue = stableIdentifierIssue(action.sourceCombatantId, 'action.sourceCombatantId')
    if (sourceIssue) issues.push(sourceIssue)
    const controllerIssue = stableIdentifierIssue(
      action.controllerCombatantId,
      'action.controllerCombatantId',
    )
    if (controllerIssue) issues.push(controllerIssue)
    const chainIssue = stableIdentifierIssue(action.triggerChainId, 'action.triggerChainId')
    if (chainIssue) issues.push(chainIssue)
    try {
      combatActionSourceKind(action.sourceKind)
    } catch {
      issues.push('action.sourceKind must be a known combat action source kind.')
    }
  }

  if (
    issues.length === 0 &&
    typeof input.instanceId === 'string' &&
    typeof input.targetCombatantId === 'string' &&
    typeof input.effectOrdinal === 'number' &&
    action &&
    typeof action.triggerChainId === 'string' &&
    typeof action.actionDefinitionId === 'string'
  ) {
    const expected = effectInstanceIdentity(
      action.triggerChainId,
      action.actionDefinitionId,
      input.effectOrdinal,
      input.targetCombatantId,
      typeof input.copyOrdinal === 'number' ? input.copyOrdinal : undefined,
    )
    if (input.instanceId !== expected) {
      issues.push('instanceId must match the deterministic action/effect/target identity.')
    }
  }

  return issues
}

export function assertNever(value: never, context: string): never {
  const description = typeof value === 'string' ? value : JSON.stringify(value)
  throw new TypeError(`Unhandled ${context} variant: ${description}`)
}
