/** Current choices; retired identities remain readable by the historical parser below. */
export const CURRENT_SUPPORT_ACTION_IDS = [
  'basic.recover',
  'basic.recover.mp',
  'basic.pilfer',
  'basic.fleetstep',
  'basic.invocation',
] as const
export type CurrentSupportActionId = (typeof CURRENT_SUPPORT_ACTION_IDS)[number]
export const SUPPORT_ACTION_IDS = ['basic.guard', ...CURRENT_SUPPORT_ACTION_IDS] as const
export type SupportActionId = (typeof SUPPORT_ACTION_IDS)[number]
export const DEFAULT_SUPPORT_ACTION_ID: CurrentSupportActionId = 'basic.recover'

export function parseSupportActionId(value: unknown): SupportActionId | null {
  return SUPPORT_ACTION_IDS.find((id) => id === value) ?? null
}
export function parseCurrentSupportActionId(value: unknown): CurrentSupportActionId | null {
  return CURRENT_SUPPORT_ACTION_IDS.find((id) => id === value) ?? null
}
