export const BATTLE_COMBATANT_ACCENTS = [
  '#69cf8c',
  '#e27d68',
  '#7aa7e8',
  '#d7ad62',
  '#b08be0',
  '#62c7d5',
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
  const safeTeamCount = Math.max(1, Math.trunc(teamCount))
  const colorIndex = Math.max(0, Math.trunc(seatIndex)) * safeTeamCount + Math.max(0, teamIndex)
  return battleCombatantAccent(colorIndex)
}
