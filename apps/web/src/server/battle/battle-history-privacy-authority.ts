import 'server-only'

import {
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'

import type { BattleHistoryPrivacyJournal, BattlePrivacyVisibility } from './battle-history-privacy'
import {
  createSpectatorBattleViewerEntitlement,
  deriveParticipantBattleViewerEntitlement,
  type BattleViewerEntitlement,
} from './battle-viewer-entitlement'

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

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function integerValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null
}

function visibility(value: unknown): BattlePrivacyVisibility | null {
  const record = objectValue(value)
  if (!record) return null
  if (record.kind === 'public' && !('teamId' in record)) return { kind: 'public' }
  const teamId = stringValue(record.teamId)
  if (record.kind === 'team-only' && teamId) return { kind: 'team-only', teamId }
  return null
}

function journal(value: unknown): BattleHistoryPrivacyJournal | null {
  const record = objectValue(value)
  if (!record || record.schemaVersion !== 1) return null

  const battleVersion = integerValue(record.battleVersion)
  const actorCombatantId = stringValue(record.actorCombatantId)
  const actorTeamId = stringValue(record.actorTeamId)
  const eventCount = integerValue(record.eventCount)
  const commandVisibility = visibility(record.commandVisibility)
  const rawOverrides = record.eventVisibilityOverrides

  if (
    battleVersion === null ||
    battleVersion <= 1 ||
    !actorCombatantId ||
    !actorTeamId ||
    eventCount === null ||
    eventCount < 0 ||
    !commandVisibility ||
    !Array.isArray(rawOverrides)
  ) {
    return null
  }

  const eventVisibilityOverrides: BattleHistoryPrivacyJournal['eventVisibilityOverrides'][number][] =
    []
  const seenIndexes = new Set<number>()

  for (const value of rawOverrides) {
    const override = objectValue(value)
    const eventIndex = override ? integerValue(override.eventIndex) : null
    const eventVisibility = override ? visibility(override.visibility) : null
    if (
      eventIndex === null ||
      eventIndex < 0 ||
      eventIndex >= eventCount ||
      !eventVisibility ||
      seenIndexes.has(eventIndex)
    ) {
      return null
    }
    seenIndexes.add(eventIndex)
    eventVisibilityOverrides.push({ eventIndex, visibility: eventVisibility })
  }

  return {
    schemaVersion: 1,
    battleVersion,
    actorCombatantId,
    actorTeamId,
    eventCount,
    commandVisibility,
    eventVisibilityOverrides,
  }
}

export function parseBattleHistoryPrivacyAuthorityRow(
  value: unknown,
): BattleHistoryPrivacyAuthority | null {
  const record = objectValue(value)
  if (
    !record ||
    !Array.isArray(record.controlled_combatant_ids) ||
    !Array.isArray(record.journals)
  ) {
    return null
  }

  const snapshot = record.snapshot as StatDrivenCombatEncounterState
  if (validateStatDrivenCombatEncounterState(snapshot).length > 0) return null

  const controlledCombatantIds: string[] = []
  for (const controlled of record.controlled_combatant_ids) {
    const combatantId = stringValue(controlled)
    if (!combatantId) return null
    controlledCombatantIds.push(combatantId)
  }

  if (new Set(controlledCombatantIds).size !== controlledCombatantIds.length) return null

  const journals: BattleHistoryPrivacyJournal[] = []
  const seenVersions = new Set<number>()
  for (const rawJournal of record.journals) {
    const parsed = journal(rawJournal)
    if (!parsed || seenVersions.has(parsed.battleVersion)) return null
    seenVersions.add(parsed.battleVersion)
    journals.push(parsed)
  }

  if (record.viewer_kind === 'participant') {
    return {
      viewer: deriveParticipantBattleViewerEntitlement(
        snapshot.tactical.battle.combatants,
        controlledCombatantIds,
      ),
      journals,
    }
  }

  if (record.viewer_kind === 'spectator' && controlledCombatantIds.length === 0) {
    return {
      viewer: createSpectatorBattleViewerEntitlement(),
      journals,
    }
  }

  return null
}
