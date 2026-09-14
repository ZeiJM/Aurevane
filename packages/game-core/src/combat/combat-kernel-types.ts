declare const battleIdBrand: unique symbol
declare const combatantIdBrand: unique symbol
declare const actionDefinitionIdBrand: unique symbol
declare const statusDefinitionIdBrand: unique symbol
declare const tacticalEntityIdBrand: unique symbol
declare const triggerChainIdBrand: unique symbol
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

export function contentVersion(value: number): ContentVersion {
  return positiveVersion<ContentVersion>(value, 'Content version')
}

export function rulesetVersion(value: number): RulesetVersion {
  return positiveVersion<RulesetVersion>(value, 'Ruleset version')
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

export function assertNever(value: never, context: string): never {
  const description = typeof value === 'string' ? value : JSON.stringify(value)
  throw new TypeError(`Unhandled ${context} variant: ${description}`)
}
