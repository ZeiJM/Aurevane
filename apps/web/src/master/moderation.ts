export interface ModerationPlayer {
  characterId: string
  userId: string
  name: string
  protected: boolean
}
export interface ActiveModerationBan {
  userId: string
  characterId: string | null
  name: string
  revision: string
  active: true
  permanent: boolean
  expiresAt: string | null
  protected: boolean
  reason: string
}
export interface ActiveModerationBans {
  bans: ActiveModerationBan[]
  nextCursor: string | null
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
