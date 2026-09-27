export const UNBOUNDED_EFFECT_APPLICATIONS_RULES_VERSION = 5 as const

export function usesUnboundedEffectApplications(state: {
  statBridge?: { rulesVersion?: number }
}): boolean {
  return (state.statBridge?.rulesVersion ?? 0) >= UNBOUNDED_EFFECT_APPLICATIONS_RULES_VERSION
}
