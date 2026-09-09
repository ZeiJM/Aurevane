import {
  CHARACTER_ATTRIBUTE_IDS,
  CHARACTER_CREATION_RULES_V1,
  type CharacterAttributeId,
  type CharacterAttributes,
} from './creation'
import {
  FOUNDATION_DISCIPLINES,
  FOUNDATION_DISCIPLINE_BASE_ATTRIBUTE_TOTAL,
} from './foundation-disciplines'
import { CURRENT_LEVEL_CAP } from './progression'

export const ATTRIBUTE_POINTS_PER_LEVEL = 1 as const
export const ATTRIBUTE_RESET_LIMIT_PER_WINDOW = 5 as const
export const ATTRIBUTE_RESET_WINDOW_DAYS = 30 as const
export const MINIMUM_CHARACTER_ATTRIBUTE = 1 as const
export const FOUNDATION_NON_FOCUS_ATTRIBUTE_CAP = 30 as const
export const PERSONAL_STARTING_ATTRIBUTE_POINT_POOL =
  CHARACTER_CREATION_RULES_V1.attributes.bonusBudget
export const STARTING_ATTRIBUTE_POINT_POOL =
  FOUNDATION_DISCIPLINE_BASE_ATTRIBUTE_TOTAL + PERSONAL_STARTING_ATTRIBUTE_POINT_POOL

export const CHARACTER_ATTRIBUTE_LABELS: Readonly<Record<CharacterAttributeId, string>> = {
  might: 'Might',
  finesse: 'Finesse',
  vitality: 'Vitality',
  agility: 'Agility',
  intellect: 'Intellect',
  resolve: 'Resolve',
}

export interface DisciplineAttributePolicy {
  disciplineId: string
  policyVersion: number
  /** Fixed Primary-owned values. Personal points are always layered on top of this profile. */
  baseAttributes: Readonly<Record<CharacterAttributeId, number>>
  /** A Discipline may intentionally focus on either two or three Core Stats. */
  focusAttributes: readonly CharacterAttributeId[]
  /** Optional ceilings for off-identity effective attributes only. */
  attributeCaps: Readonly<Partial<Record<CharacterAttributeId, number>>>
}

function offFocusCaps(focusAttributes: readonly CharacterAttributeId[]) {
  const focus = new Set<CharacterAttributeId>(focusAttributes)
  return Object.fromEntries(
    CHARACTER_ATTRIBUTE_IDS.filter((attributeId) => !focus.has(attributeId)).map((attributeId) => [
      attributeId,
      FOUNDATION_NON_FOCUS_ATTRIBUTE_CAP,
    ]),
  ) as Partial<Record<CharacterAttributeId, number>>
}

/**
 * Foundation identity policy v3. The Primary now owns a fixed 31-point Core Stat base, while all
 * creation/level points remain player-owned. Focus attributes stay uncapped and all non-focus
 * attributes retain the owner-approved 30-point effective ceiling.
 */
export const FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES: readonly DisciplineAttributePolicy[] =
  FOUNDATION_DISCIPLINES.map((discipline) => ({
    disciplineId: discipline.id,
    policyVersion: 3,
    baseAttributes: discipline.baseAttributes,
    focusAttributes: discipline.focusAttributes,
    attributeCaps: offFocusCaps(discipline.focusAttributes),
  }))

export type AttributeAllocationIssueCode =
  | 'invalid-level'
  | 'invalid-attribute'
  | 'below-discipline-base'
  | 'point-pool-exceeded'
  | 'point-pool-incomplete'
  | 'discipline-cap-exceeded'
  | 'invalid-discipline-policy'

export interface AttributeAllocationIssue {
  code: AttributeAllocationIssueCode
  field: string
  message: string
}

export interface AttributeAllocationValidationInput {
  attributes: CharacterAttributes
  level: number
  policy?: DisciplineAttributePolicy | null
  /** Respec/reset commits must spend the entire legal effective point pool. */
  requireFullPool?: boolean
}

export interface AttributeResetWindowState {
  windowStartedAt: string
  used: number
  remaining: number
  renewsAt: string
}

export interface PrimaryDisciplineAllocationProjection {
  attributes: CharacterAttributes
  personalAttributes: CharacterAttributes
  issues: readonly AttributeAllocationIssue[]
}

export function personalAttributePointPoolForLevel(level: number): number {
  assertLevel(level)
  return PERSONAL_STARTING_ATTRIBUTE_POINT_POOL + (level - 1) * ATTRIBUTE_POINTS_PER_LEVEL
}

export function attributePointPoolForLevel(level: number): number {
  assertLevel(level)
  return FOUNDATION_DISCIPLINE_BASE_ATTRIBUTE_TOTAL + personalAttributePointPoolForLevel(level)
}

export function attributePointsSpent(attributes: CharacterAttributes): number {
  let total = 0
  for (const attributeId of CHARACTER_ATTRIBUTE_IDS) {
    const value = attributes[attributeId]
    if (!Number.isSafeInteger(value) || value < MINIMUM_CHARACTER_ATTRIBUTE) {
      throw new RangeError(`${attributeId} must be a positive safe integer.`)
    }
    total += value
  }
  if (!Number.isSafeInteger(total)) {
    throw new RangeError('Attribute point total exceeded the safe integer range.')
  }
  return total
}

export function personalAttributesFromEffective(
  attributes: CharacterAttributes,
  policy: DisciplineAttributePolicy,
): CharacterAttributes {
  const result = {} as CharacterAttributes
  for (const attributeId of CHARACTER_ATTRIBUTE_IDS) {
    const value = attributes[attributeId] - policy.baseAttributes[attributeId]
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(
        `${CHARACTER_ATTRIBUTE_LABELS[attributeId]} is below the fixed ${policy.disciplineId} base.`,
      )
    }
    result[attributeId] = value
  }
  return result
}

export function effectiveAttributesFromPersonal(
  personalAttributes: CharacterAttributes,
  policy: DisciplineAttributePolicy,
): CharacterAttributes {
  const result = {} as CharacterAttributes
  for (const attributeId of CHARACTER_ATTRIBUTE_IDS) {
    const personal = personalAttributes[attributeId]
    if (!Number.isSafeInteger(personal) || personal < 0) {
      throw new RangeError('Personal Core Stat allocations must be non-negative safe integers.')
    }
    result[attributeId] = policy.baseAttributes[attributeId] + personal
  }
  return result
}

export function personalAttributePointsSpent(
  attributes: CharacterAttributes,
  policy: DisciplineAttributePolicy,
): number {
  const personal = personalAttributesFromEffective(attributes, policy)
  return CHARACTER_ATTRIBUTE_IDS.reduce((total, attributeId) => total + personal[attributeId], 0)
}

export function unspentAttributePoints(attributes: CharacterAttributes, level: number): number {
  return attributePointPoolForLevel(level) - attributePointsSpent(attributes)
}

export function foundationDisciplineAttributePolicy(
  disciplineId: string,
): DisciplineAttributePolicy | null {
  return (
    FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES.find(
      (candidate) => candidate.disciplineId === disciplineId,
    ) ?? null
  )
}

export function validateDisciplineAttributePolicy(
  policy: DisciplineAttributePolicy,
): readonly AttributeAllocationIssue[] {
  const issues: AttributeAllocationIssue[] = []
  if (
    !policy.disciplineId.trim() ||
    !Number.isInteger(policy.policyVersion) ||
    policy.policyVersion < 1
  ) {
    issues.push({
      code: 'invalid-discipline-policy',
      field: 'policy',
      message: 'Discipline attribute policy identity and version must be valid.',
    })
  }

  if (policy.focusAttributes.length < 2 || policy.focusAttributes.length > 3) {
    issues.push({
      code: 'invalid-discipline-policy',
      field: 'policy.focusAttributes',
      message: 'A Discipline must focus on either two or three Core Stats.',
    })
  }

  const focus = new Set<CharacterAttributeId>()
  for (const attributeId of policy.focusAttributes) {
    if (!CHARACTER_ATTRIBUTE_IDS.includes(attributeId)) {
      issues.push({
        code: 'invalid-discipline-policy',
        field: 'policy.focusAttributes',
        message: `Unknown focus attribute: ${attributeId}.`,
      })
      continue
    }
    if (focus.has(attributeId)) {
      issues.push({
        code: 'invalid-discipline-policy',
        field: `policy.focusAttributes.${attributeId}`,
        message: 'Focus attributes must be unique.',
      })
    }
    focus.add(attributeId)
  }

  let baseTotal = 0
  for (const attributeId of CHARACTER_ATTRIBUTE_IDS) {
    const base = policy.baseAttributes[attributeId]
    if (!Number.isSafeInteger(base) || base < MINIMUM_CHARACTER_ATTRIBUTE) {
      issues.push({
        code: 'invalid-discipline-policy',
        field: `policy.baseAttributes.${attributeId}`,
        message: 'Discipline base attributes must be positive safe integers.',
      })
      continue
    }
    baseTotal += base
  }
  if (baseTotal !== FOUNDATION_DISCIPLINE_BASE_ATTRIBUTE_TOTAL) {
    issues.push({
      code: 'invalid-discipline-policy',
      field: 'policy.baseAttributes',
      message: `Discipline base attributes must total ${FOUNDATION_DISCIPLINE_BASE_ATTRIBUTE_TOTAL}.`,
    })
  }

  for (const [rawAttributeId, cap] of Object.entries(policy.attributeCaps)) {
    const attributeId = rawAttributeId as CharacterAttributeId
    if (!CHARACTER_ATTRIBUTE_IDS.includes(attributeId)) {
      issues.push({
        code: 'invalid-discipline-policy',
        field: `policy.attributeCaps.${rawAttributeId}`,
        message: 'Attribute cap references an unknown attribute.',
      })
      continue
    }
    if (focus.has(attributeId)) {
      issues.push({
        code: 'invalid-discipline-policy',
        field: `policy.attributeCaps.${attributeId}`,
        message: 'Focus attributes must remain uncapped by Discipline identity policy.',
      })
    }
    if (!Number.isSafeInteger(cap) || cap < MINIMUM_CHARACTER_ATTRIBUTE) {
      issues.push({
        code: 'invalid-discipline-policy',
        field: `policy.attributeCaps.${attributeId}`,
        message: 'Attribute caps must be positive safe integers.',
      })
    }
  }

  return issues
}

export function validateAttributeAllocation(
  input: AttributeAllocationValidationInput,
): readonly AttributeAllocationIssue[] {
  const issues: AttributeAllocationIssue[] = []
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > CURRENT_LEVEL_CAP) {
    issues.push({
      code: 'invalid-level',
      field: 'level',
      message: `Character Level must be a whole number from 1 to ${CURRENT_LEVEL_CAP}.`,
    })
    return issues
  }

  const policyIssues = input.policy ? validateDisciplineAttributePolicy(input.policy) : []
  issues.push(...policyIssues)
  if (policyIssues.length > 0) return issues

  let total = 0
  for (const attributeId of CHARACTER_ATTRIBUTE_IDS) {
    const value = input.attributes[attributeId]
    if (!Number.isSafeInteger(value) || value < MINIMUM_CHARACTER_ATTRIBUTE) {
      issues.push({
        code: 'invalid-attribute',
        field: `attributes.${attributeId}`,
        message: `${CHARACTER_ATTRIBUTE_LABELS[attributeId]} must be at least ${MINIMUM_CHARACTER_ATTRIBUTE}.`,
      })
      continue
    }
    total += value

    const base = input.policy?.baseAttributes[attributeId]
    if (base !== undefined && value < base) {
      issues.push({
        code: 'below-discipline-base',
        field: `attributes.${attributeId}`,
        message: `${CHARACTER_ATTRIBUTE_LABELS[attributeId]} cannot be below the ${input.policy?.disciplineId ?? 'Primary Discipline'} base of ${base}.`,
      })
    }

    const cap = input.policy?.attributeCaps[attributeId]
    if (cap !== undefined && value > cap) {
      issues.push({
        code: 'discipline-cap-exceeded',
        field: `attributes.${attributeId}`,
        message: `${CHARACTER_ATTRIBUTE_LABELS[attributeId]} exceeds the ${input.policy?.disciplineId ?? 'Primary Discipline'} off-identity cap of ${cap}.`,
      })
    }
  }

  if (!Number.isSafeInteger(total)) {
    issues.push({
      code: 'point-pool-exceeded',
      field: 'attributes',
      message: 'Attribute point total exceeded the safe integer range.',
    })
    return issues
  }

  const pool = attributePointPoolForLevel(input.level)
  if (total > pool) {
    issues.push({
      code: 'point-pool-exceeded',
      field: 'attributes',
      message: `Level ${input.level} provides ${pool} total effective Core Stat points, but ${total} are assigned.`,
    })
  } else if (input.requireFullPool && total !== pool) {
    issues.push({
      code: 'point-pool-incomplete',
      field: 'attributes',
      message: `A full redistribution must assign all ${pool} available effective Core Stat points.`,
    })
  }

  return issues
}

/**
 * Legacy compatibility helper: validates an effective allocation against one proposed policy without
 * mutating it. New Primary-swap paths should use projectAllocationForPrimaryDisciplineChange so the
 * player-owned portion moves intact from the old base to the new base.
 */
export function validateAllocationForPrimaryDisciplineChange(
  attributes: CharacterAttributes,
  level: number,
  proposedPolicy: DisciplineAttributePolicy,
): readonly AttributeAllocationIssue[] {
  return validateAttributeAllocation({ attributes, level, policy: proposedPolicy })
}

export function projectAllocationForPrimaryDisciplineChange(input: {
  attributes: CharacterAttributes
  level: number
  currentPolicy: DisciplineAttributePolicy
  proposedPolicy: DisciplineAttributePolicy
}): PrimaryDisciplineAllocationProjection {
  const currentIssues = validateAttributeAllocation({
    attributes: input.attributes,
    level: input.level,
    policy: input.currentPolicy,
  })
  if (currentIssues.length > 0) {
    return {
      attributes: { ...input.attributes },
      personalAttributes: {
        might: 0,
        finesse: 0,
        vitality: 0,
        agility: 0,
        intellect: 0,
        resolve: 0,
      },
      issues: currentIssues,
    }
  }

  const personalAttributes = personalAttributesFromEffective(input.attributes, input.currentPolicy)
  const attributes = effectiveAttributesFromPersonal(personalAttributes, input.proposedPolicy)
  const issues = validateAttributeAllocation({
    attributes,
    level: input.level,
    policy: input.proposedPolicy,
  })
  return { attributes, personalAttributes, issues }
}

export function resolveAttributeResetWindow(input: {
  windowStartedAt: string | null
  used: number
  now: string
}): AttributeResetWindowState {
  if (!Number.isSafeInteger(input.used) || input.used < 0) {
    throw new RangeError('Attribute reset usage must be a non-negative safe integer.')
  }
  const nowMs = Date.parse(input.now)
  if (!Number.isFinite(nowMs)) throw new RangeError('Attribute reset server time is invalid.')

  const durationMs = ATTRIBUTE_RESET_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const existingStartMs =
    input.windowStartedAt === null ? Number.NaN : Date.parse(input.windowStartedAt)
  const expired = !Number.isFinite(existingStartMs) || nowMs >= existingStartMs + durationMs
  const windowStartedAtMs = expired ? nowMs : existingStartMs
  const used = expired ? 0 : Math.min(input.used, ATTRIBUTE_RESET_LIMIT_PER_WINDOW)

  return {
    windowStartedAt: new Date(windowStartedAtMs).toISOString(),
    used,
    remaining: Math.max(0, ATTRIBUTE_RESET_LIMIT_PER_WINDOW - used),
    renewsAt: new Date(windowStartedAtMs + durationMs).toISOString(),
  }
}

export function consumeAttributeReset(state: AttributeResetWindowState): AttributeResetWindowState {
  if (state.remaining <= 0 || state.used >= ATTRIBUTE_RESET_LIMIT_PER_WINDOW) {
    throw new Error('No attribute resets remain in the current 30-day window.')
  }
  return {
    ...state,
    used: state.used + 1,
    remaining: state.remaining - 1,
  }
}

function assertLevel(level: number): void {
  if (!Number.isInteger(level) || level < 1 || level > CURRENT_LEVEL_CAP) {
    throw new RangeError(`Character Level must be a whole number from 1 to ${CURRENT_LEVEL_CAP}.`)
  }
}
