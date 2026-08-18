export interface PlayerProfileRecord {
  userId: string
  createdAt: string
  avatarUrl: string | null
  equippedTitle: string | null
  combatKeybinds?: unknown
}

export interface PlayerProfileRepository {
  findByUserId(userId: string): Promise<PlayerProfileRecord | null>
}
