import 'server-only'

import { createSupabaseProgressionRepository } from '@/server/progression/supabase-progression-repository'

import {
  executeEventRewardClaim,
  type ExecuteEventRewardClaimOutcome,
} from './event-reward-execution-service'
import { createSupabaseEventRewardExecutionStore } from './supabase-event-reward-execution-store'

export function executeServerEventRewardClaim(
  reservationId: string,
): Promise<ExecuteEventRewardClaimOutcome> {
  return executeEventRewardClaim(
    reservationId,
    createSupabaseEventRewardExecutionStore(),
    createSupabaseProgressionRepository(),
  )
}
