export interface IdempotentCommandInput {
  actorKey: string
  commandName: string
  idempotencyKey: string
  requestFingerprint: string
}

export interface TransactionalCommandResult<TResult> {
  result: TResult
  replayed: boolean
}

export interface TransactionalCommandRepository<TInput extends IdempotentCommandInput, TResult> {
  execute(input: TInput): Promise<TransactionalCommandResult<TResult>>
}
