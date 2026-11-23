/** Shared maximum for editable effect lifetimes; fixed lifecycle mechanics stay unchanged. */
export const CURRENT_EFFECT_DURATION_MAXIMUM_TURNS = 99 as const
/** Recovery applies once immediately, then once per authored duration turn. */
export const CURRENT_RECOVERY_MAXIMUM_APPLICATIONS = CURRENT_EFFECT_DURATION_MAXIMUM_TURNS + 1
