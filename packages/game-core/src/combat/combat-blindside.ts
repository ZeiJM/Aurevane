import type { CombatStatusInstance } from './actions'
import { combatStatusApplications } from './combat-status-applications'

export interface BlindsideModifiers {
  readonly side: number
  readonly rear: number
}

/** A separate immutable status identity preserves the former caster buff in old captures. */
export const BLINDSIDE_DEBUFF_STATUS_ID = 'blindside-vulnerability'
export function isBlindsideStatusId(statusId: string): boolean {
  return statusId === 'blindside' || statusId === BLINDSIDE_DEBUFF_STATUS_ID
}
export const BLINDSIDE_DEBUFF_DESCRIPTION =
  'Take increased Skill damage from the side or rear. Front hits and Basic Attack are unchanged.'

export const BLINDSIDE_FRONT_MULTIPLIER_BASIS_POINTS = 10000

export const DEFAULT_BLINDSIDE_MODIFIERS: BlindsideModifiers = { side: 16000, rear: 22000 }

export function validateBlindsideModifiers(value: unknown): asserts value is BlindsideModifiers {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Blindside requires side and rear damage percentages.')
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 2 ||
    !['side', 'rear'].every(
      (key) => Number.isSafeInteger(record[key]) && (record[key] as number) >= 10000,
    )
  )
    throw new RangeError(
      'Blindside side and rear damage must be safe integer basis points of at least 100%.',
    )
}

export function blindsideDamageDescription(
  modifiers = DEFAULT_BLINDSIDE_MODIFIERS,
  legacyActivation = false,
): string {
  return `For one owner turn, Skill damage is ${BLINDSIDE_FRONT_MULTIPLIER_BASIS_POINTS / 100}% from the front, ${modifiers.side / 100}% from the side and ${modifiers.rear / 100}% from the rear per application. ${legacyActivation ? 'Activates instantly' : 'Activates instantly only when the granting Skill hits an enemy from the side or rear with a damage modifier above 100%; front hits and misses do not grant or refresh it'}; expires at the end of your turn. Basic Attack is unchanged.`
}

export function blindsideDebuffDescription(modifiers = DEFAULT_BLINDSIDE_MODIFIERS): string {
  return `Take ${modifiers.side / 100}% of normal Skill damage from the side and ${modifiers.rear / 100}% from the rear per application. Front hits and Basic Attack are unchanged.`
}

export function blindsideStatusDescription(
  status: CombatStatusInstance,
  legacyActivation = false,
): string {
  const applications = combatStatusApplications(status)
  const profiles = new Map<string, { modifiers: BlindsideModifiers; stacks: number }>()
  for (const application of applications) {
    const modifiers = application.blindsideModifiersBasisPoints ?? DEFAULT_BLINDSIDE_MODIFIERS
    const key = `${modifiers.side}/${modifiers.rear}`
    const previous = profiles.get(key)
    profiles.set(key, { modifiers, stacks: (previous?.stacks ?? 0) + application.stacks })
  }
  if (status.statusId === BLINDSIDE_DEBUFF_STATUS_ID) {
    if (profiles.size === 1) return blindsideDebuffDescription([...profiles.values()][0]!.modifiers)
    return `Recorded Skill damage per application: ${[...profiles.values()].map(({ modifiers, stacks }) => `${stacks}× (${modifiers.side / 100}% side, ${modifiers.rear / 100}% rear)`).join('; ')}. Front hits and Basic Attack are unchanged.`
  }
  if (profiles.size === 1)
    return blindsideDamageDescription([...profiles.values()][0]!.modifiers, legacyActivation)
  return `For one owner turn, Skill damage is ${BLINDSIDE_FRONT_MULTIPLIER_BASIS_POINTS / 100}% from the front. Recorded side/rear damage per application: ${[...profiles.values()].map(({ modifiers, stacks }) => `${stacks}× (${modifiers.side / 100}% side, ${modifiers.rear / 100}% rear)`).join('; ')}. ${legacyActivation ? 'Activates instantly' : 'Activates instantly only when the granting Skill hits an enemy from the side or rear with a damage modifier above 100%; front hits and misses do not grant or refresh it'}; expires at the end of your turn. Basic Attack is unchanged.`
}
