export interface AuthenticatedActor {
  userId: string
}

export interface AuthoritativeCommandContext {
  actor: AuthenticatedActor
  idempotencyKey: string
}

export function toUserActorKey(actor: AuthenticatedActor): string {
  return `user:${actor.userId}`
}
