import {
  CHARACTER_ATTRIBUTE_IDS,
  CHARACTER_CREATION_RULES_V1,
  type CharacterAttributeId,
  type CharacterAttributes,
} from './creation'
import { CURRENT_LEVEL_CAP } from './progression'

export const ATTRIBUTE_POINTS_PER_LEVEL = 1 as const
export const ATTRIBUTE_RESET_LIMIT_PER_WINDOW = 5 as const
export const ATTRIBUTE_RESET_WINDOW_DAYS = 30 as const
export const MINIMUM_CHARACTER_ATTRIBUTE = 1 as const
export const STARTING_ATTRIBUTE_POINT_POOL =
  CHARACTER_CREATION_RULES_V1.attributes.baseline * CHARACTER_ATTRIBUTE_IDS.length +
  CHARACTER_CREATION_RULES_V1.attributes.bonusBudget

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
  /** Attributes that express the Discipline's intended strengths. Focus attributes are not capped. */
  focusAttributes: readonly CharacterAttributeId[]
  /**
   * Optional ceilings for off-identity attributes only. Missing entries are intentionally uncapped.
   * Balance content may add ceilings later without changing allocation validation semantics.
   */
  attributeCaps: Readonly<Partial<Record<CharacterAttributeId, number>>>
}

/**
 * Initial Foundation identity metadata. Numeric off-identity ceilings remain deliberately unset until
 * their balance values are owner-approved; the validator is already able to enforce them once authored.
 */
export const FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES = [
  {
    disciplineId: 'vanguard',
    policyVersion: 1,
    focusAttributes: ['might', 'vitality'],
    attributeCaps: {},
  },
  {
    disciplineId: 'farstrider',
    policyVersion: 1,
    focusAttributes: ['finesse', 'agility'],
    attributeCaps: {},
  },
  {
    disciplineId: 'shadehand',
    policyVersion: 1,
    focusAttributes: ['finesse', 'agility'],
    attributeCaps: {},
  },
  {
    disciplineId: 'ironfist',
    policyVersion: 1,
    focusAttributes: ['might', 'agility'],
    attributeCaps: {},
  },
  {
    disciplineId: 'aetherist',
    policyVersion: 1,
    focusAttributes: ['intellect', 'resolve'],
    attributeCaps: {},
  },
  {
    disciplineId: 'lifebinder',
    policyVersion: 1,
    focusAttributes: ['intellect', 'resolve'],
    attributeCaps: {},
  },
] as const satisfies readonly DisciplineAttributePolicy[]

export type AttributeAllocationIssueCode =
  | 'invalid-level'
  | 'invalid-attribute'
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
  /** Respec/reset commits must spend the entire legal point pool. */
  requireFullPool?: boolean
}

export interface AttributeResetWindowState {
  windowStartedAt: string
  used: number
  remaining: number
  renewsAt: string
}

export function attributePointPoolForLevel(level: number): number {
  assertLevel(level)
  return STARTING_ATTRIBUTE_POINT_POOL + (level - 1) * ATTRIBUTE_POINTS_PER_LEVEL
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
  if (!policy.disciplineId.trim() || !Number.isInteger(policy.policyVersion) || policy.policyVersion < 1) {
    issues.push({
      code: 'invalid-discipline-policy',
      field: 'policy',
      message: 'Discipline attribute policy identity and version must be valid.',
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
      message: `Level ${input.level} provides ${pool} total attribute points, but ${total} are assigned.`,
    })
  } else if (input.requireFullPool && total !== pool) {
    issues.push({
      code: 'point-pool-incomplete',
      field: 'attributes',
      message: `A full redistribution must assign all ${pool} available attribute points.`,
    })
  }

  return issues
}

/**
 * Primary changes validate the existing personal allocation against the proposed policy only. The
 * allocation is never rewritten, clamped, or destroyed; callers can require redistribution when issues
 * are returned.
 */
export function validateAllocationForPrimaryDisciplineChange(
  attributes: CharacterAttributes,
  level: number,
  proposedPolicy: DisciplineAttributePolicy,
): readonly AttributeAllocationIssue[] {
  return validateAttributeAllocation({ attributes, level, policy: proposedPolicy })
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
  const existingStartMs = input.windowStartedAt === null ? Number.NaN : Date.parse(input.windowStartedAt)
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
