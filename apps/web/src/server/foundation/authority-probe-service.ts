import {
  toUserActorKey,
  type AuthoritativeCommandContext,
} from '@aurevane/game-core/command'
import type {
  IdempotentCommandInput,
  TransactionalCommandRepository,
  TransactionalCommandResult,
} from '@aurevane/db/transactional-command'

export const AUTHORITY_PROBE_COMMAND = 'foundation.authority_probe' as const
const AUTHORITY_PROBE_FINGERPRINT = 'foundation.authority_probe:v1' as const

export interface AuthorityProbeReceipt {
  receiptId: string
  acceptedAt: string
}

export type AuthorityProbeRepository = TransactionalCommandRepository<
  IdempotentCommandInput,
  AuthorityProbeReceipt
>

export async function executeAuthorityProbe(
  context: AuthoritativeCommandContext,
  repository: AuthorityProbeRepository,
): Promise<TransactionalCommandResult<AuthorityProbeReceipt>> {
  return repository.execute({
    actorKey: toUserActorKey(context.actor),
    commandName: AUTHORITY_PROBE_COMMAND,
    idempotencyKey: context.idempotencyKey,
    requestFingerprint: AUTHORITY_PROBE_FINGERPRINT,
  })
}
