import 'server-only'

import type { BattleEventRecord } from '@aurevane/db/battle-session'
import { combatStatusMetadata } from '@aurevane/game-core/combat/combat-effect-state'
import {
  PV1F_COMBAT_CONTENT,
  PV1F_COVERT_STATUS,
  PV1F_REVEALED_STATUS,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'

import type { BattleViewerEntitlement } from './battle-viewer-entitlement'

export type BattlePrivacyVisibility =
  { readonly kind: 'public' } | { readonly kind: 'team-only'; readonly teamId: string }

export interface BattlePrivacyEventOverride {
  readonly eventIndex: number
  readonly visibility: BattlePrivacyVisibility
}

export interface BattlePrivacyJournalInput {
  readonly schemaVersion: 1
  readonly commandVisibility: BattlePrivacyVisibility
  readonly eventVisibilityOverrides: readonly BattlePrivacyEventOverride[]
}

export interface BattleHistoryPrivacyJournal extends BattlePrivacyJournalInput {
  readonly battleVersion: number
  readonly actorCombatantId: string
  readonly actorTeamId: string
  readonly eventCount: number
}

export type BattlePrivacyCommandKind = 'action' | 'move' | 'face' | 'system'

type StatusIdentity = {
  readonly statusId: string
  readonly statusVersion: number
  readonly sourceCombatantId: string
}

type MutableStatusIdentity = {
  statusId: string
  statusVersion: number
  sourceCombatantId: string
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function publicVisibility(): BattlePrivacyVisibility {
  return { kind: 'public' }
}

function teamVisibility(teamId: string): BattlePrivacyVisibility {
  return { kind: 'team-only', teamId }
}

function visibilityAllowed(
  visibility: BattlePrivacyVisibility,
  viewer: BattleViewerEntitlement,
): boolean {
  if (visibility.kind === 'public') return true
  return viewer.kind === 'participant' && viewer.friendlyTeamIds.has(visibility.teamId)
}

const STATUS_DEFINITIONS_BY_ID = new Map(
  PV1F_COMBAT_CONTENT.statuses.map((definition) => [definition.id, definition] as const),
)

function statusPolarity(identity: Pick<StatusIdentity, 'statusId' | 'statusVersion'>) {
  const definition = STATUS_DEFINITIONS_BY_ID.get(identity.statusId)
  if (!definition || definition.version !== identity.statusVersion) return null
  return combatStatusMetadata(definition).polarity
}

function actorAtCommandStart(state: StatDrivenCombatEncounterState) {
  const actorCombatantId = state.tactical.battle.currentTurn?.combatantId ?? null
  if (!actorCombatantId) return null
  const actor = state.tactical.battle.combatants.find(
    (combatant) => combatant.id === actorCombatantId,
  )
  return actor ? { actorCombatantId, actorTeamId: actor.teamId } : null
}

function hasCovert(
  statusesByCombatant: Map<string, MutableStatusIdentity[]>,
  combatantId: string,
): boolean {
  return (
    statusesByCombatant
      .get(combatantId)
      ?.some((status) => status.statusId === PV1F_COVERT_STATUS.id) === true
  )
}

function createRollingStatusState(
  state: StatDrivenCombatEncounterState,
): Map<string, MutableStatusIdentity[]> {
  return new Map(
    state.statusState.map((row) => [
      row.combatantId,
      row.statuses.map((status) => ({
        statusId: status.statusId,
        statusVersion: status.statusVersion,
        sourceCombatantId: status.sourceCombatantId,
      })),
    ]),
  )
}

function removeRollingStatus(
  statusesByCombatant: Map<string, MutableStatusIdentity[]>,
  combatantId: string,
  statusId: string,
  sourceCombatantId: string | null,
): StatusIdentity | null {
  const row = statusesByCombatant.get(combatantId)
  if (!row) return null
  const candidates = row.filter(
    (status) =>
      status.statusId === statusId &&
      (sourceCombatantId === null || status.sourceCombatantId === sourceCombatantId),
  )
  if (candidates.length !== 1) return null
  const found = candidates[0]!
  statusesByCombatant.set(
    combatantId,
    row.filter((status) => status !== found),
  )
  return found
}

function appliedStatusIdentity(
  after: StatDrivenCombatEncounterState,
  targetCombatantId: string,
  statusId: string,
  sourceCombatantId: string | null,
): StatusIdentity | null {
  const candidates =
    after.statusState
      .find((row) => row.combatantId === targetCombatantId)
      ?.statuses.filter(
        (status) =>
          status.statusId === statusId &&
          (sourceCombatantId === null || status.sourceCombatantId === sourceCombatantId),
      ) ?? []
  if (candidates.length === 1) {
    const status = candidates[0]!
    return {
      statusId: status.statusId,
      statusVersion: status.statusVersion,
      sourceCombatantId: status.sourceCombatantId,
    }
  }
  const definition = STATUS_DEFINITIONS_BY_ID.get(statusId)
  if (!definition) return null
  return {
    statusId,
    statusVersion: definition.version,
    sourceCombatantId: sourceCombatantId ?? '',
  }
}

function applyRollingStatus(
  statusesByCombatant: Map<string, MutableStatusIdentity[]>,
  combatantId: string,
  identity: StatusIdentity,
): void {
  const current = statusesByCombatant.get(combatantId) ?? []
  const matchingIndex = current.findIndex(
    (status) =>
      status.statusId === identity.statusId &&
      status.sourceCombatantId === identity.sourceCombatantId,
  )
  const next = [...current]
  if (matchingIndex >= 0) next[matchingIndex] = { ...identity }
  else next.push({ ...identity })
  statusesByCombatant.set(combatantId, next)
}

function sensoryPublicEventIndexes(events: readonly unknown[]): ReadonlySet<number> {
  const publicIndexes = new Set<number>()

  events.forEach((raw, revealedIndex) => {
    const event = objectValue(raw)
    if (
      event?.event !== 'status_applied' ||
      event.statusId !== PV1F_REVEALED_STATUS.id ||
      !stringValue(event.actionId)
    ) {
      return
    }
    const actionId = stringValue(event.actionId)!
    const sourceCombatantId = stringValue(event.sourceCombatantId)
    const targetCombatantId = stringValue(event.targetCombatantId)
    if (!sourceCombatantId || !targetCombatantId) return

    const removalIndexes: number[] = []
    let sawCovertRemoval = false
    for (let index = revealedIndex - 1; index >= 0; index -= 1) {
      const previous = objectValue(events[index])
      if (
        previous?.event !== 'status_removed' ||
        previous.actionId !== actionId ||
        previous.sourceCombatantId !== sourceCombatantId ||
        previous.targetCombatantId !== targetCombatantId
      ) {
        break
      }
      removalIndexes.push(index)
      if (previous.statusId === PV1F_COVERT_STATUS.id) sawCovertRemoval = true
    }
    if (!sawCovertRemoval) return
    publicIndexes.add(revealedIndex)
    removalIndexes.forEach((index) => publicIndexes.add(index))
  })

  return publicIndexes
}

function lifecycleTarget(event: Record<string, unknown>): string | null {
  if (event.event === 'status_expired') return stringValue(event.combatantId)
  if (event.event === 'status_applied' || event.event === 'status_removed') {
    return stringValue(event.targetCombatantId)
  }
  return null
}

function statusLifecycleIdentityBeforeOrAfter(input: {
  event: Record<string, unknown>
  targetCombatantId: string
  statusesByCombatant: Map<string, MutableStatusIdentity[]>
  after: StatDrivenCombatEncounterState
}): StatusIdentity | null {
  const statusId = stringValue(input.event.statusId)
  if (!statusId) return null
  const sourceCombatantId =
    stringValue(input.event.sourceCombatantId) ?? stringValue(input.event.combatantId)

  if (input.event.event === 'status_applied') {
    return appliedStatusIdentity(input.after, input.targetCombatantId, statusId, sourceCombatantId)
  }

  const row = input.statusesByCombatant.get(input.targetCombatantId) ?? []
  const candidates = row.filter(
    (status) =>
      status.statusId === statusId &&
      (sourceCombatantId === null || status.sourceCombatantId === sourceCombatantId),
  )
  return candidates.length === 1 ? { ...candidates[0]! } : null
}

function updateRollingStatusAfterEvent(input: {
  event: Record<string, unknown>
  targetCombatantId: string
  identity: StatusIdentity | null
  statusesByCombatant: Map<string, MutableStatusIdentity[]>
}): void {
  const statusId = stringValue(input.event.statusId)
  if (!statusId) return
  const sourceCombatantId = stringValue(input.event.sourceCombatantId)

  if (input.event.event === 'status_applied') {
    if (input.identity) {
      applyRollingStatus(input.statusesByCombatant, input.targetCombatantId, input.identity)
    }
    return
  }
  if (input.event.event === 'status_removed' || input.event.event === 'status_expired') {
    removeRollingStatus(
      input.statusesByCombatant,
      input.targetCombatantId,
      statusId,
      sourceCombatantId,
    )
  }
}

export function buildBattlePrivacyJournalInput(input: {
  before: StatDrivenCombatEncounterState
  after: StatDrivenCombatEncounterState
  commandKind: BattlePrivacyCommandKind
  events: readonly unknown[]
}): BattlePrivacyJournalInput {
  const actor = actorAtCommandStart(input.before)
  const statusesByCombatant = createRollingStatusState(input.before)
  const teamByCombatant = new Map(
    input.before.tactical.battle.combatants.map(
      (combatant) => [combatant.id, combatant.teamId] as const,
    ),
  )
  const actorWasCovert = actor ? hasCovert(statusesByCombatant, actor.actorCombatantId) : false
  const commandVisibility =
    input.commandKind === 'action' && actor?.actorTeamId && actorWasCovert
      ? teamVisibility(actor.actorTeamId)
      : publicVisibility()
  const sensoryPublicIndexes = sensoryPublicEventIndexes(input.events)
  const eventVisibilityOverrides: BattlePrivacyEventOverride[] = []

  input.events.forEach((raw, eventIndex) => {
    const event = objectValue(raw)
    if (!event) return

    if (sensoryPublicIndexes.has(eventIndex)) {
      eventVisibilityOverrides.push({ eventIndex, visibility: publicVisibility() })
    }

    const targetCombatantId = lifecycleTarget(event)
    if (!targetCombatantId) return
    const targetWasCovert = hasCovert(statusesByCombatant, targetCombatantId)
    const identity = statusLifecycleIdentityBeforeOrAfter({
      event,
      targetCombatantId,
      statusesByCombatant,
      after: input.after,
    })

    if (targetWasCovert && !sensoryPublicIndexes.has(eventIndex)) {
      const polarity = identity ? statusPolarity(identity) : null
      if (polarity === 'positive' || polarity === null) {
        const teamId = teamByCombatant.get(targetCombatantId)
        if (teamId) {
          eventVisibilityOverrides.push({
            eventIndex,
            visibility: teamVisibility(teamId),
          })
        }
      }
    }

    updateRollingStatusAfterEvent({
      event,
      targetCombatantId,
      identity,
      statusesByCombatant,
    })
  })

  eventVisibilityOverrides.sort((left, right) => left.eventIndex - right.eventIndex)
  return {
    schemaVersion: 1,
    commandVisibility,
    eventVisibilityOverrides,
  }
}

function eventOverrideMap(journal: BattleHistoryPrivacyJournal) {
  return new Map(
    journal.eventVisibilityOverrides.map(
      (override) => [override.eventIndex, override.visibility] as const,
    ),
  )
}

function projectVersion(
  records: readonly BattleEventRecord[],
  journal: BattleHistoryPrivacyJournal,
  viewer: BattleViewerEntitlement,
): BattleEventRecord[] {
  if (journal.eventCount !== records.length) {
    throw new Error('Battle history privacy journal event count does not match persisted history.')
  }
  const indexes = records.map((record) => record.eventIndex).sort((left, right) => left - right)
  if (indexes.some((eventIndex, expected) => eventIndex !== expected)) {
    throw new Error('Battle history privacy journal indexes do not match persisted history.')
  }

  const overrides = eventOverrideMap(journal)
  const commandAllowed = visibilityAllowed(journal.commandVisibility, viewer)
  const sourceAscending = records.length < 2 || records[0]!.eventIndex < records.at(-1)!.eventIndex
  const visible: Array<{ sortIndex: number; record: BattleEventRecord }> = []
  let filtered = false

  for (const record of records) {
    const visibility = overrides.get(record.eventIndex) ?? journal.commandVisibility
    if (!visibilityAllowed(visibility, viewer)) {
      filtered = true
      continue
    }
    const event = objectValue(record.event)
    const visibleRecord =
      !commandAllowed && event
        ? {
            ...record,
            event: Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'actionId')),
          }
        : record
    visible.push({ sortIndex: record.eventIndex, record: visibleRecord })
  }

  if (!commandAllowed) {
    filtered = true
    const generic: BattleEventRecord = {
      battleVersion: journal.battleVersion,
      eventIndex: 0,
      createdAt: records.reduce(
        (oldest, record) => (record.createdAt < oldest ? record.createdAt : oldest),
        records[0]?.createdAt ?? '',
      ),
      event: {
        event: 'hidden_combat_action',
        actorCombatantId: journal.actorCombatantId,
      },
    }
    visible.push({ sortIndex: -1, record: generic })
  }

  if (!filtered) return [...records]

  const ascending = visible.sort((left, right) => left.sortIndex - right.sortIndex)
  const reindexed = ascending.map(({ record }, eventIndex) => ({
    ...record,
    eventIndex,
  }))
  return sourceAscending ? reindexed : reindexed.reverse()
}

export function projectBattleHistoryForViewer(
  records: readonly BattleEventRecord[],
  journals: readonly BattleHistoryPrivacyJournal[],
  viewer: BattleViewerEntitlement,
): BattleEventRecord[] {
  const journalByVersion = new Map(
    journals.map((journal) => [journal.battleVersion, journal] as const),
  )
  const recordsByVersion = new Map<number, BattleEventRecord[]>()
  const versionOrder: number[] = []

  for (const record of records) {
    const existing = recordsByVersion.get(record.battleVersion)
    if (existing) existing.push(record)
    else {
      recordsByVersion.set(record.battleVersion, [record])
      versionOrder.push(record.battleVersion)
    }
  }

  return versionOrder.flatMap((battleVersion) => {
    const versionRecords = recordsByVersion.get(battleVersion) ?? []
    const journal = journalByVersion.get(battleVersion)
    return journal ? projectVersion(versionRecords, journal, viewer) : versionRecords
  })
}
