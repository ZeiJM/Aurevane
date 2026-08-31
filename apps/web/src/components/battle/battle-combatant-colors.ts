export const BATTLE_COMBATANT_ACCENTS = [
  '#d0aa62',
  '#aa86cf',
  '#b9aa92',
  '#e0bd79',
  '#c09bdd',
  '#9c8a74',
] as const

const BATTLE_TEAM_ACCENTS = [
  ['#d0aa62', '#e0bd79', '#b98a4f'],
  ['#aa86cf', '#c09bdd', '#8f6caf'],
  ['#b9aa92', '#d0c0a6', '#9c8a74'],
] as const

export function battleCombatantAccent(index: number): string {
  const normalized = Math.abs(Math.trunc(index)) % BATTLE_COMBATANT_ACCENTS.length
  return BATTLE_COMBATANT_ACCENTS[normalized]
}

export function pvpParticipantAccent(
  teamIndex: number,
  seatIndex: number,
  teamCount: number,
): string {
  const familyCount = Math.min(BATTLE_TEAM_ACCENTS.length, Math.max(1, Math.trunc(teamCount)))
  const familyIndex = Math.abs(Math.trunc(teamIndex)) % familyCount
  const family = BATTLE_TEAM_ACCENTS[familyIndex] ?? BATTLE_TEAM_ACCENTS[0]
  const shadeIndex = Math.abs(Math.trunc(seatIndex)) % family.length
  return family[shadeIndex] ?? family[0]
}
