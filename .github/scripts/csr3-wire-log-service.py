from pathlib import Path

service = Path('apps/web/src/server/battle/battle-log-service.ts')
text = service.read_text(encoding='utf-8')

import_marker = """import type {
  BattleEventCursor,
  BattleEventRecord,
  BattleEventRepository,
} from '@aurevane/db/battle-session'
"""
imports = import_marker + """
import type { BattleHistoryPrivacyRepository } from './battle-history-privacy-authority'
import { projectBattleHistoryForViewer } from './battle-history-privacy'
"""
if import_marker not in text:
    raise SystemExit('battle log import seam changed')
text = text.replace(import_marker, imports, 1)

switch_marker = """  switch (eventType) {
    case 'combatant_moved': {
"""
switch_replacement = """  switch (eventType) {
    case 'hidden_combat_action': {
      const actorCombatantId = stringValue(event.actorCombatantId)
      return createEntry(record, eventType, {
        message: `${combatantLabel(actorCombatantId)} performed an action.`,
        messageTemplate: '{actor} performed an action.',
        actorCombatantId,
        kind: 'offense',
        headline: 'Action',
      })
    }
    case 'combatant_moved': {
"""
if switch_marker not in text:
    raise SystemExit('battle log hidden action seam changed')
text = text.replace(switch_marker, switch_replacement, 1)

append_marker = """export function createBattleLogService(repository: BattleEventRepository): BattleLogService {
  return {
    async getLog(userId, battleSessionId) {
      const records = await collectBattleEventHistory((pageSize, before) =>
        before
          ? repository.findBattleEvents(userId, battleSessionId, pageSize, before)
          : repository.findBattleEvents(userId, battleSessionId, pageSize),
      )
      return buildBattleLogView(battleSessionId, records)
    },
  }
}
"""
viewer_safe = append_marker + """

export function createViewerSafeBattleLogService(
  repository: BattleEventRepository,
  privacyRepository: BattleHistoryPrivacyRepository,
): BattleLogService {
  return {
    async getLog(userId, battleSessionId) {
      const records = await collectBattleEventHistory((pageSize, before) =>
        before
          ? repository.findBattleEvents(userId, battleSessionId, pageSize, before)
          : repository.findBattleEvents(userId, battleSessionId, pageSize),
      )
      const battleVersions = [...new Set(records.map((record) => record.battleVersion))]
      const authority = await privacyRepository.findBattleHistoryPrivacy(
        userId,
        battleSessionId,
        battleVersions,
      )
      const projected = projectBattleHistoryForViewer(records, authority.journals, authority.viewer)
      return buildBattleLogView(battleSessionId, projected)
    },
  }
}
"""
if append_marker not in text:
    raise SystemExit('battle log factory seam changed')
text = text.replace(append_marker, viewer_safe, 1)
service.write_text(text, encoding='utf-8')

route = Path('apps/web/src/app/api/battles/[battleSessionId]/events/route.ts')
text = route.read_text(encoding='utf-8')
text = text.replace(
    "import { createBattleLogService } from '@/server/battle/battle-log-service'",
    "import { createViewerSafeBattleLogService } from '@/server/battle/battle-log-service'",
)
old = """  return handleBattleLogRequest(battleSessionId, {
    getActor: getAuthenticatedActor,
    service: createBattleLogService(createSupabaseBattleSessionRepository()),
  })
"""
new = """  const repository = createSupabaseBattleSessionRepository()
  return handleBattleLogRequest(battleSessionId, {
    getActor: getAuthenticatedActor,
    service: createViewerSafeBattleLogService(repository, repository),
  })
"""
if old not in text:
    raise SystemExit('battle log route seam changed')
route.write_text(text.replace(old, new, 1), encoding='utf-8')

test = Path('apps/web/src/server/battle/battle-log-service.privacy.test.ts')
text = test.read_text(encoding='utf-8')
text = text.replace(
    "import { createBattleLogService } from './battle-log-service'",
    "import { createViewerSafeBattleLogService } from './battle-log-service'",
)
text = text.replace(
    'const result = await createBattleLogService(eventRepository, privacyRepository).getLog(',
    'const result = await createViewerSafeBattleLogService(eventRepository, privacyRepository).getLog(',
)
test.write_text(text, encoding='utf-8')
