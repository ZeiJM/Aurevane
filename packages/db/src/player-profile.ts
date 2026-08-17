export interface PlayerProfileRecord {
  userId: string
  createdAt: string
  combatKeybinds: unknown
}

export interface PlayerProfileRepository {
  findByUserId(userId: string): Promise<PlayerProfileRecord | null>
}
