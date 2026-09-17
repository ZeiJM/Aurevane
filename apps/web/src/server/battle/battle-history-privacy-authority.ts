import 'server-only'

import type { BattleHistoryPrivacyJournal } from './battle-history-privacy'
import type { BattleViewerEntitlement } from './battle-viewer-entitlement'

export interface BattleHistoryPrivacyAuthority {
  readonly viewer: BattleViewerEntitlement
  readonly journals: readonly BattleHistoryPrivacyJournal[]
}

export interface BattleHistoryPrivacyRepository {
  findBattleHistoryPrivacy(
    userId: string,
    battleSessionId: string,
    battleVersions: readonly number[],
  ): Promise<BattleHistoryPrivacyAuthority>
}
