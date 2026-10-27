export interface ModerationPlayer {
  characterId: string
  userId: string
  name: string
  protected: boolean
}
export interface ModerationRecord {
  userId: string
  revision: string
  active: boolean
  permanent: boolean
  expiresAt: string | null
  protected: boolean
  nextCursor: string | null
  history: {
    actor: string
    id: string
    action: 'ban' | 'edit' | 'lift'
    reason: string
    occurredAt: string
    until: string
  }[]
}
