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

/** Safe render data: deliberately excludes caster, action identity and execution payload. */
export interface PublicCombatGroundArea {
  id: string
  tiles: readonly { x: number; y: number }[]
  activationRound: number
  expiresAtRound: number
  visualPresetId: GroundVisualPresetId
}
export function projectPublicCombatGroundAreas(
  areas: readonly PublicCombatGroundArea[],
  round: number,
  lifecycle: string,
): readonly PublicCombatGroundArea[] {
  if (lifecycle !== 'active') return []
  return areas
    .filter((area) => area.expiresAtRound > round)
    .map((area) => ({
      id: area.id,
      tiles: area.tiles.map((tile) => ({ x: tile.x, y: tile.y })),
      activationRound: area.activationRound,
      expiresAtRound: area.expiresAtRound,
      visualPresetId: area.visualPresetId,
    }))
}

export function combatGroundAreaDescription(
  area: { durationRounds: number; timing?: 'instant' | 'next-round' | 'delayed' },
  policyTiming: 'instant' | 'next-round' | 'delayed' = 'next-round',
): string {
  const timing = area.timing ?? policyTiming
  return `Ground: stays on the affected tiles for ${area.durationRounds} ${area.durationRounds === 1 ? 'round' : 'rounds'}, ${timing === 'instant' ? 'starting immediately' : timing === 'delayed' ? 'starting two rounds after cast' : 'starting next round'}. The cast affects eligible units there; entering the active area applies its unit effects once per character’s turn. Each cast has its own allowance.`
}
