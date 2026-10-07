/** Registered, data-only presets. Authored content cannot supply executable effects. */
export const COMBAT_GROUND_VISUAL_PRESETS = [
  { id: 'embers', label: 'Embers', description: 'Warm embers and rising sparks.' },
  { id: 'frost', label: 'Frost', description: 'A cold shimmer and drifting frost.' },
  { id: 'arcane-pulse', label: 'Arcane pulse', description: 'A slow pulse of arcane light.' },
] as const
export type GroundVisualPresetId = (typeof COMBAT_GROUND_VISUAL_PRESETS)[number]['id']
export function isGroundVisualPresetId(value: unknown): value is GroundVisualPresetId {
  return COMBAT_GROUND_VISUAL_PRESETS.some((preset) => preset.id === value)
}
