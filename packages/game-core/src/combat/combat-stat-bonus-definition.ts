export const COMBAT_BONUS_STATS = [
  'movement',
  'jump',
  'physical-power',
  'mystic-power',
  'physical-defense',
  'mystic-defense',
  'evasion',
  'initiative',
] as const
export type CombatBonusStat = (typeof COMBAT_BONUS_STATS)[number]
export const COMBAT_BONUS_STAT_LABELS: Readonly<Record<CombatBonusStat, string>> = {
  movement: 'Movement (tiles)',
  jump: 'Jump (elevation)',
  'physical-power': 'Physical Power (rating)',
  'mystic-power': 'Mystic Power (rating)',
  'physical-defense': 'Physical Defense (rating)',
  'mystic-defense': 'Mystic Defense (rating)',
  evasion: 'Evasion (basis points; 100 = 1%)',
  initiative: 'Initiative (rating)',
}
