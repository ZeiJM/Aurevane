export const SUPPORT_ACTION_IDS = ['basic.guard', 'basic.recover', 'basic.recover.mp'] as const
export type SupportActionId = (typeof SUPPORT_ACTION_IDS)[number]
export const DEFAULT_SUPPORT_ACTION_ID: SupportActionId = 'basic.guard'

export function parseSupportActionId(value: unknown): SupportActionId | null {
  return SUPPORT_ACTION_IDS.find((id) => id === value) ?? null
}
