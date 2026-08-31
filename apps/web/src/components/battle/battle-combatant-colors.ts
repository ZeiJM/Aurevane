export const BATTLE_COMBATANT_ACCENTS = [
  '#78a9d1',
  '#b08ad0',
  '#cf8ab8',
  '#8bb8de',
  '#bf9adb',
  '#dc9cc6',
] as const

const BATTLE_TEAM_ACCENTS = [
  ['#78a9d1', '#8bb8de', '#6696c2'],
  ['#b08ad0', '#bf9adb', '#9a73bc'],
  ['#cf8ab8', '#dc9cc6', '#b973a2'],
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
  const familyCount = Math.min(
    BATTLE_TEAM_ACCENTS.length,
    Math.max(1, Math.trunc(teamCount)),
  )
  const familyIndex = Math.abs(Math.trunc(teamIndex)) % familyCount
  const family = BATTLE_TEAM_ACCENTS[familyIndex] ?? BATTLE_TEAM_ACCENTS[0]
  const shadeIndex = Math.abs(Math.trunc(seatIndex)) % family.length
  return family[shadeIndex] ?? family[0]
}
