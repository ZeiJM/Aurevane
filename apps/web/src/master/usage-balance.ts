export interface BalanceOutcomes {
  source: 'pvp' | 'pve-recruit'
  appearances: number
  wins: number
  losses: number
  draws: number
}
export interface UsageBalanceReport {
  contentKey: string
  subjectKind: 'discipline' | 'skill' | 'unsupported'
  availableWeeks?: string[]
  asOf: string
  weekStartsAt: string
  weekEndsAt: string
  current: {
    primaryPlayers: number
    secondaryPlayers: number
    primaryCharacters: number
    secondaryCharacters: number
    totalPlayers: number
    totalCharacters: number
  }
  skills: {
    skillId: string
    name: string
    equippedPlayers: number
    equippedCharacters: number
    actualUses: number
    usedBattles: number
  }[]
  weekly: BalanceOutcomes[]
  pairs: { primary: string; secondary: string | null; players: number; characters: number }[]
  matchups: (BalanceOutcomes & { opponent: string })[]
  coverage: {
    legacyHistoryAvailable: false
    rosterTruncated: boolean
    battlesTruncated: boolean
    collectedBattles: number
    collectionStartedAt: string | null
  }
}
