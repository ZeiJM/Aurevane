import type { AbilityDefinitionIssue } from './combat-definition'

export type AbilityResource = 'ap' | 'mp' | 'hp'
export type AbilityRequirementSubject = 'owner' | 'selected' | 'affected' | 'triggering'
export type AbilityClassification = 'attack' | 'recovery' | 'utility'
export type AbilityAttackFamily = 'physical' | 'mystic'

export type RequirementNode =
  | { readonly kind: 'all'; readonly children: readonly RequirementNode[] }
  | { readonly kind: 'any'; readonly children: readonly RequirementNode[] }
  | ({
      readonly kind: 'resource-state'
      readonly subject: AbilityRequirementSubject
      readonly resource: AbilityResource
      readonly comparison: 'at-most' | 'at-least'
    } & (
      | { readonly amount: number; readonly basisPoints?: never }
      | { readonly basisPoints: number; readonly amount?: never }
    ))
  | {
      readonly kind: 'resource-threshold-crossing'
      readonly subject: AbilityRequirementSubject
      readonly resource: AbilityResource
      readonly direction: 'below' | 'above'
      readonly thresholdBasisPoints: number
    }
  | {
      readonly kind: 'status-presence'
      readonly subject: AbilityRequirementSubject
      readonly statusId: string
      readonly present: boolean
    }
  | {
      readonly kind: 'prime-presence'
      readonly subject: AbilityRequirementSubject
      readonly abilityId: string
      readonly present: boolean
    }
  | { readonly kind: 'event'; readonly eventType: string; readonly phase: 'before' | 'after' }
  | {
      readonly kind: 'action'
      readonly classification?: AbilityClassification
      readonly attackFamily?: AbilityAttackFamily
      readonly sourceDisciplineId?: string
      readonly requiredTags?: readonly string[]
    }

export interface AbilityRequirementSubjectState {
  readonly resources?: Readonly<Partial<Record<AbilityResource, number>>>
  readonly maximumResources?: Readonly<Partial<Record<AbilityResource, number>>>
  /** Values immediately before the immutable triggering event, never a previous read. */
  readonly previousResources?: Readonly<Partial<Record<AbilityResource, number>>>
  readonly statusIds?: readonly string[]
  readonly primeAbilityIds?: readonly string[]
}

export interface AbilityRequirementContext {
  readonly owner?: AbilityRequirementSubjectState | null
  readonly selected?: AbilityRequirementSubjectState | null
  readonly affected?: AbilityRequirementSubjectState | null
  readonly triggering?: AbilityRequirementSubjectState | null
  readonly event?: {
    readonly type: string
    readonly phase: 'before' | 'after'
    readonly action?: {
      readonly classification: AbilityClassification
      readonly attackFamily?: AbilityAttackFamily
      /** Intrinsic source; eligibility Discipline selection does not change this. */
      readonly sourceDisciplineId?: string
      readonly tags: readonly string[]
    }
  } | null
}

export const ABILITY_REQUIREMENT_BUDGET = Object.freeze({ maximumDepth: 8, maximumNodes: 128 })

/** Every satisfying branch must qualify this root's before-action hook. */
export function isBeforeActionModifierRequirement(node: RequirementNode | null): boolean {
  function inspect(value: RequirementNode): { compatible: boolean; anchored: boolean } {
    if (value.kind === 'resource-threshold-crossing') return { compatible: false, anchored: false }
    if (value.kind === 'event') {
      const compatible = value.eventType === 'combat_action_used' && value.phase === 'before'
      return { compatible, anchored: compatible }
    }
    if (value.kind === 'action') return { compatible: true, anchored: true }
    if (value.kind === 'all' || value.kind === 'any') {
      const children = value.children.map(inspect)
      return {
        compatible: children.every((child) => child.compatible),
        anchored:
          value.kind === 'all'
            ? children.some((child) => child.anchored)
            : children.every((child) => child.anchored),
      }
    }
    return { compatible: true, anchored: false }
  }
  if (!node) return false
  const result = inspect(node)
  return result.compatible && result.anchored
}
const ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u
const subjects = ['owner', 'selected', 'affected', 'triggering']
const resources = ['ap', 'mp', 'hp']

export function validateAbilityRequirements(value: unknown): readonly AbilityDefinitionIssue[] {
  if (value === null) return []
  const issues: AbilityDefinitionIssue[] = []
  let count = 0
  function issue(path: string, code: AbilityDefinitionIssue['code'], message: string) {
    issues.push({ path, code, message })
  }
  function visit(node: unknown, depth: number, path: string): void {
    count++
    if (
      depth > ABILITY_REQUIREMENT_BUDGET.maximumDepth ||
      count > ABILITY_REQUIREMENT_BUDGET.maximumNodes
    ) {
      issue(path, 'requirement-budget', 'Requirements exceed depth 8 or 128 total nodes.')
      return
    }
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      issue(path, 'invalid-requirement', 'Requirement must be an object.')
      return
    }
    const row = node as Record<string, unknown>
    const fields: Record<string, readonly string[]> = {
      all: ['kind', 'children'],
      any: ['kind', 'children'],
      'resource-state': ['kind', 'subject', 'resource', 'comparison', 'amount', 'basisPoints'],
      'resource-threshold-crossing': [
        'kind',
        'subject',
        'resource',
        'direction',
        'thresholdBasisPoints',
      ],
      'status-presence': ['kind', 'subject', 'statusId', 'present'],
      'prime-presence': ['kind', 'subject', 'abilityId', 'present'],
      event: ['kind', 'eventType', 'phase'],
      action: ['kind', 'classification', 'attackFamily', 'sourceDisciplineId', 'requiredTags'],
    }
    const allowed =
      typeof row.kind === 'string' && Object.hasOwn(fields, row.kind) ? fields[row.kind] : undefined
    if (!allowed) {
      issue(path, 'invalid-requirement', 'Unsupported Requirement predicate.')
      return
    }
    for (const key of Object.keys(row))
      if (!allowed.includes(key)) issue(`${path}.${key}`, 'unknown-key', 'Unknown mechanical key.')
    if (row.kind === 'all' || row.kind === 'any') {
      if (
        !Array.isArray(row.children) ||
        row.children.length < 1 ||
        row.children.length >= ABILITY_REQUIREMENT_BUDGET.maximumNodes
      ) {
        issue(path, 'requirement-budget', 'All/Any requires 1–127 bounded children.')
        return
      }
      for (const [index, child] of row.children.entries()) {
        visit(child, depth + 1, `${path}.children[${index}]`)
        if (count > ABILITY_REQUIREMENT_BUDGET.maximumNodes) break
      }
      return
    }
    if ('subject' in row && !subjects.includes(row.subject as string))
      issue(path, 'invalid-requirement', 'Unknown Requirement subject.')
    if (row.kind !== 'event' && row.kind !== 'action' && !('subject' in row))
      issue(path, 'invalid-requirement', 'Requirement subject is required.')
    if (row.kind === 'resource-state' || row.kind === 'resource-threshold-crossing') {
      if (!resources.includes(row.resource as string))
        issue(path, 'invalid-requirement', 'Unknown resource unit.')
      if (row.kind === 'resource-state') {
        const absolute = Object.hasOwn(row, 'amount')
        const percentage = Object.hasOwn(row, 'basisPoints')
        if (
          !['at-most', 'at-least'].includes(row.comparison as string) ||
          absolute === percentage ||
          (absolute && !nonnegative(row.amount)) ||
          (percentage && (!nonnegative(row.basisPoints) || row.basisPoints > 10000))
        )
          issue(
            path,
            'invalid-requirement',
            'Resource state requires a comparison and exactly one amount or 0–10000 basis-point threshold.',
          )
      } else if (
        !['below', 'above'].includes(row.direction as string) ||
        !nonnegative(row.thresholdBasisPoints) ||
        (row.thresholdBasisPoints as number) > 10000
      )
        issue(
          path,
          'invalid-requirement',
          'Threshold crossing requires direction and 0–10000 basis points.',
        )
    }
    if (row.kind === 'status-presence' || row.kind === 'prime-presence') {
      const id = row.kind === 'status-presence' ? row.statusId : row.abilityId
      if (typeof id !== 'string' || !ID.test(id) || typeof row.present !== 'boolean')
        issue(path, 'invalid-requirement', 'Presence predicates require a stable ID and boolean.')
    }
    if (
      row.kind === 'event' &&
      (typeof row.eventType !== 'string' ||
        !ID.test(row.eventType) ||
        !['before', 'after'].includes(row.phase as string))
    )
      issue(path, 'invalid-requirement', 'Event requires a stable type and before/after phase.')
    if (row.kind === 'action') {
      if (
        !['classification', 'attackFamily', 'sourceDisciplineId', 'requiredTags'].some(
          (key) => row[key] !== undefined,
        )
      )
        issue(
          path,
          'invalid-requirement',
          'Action qualification must specify at least one qualifier.',
        )
      if (
        row.classification !== undefined &&
        !['attack', 'recovery', 'utility'].includes(row.classification as string)
      )
        issue(path, 'invalid-requirement', 'Unknown action classification.')
      if (
        row.attackFamily !== undefined &&
        !['physical', 'mystic'].includes(row.attackFamily as string)
      )
        issue(path, 'invalid-requirement', 'Unknown Attack family.')
      if (
        row.sourceDisciplineId !== undefined &&
        (typeof row.sourceDisciplineId !== 'string' || !ID.test(row.sourceDisciplineId))
      )
        issue(path, 'invalid-requirement', 'Intrinsic source must be a stable ID.')
      if (
        row.requiredTags !== undefined &&
        (!Array.isArray(row.requiredTags) ||
          row.requiredTags.length < 1 ||
          row.requiredTags.length > 16 ||
          new Set(row.requiredTags).size !== row.requiredTags.length ||
          row.requiredTags.some((tag) => typeof tag !== 'string' || !ID.test(tag)))
      )
        issue(path, 'invalid-requirement', 'Action tags require 1–16 distinct stable IDs.')
    }
  }
  visit(value, 1, 'requirements')
  return issues
}

export function evaluateAbilityRequirements(
  requirement: RequirementNode | null,
  context: AbilityRequirementContext,
): boolean {
  if (validateAbilityRequirements(requirement).length > 0) return false
  if (requirement === null) return true
  function evaluate(node: RequirementNode): boolean {
    if (node.kind === 'all') return node.children.every(evaluate)
    if (node.kind === 'any') return node.children.some(evaluate)
    if (node.kind === 'event')
      return context.event?.type === node.eventType && context.event.phase === node.phase
    if (node.kind === 'action') {
      const action = context.event?.action
      return (
        !!action &&
        (node.classification === undefined || action.classification === node.classification) &&
        (node.attackFamily === undefined || action.attackFamily === node.attackFamily) &&
        (node.sourceDisciplineId === undefined ||
          action.sourceDisciplineId === node.sourceDisciplineId) &&
        (node.requiredTags === undefined ||
          node.requiredTags.every((tag) => action.tags.includes(tag)))
      )
    }
    const subject = context[node.subject]
    if (!subject) return false
    if (node.kind === 'status-presence')
      return (
        Array.isArray(subject.statusIds) &&
        subject.statusIds.includes(node.statusId) === node.present
      )
    if (node.kind === 'prime-presence')
      return (
        Array.isArray(subject.primeAbilityIds) &&
        subject.primeAbilityIds.includes(node.abilityId) === node.present
      )
    const amount = subject.resources?.[node.resource]
    if (!nonnegative(amount)) return false
    if (node.kind === 'resource-state') {
      if (node.amount !== undefined)
        return node.comparison === 'at-most' ? amount <= node.amount : amount >= node.amount
      const maximum = subject.maximumResources?.[node.resource]
      if (!nonnegative(maximum) || maximum === 0) return false
      const current = BigInt(amount) * 10000n
      const threshold = BigInt(maximum) * BigInt(node.basisPoints)
      return node.comparison === 'at-most' ? current <= threshold : current >= threshold
    }
    const previous = subject.previousResources?.[node.resource]
    const maximum = subject.maximumResources?.[node.resource]
    if (!context.event || !nonnegative(previous) || !nonnegative(maximum) || maximum === 0)
      return false
    const now = BigInt(amount) * 10000n
    const before = BigInt(previous) * 10000n
    const threshold = BigInt(maximum) * BigInt(node.thresholdBasisPoints)
    return node.direction === 'below'
      ? before > threshold && now <= threshold
      : before < threshold && now >= threshold
  }
  return evaluate(requirement)
}

function nonnegative(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}
