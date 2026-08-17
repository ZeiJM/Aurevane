import type { WayfarersPracticeRepository } from '@aurevane/db/wayfarers-practice'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseSetPracticePlanRequest,
  parseTrainingReportClaimRequest,
} from '@aurevane/validation/player/wayfarers-practice'

import { toServerErrorResponse } from '../http/error-response'
import { claimTrainingReport, setPracticePlan } from './wayfarers-practice-service'

export interface WayfarersPracticeHandlerDependencies {
  getActor(): Promise<AuthenticatedActor>
  repository: WayfarersPracticeRepository
}

export async function handleSetPracticePlanRequest(
  request: Request,
  dependencies: WayfarersPracticeHandlerDependencies,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const input = parseSetPracticePlanRequest(await readJson(request))
    if (!input) {
      throw new AurevaneError('INVALID_REQUEST', 'The Practice plan request was not valid.')
    }

    const outcome = await setPracticePlan(
      {
        actor,
        characterId: input.characterId,
        plannedWindow: input.plannedWindow,
        idempotencyKey: input.idempotencyKey,
      },
      dependencies.repository,
    )

    return Response.json(
      {
        plan: outcome.plan,
        replayed: outcome.replayed,
      },
      {
        status: outcome.replayed ? 200 : 201,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function handleTrainingReportClaimRequest(
  request: Request,
  dependencies: WayfarersPracticeHandlerDependencies,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const input = parseTrainingReportClaimRequest(await readJson(request))
    if (!input) {
      throw new AurevaneError('INVALID_REQUEST', 'The Training Report claim request was not valid.')
    }

    const outcome = await claimTrainingReport(
      {
        actor,
        characterId: input.characterId,
        reportId: input.reportId,
        idempotencyKey: input.idempotencyKey,
      },
      dependencies.repository,
    )

    return Response.json(
      {
        claim: {
          reportId: outcome.claim.reportId,
          characterId: outcome.claim.characterId,
          requestedCharacterXp: outcome.claim.requestedCharacterXp,
          appliedCharacterXp: outcome.claim.appliedCharacterXp,
          levelBefore: outcome.claim.levelBefore,
          levelAfter: outcome.claim.levelAfter,
          restedMomentumApplied: outcome.claim.restedMomentumApplied,
          restedMomentumAfter: outcome.claim.restedMomentumAfter,
          claimedAt: outcome.claim.claimedAt,
        },
        replayed: outcome.replayed,
      },
      {
        status: outcome.replayed ? 200 : 201,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}
