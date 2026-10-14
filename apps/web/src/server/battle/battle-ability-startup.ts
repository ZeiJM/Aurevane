import 'server-only'

import { activateCombatAbilitySources } from '@aurevane/game-core/combat/combat-ability-command'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'
import {
  captureBattleBuildAbilitySources,
  type BattleBuildAuthoritySnapshot,
} from './battle-build-authority'
import { buildBattlePrivacyJournalInput } from './battle-history-privacy'
import type { BattleAuthoritativeEncounterState } from './battle-session-service'

/** Private server preparation; creation must persist startup and snapshot in one transaction. */
export async function prepareBattleAbilityStartup(
  encounter: BattleAuthoritativeEncounterState,
  buildAuthority: BattleBuildAuthoritySnapshot,
  resolver: CombatContentResolver,
) {
  const sources = await captureBattleBuildAbilitySources(encounter, buildAuthority, resolver)
  if (sources.length === 0) return { snapshot: encounter, startup: null }
  const initialized = activateCombatAbilitySources(encounter, sources, PV1F_COMBAT_CONTENT, true)
  const snapshot: BattleAuthoritativeEncounterState = {
    ...encounter,
    ...initialized.state,
    // The generic behavior runtime preserves the bridge; this boundary began
    // with the validated stat-driven encounter and retains its precise type.
    statBridge: encounter.statBridge,
    buildAuthority,
  }
  return {
    snapshot,
    startup: {
      p_start_snapshot: encounter,
      p_initial_events: initialized.events,
      p_privacy_journal: buildBattlePrivacyJournalInput({
        before: encounter,
        after: snapshot,
        commandKind: 'system',
        events: initialized.events,
      }),
    },
  }
}
