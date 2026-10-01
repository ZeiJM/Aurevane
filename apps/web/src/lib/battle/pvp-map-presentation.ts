import {
  getTacticalHallArena,
  type TacticalHallArenaId,
} from '@aurevane/game-core/combat/tactical-hall-arenas'
import type { PvpMapSize } from '@aurevane/validation/combat/pvp'

export const PVP_MAP_SIZES = ['small', 'medium', 'large'] as const satisfies readonly PvpMapSize[]

const MAP_PROFILES: Record<PvpMapSize, { label: string; arenaId: TacticalHallArenaId }> = {
  small: { label: 'Small', arenaId: 'duel-yard' },
  medium: { label: 'Medium', arenaId: 'crossroads-court' },
  large: { label: 'Large', arenaId: 'terraced-yard' },
}

/** New PvP maps share the AI arena geometry; saved battles keep their recorded board. */
export function pvpMapProfile(size: PvpMapSize) {
  const profile = MAP_PROFILES[size]
  const { width, height } = getTacticalHallArena(profile.arenaId)
  return { ...profile, width, height, description: `${profile.label} · ${width}×${height}` }
}
