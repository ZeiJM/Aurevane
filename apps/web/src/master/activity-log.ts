export interface MasterActivityEntry {
  readonly id: string
  readonly occurredAt: string
  readonly actor: string
  readonly action: string
  readonly subject: string
  readonly detail: string
}

export interface MasterActivityFeed {
  readonly entries: readonly MasterActivityEntry[]
  readonly weekStartsAt: string
  readonly resetsAt: string
  readonly nextCursor: string | null
}
