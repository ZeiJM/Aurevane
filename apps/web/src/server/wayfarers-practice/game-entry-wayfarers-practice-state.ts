import type {
  TrainingReportRecord,
  WayfarersPracticeRepository,
} from '@aurevane/db/wayfarers-practice'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { isAurevaneError } from '@aurevane/game-core/errors'

import { serverLogger, type ServerLogger } from '../logging'
import { loadTrainingReport } from './wayfarers-practice-service'

export type GameEntryWayfarersPracticeState =
  | { kind: 'ready'; report: TrainingReportRecord | null }
  | { kind: 'persistence-unavailable' }

export async function loadGameEntryWayfarersPracticeState(
  actor: AuthenticatedActor,
  characterId: string,
  repository: WayfarersPracticeRepository,
  logger: ServerLogger = serverLogger,
): Promise<GameEntryWayfarersPracticeState> {
  try {
    return {
      kind: 'ready',
      report: await loadTrainingReport(actor, characterId, repository),
    }
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE') {
      logger.error('wayfarers_practice.persistence_unavailable')
      return { kind: 'persistence-unavailable' }
    }
    throw error
  }
}
