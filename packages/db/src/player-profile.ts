export interface PlayerProfileRecord {
  userId: string
  createdAt: string
}

export interface PlayerProfileRepository {
  findByUserId(userId: string): Promise<PlayerProfileRecord | null>
}
