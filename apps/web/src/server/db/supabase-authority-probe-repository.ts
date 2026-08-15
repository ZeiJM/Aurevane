import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'
import type { IdempotentCommandInput } from '@aurevane/db/transactional-command'
import { parseAuthorityProbePersistenceRows } from '@aurevane/validation/foundation/authority-probe'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type {
  AuthorityProbeReceipt,
  AuthorityProbeRepository,
} from '@/server/foundation/authority-probe-service'

export function createSupabaseAuthorityProbeRepository(): AuthorityProbeRepository {
  return {
    async execute(input: IdempotentCommandInput) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('execute_foundation_authority_probe', {
        p_actor_key: input.actorKey,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      })

      if (error) {
        if (error.code === '22023') {
          throw new AurevaneError(
            'IDEMPOTENCY_CONFLICT',
            'That request key was already used for a different request.',
          )
        }

        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'The server could not save that request right now.',
        )
      }

      const row = parseAuthorityProbePersistenceRows(data)

      if (!row) {
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'The server returned an invalid persistence result.',
        )
      }

      const result: AuthorityProbeReceipt = {
        receiptId: row.receipt_id,
        acceptedAt: row.accepted_at,
      }

      return {
        result,
        replayed: row.replayed,
      }
    },
  }
}
