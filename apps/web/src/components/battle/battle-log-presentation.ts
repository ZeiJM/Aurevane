import type {
  BattleLogEntry,
  BattleLogFact,
  BattleLogKind,
  BattleLogTone,
  BattleLogView,
} from '@/server/battle/battle-log-service'

export type BattleLogSegmentRole = 'text' | 'actor' | 'target' | 'action' | 'outcome'
export type BattleLogSignificance = 'quiet' | 'standard' | 'highlight'

export interface BattleLogSegment {
  text: string
  role?: BattleLogSegmentRole
  tone?: BattleLogTone
}

export interface PresentedBattleLogAction {
  key: string
  battleVersion: number
  round: number | null
  turnNumber: number | null
  occurredAt: string
  kind: BattleLogKind
  tone: BattleLogTone
  significance: BattleLogSignificance
  primary: readonly BattleLogSegment[]
  secondary: readonly BattleLogSegment[] | null
  details: readonly BattleLogFact[]
  ariaLabel: string
}

export interface PresentedBattleLogRound {
  key: string
  round: number | null
  occurredAt: string
  actions: readonly PresentedBattleLogAction[]
}

interface PresentationOptions {
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
}

interface ActionGroup {
  battleVersion: number
  entries: BattleLogEntry[]
  round: number | null
  turnNumber: number | null
  occurredAt: string
}

const BOOKKEEPING_EVENTS = new Set([
  'round_started',
  'turn_started',
  'turn_ended',
  'movement_spent',
  'combatant_facing_changed',
  'recruit_ai_decision',
])

const TONE_PRIORITY: Record<BattleLogTone, number> = {
  neutral: 0,
  benefit: 1,
  healing: 2,
  damage: 3,
  warning: 4,
}

function segment(
  text: string,
  role: BattleLogSegmentRole = 'text',
  tone?: BattleLogTone,
): BattleLogSegment {
  return { text, role, ...(tone ? { tone } : {}) }
}

function combatantName(
  combatantId: string | null | undefined,
  options: PresentationOptions,
): string | null {
  if (!combatantId) return null
  const exact = options.combatantNames?.[combatantId]
  if (exact) return exact
  if (combatantId.startsWith('character:')) return options.playerName ?? 'Wayfarer'
  if (combatantId.startsWith('recruit:')) return 'Recruit'
  return 'Combatant'
}

function renderEntry(entry: BattleLogEntry, options: PresentationOptions): string {
  const values: Readonly<Record<string, string>> = {
    ...entry.templateValues,
    actor: combatantName(entry.actorCombatantId, options) ?? 'Combatant',
    target: combatantName(entry.targetCombatantId, options) ?? 'Combatant',
  }

  return entry.messageTemplate
    .replace(/\{([a-zA-Z][a-zA-Z0-9_.-]*)\}/gu, (_match, token: string) => values[token] ?? '')
    .replace(/\s+/gu, ' ')
    .trim()
}

function strongestTone(entries: readonly BattleLogEntry[]): BattleLogTone {
  return entries.reduce<BattleLogTone>((strongest, entry) => {
    return TONE_PRIORITY[entry.tone] > TONE_PRIORITY[strongest] ? entry.tone : strongest
  }, 'neutral')
}

function reasonableDurationLabel(entry: BattleLogEntry): string | null {
  for (const item of entry.facts) {
    const match = /^(\d+)\s+turn(?:s)?$/iu.exec(item.label.trim())
    if (!match) continue
    const turns = Number(match[1])
    if (!Number.isFinite(turns) || turns <= 0 || turns > 99) return null
    return `${turns} turn${turns === 1 ? '' : 's'}`
  }
  return null
}

function isReasonableFact(item: BattleLogFact): boolean {
  const duration = /^(\d+)\s+turn(?:s)?$/iu.exec(item.label.trim())
  if (!duration) return true
  const turns = Number(duration[1])
  return Number.isFinite(turns) && turns > 0 && turns <= 99
}

function uniqueDetails(
  entries: readonly BattleLogEntry[],
  consumedLabels: ReadonlySet<string>,
): BattleLogFact[] {
  const seen = new Set<string>()
  const details: BattleLogFact[] = []

  for (const entry of entries) {
    for (const item of entry.facts) {
      const label = item.label.trim()
      if (!label || consumedLabels.has(label.toLowerCase()) || !isReasonableFact(item)) continue
      const key = `${item.tone}:${label.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      details.push({ ...item, label })
      if (details.length >= 4) return details
    }
  }

  return details
}

function groupActions(entries: BattleLogView['entries']): ActionGroup[] {
  const ordered = [...entries].sort((left, right) => {
    if (left.battleVersion !== right.battleVersion) return right.battleVersion - left.battleVersion
    return right.eventIndex - left.eventIndex
  })
  const rawGroups: Array<{ battleVersion: number; entries: BattleLogEntry[] }> = []

  for (const entry of ordered) {
    const current = rawGroups.at(-1)
    if (current?.battleVersion === entry.battleVersion) current.entries.push(entry)
    else rawGroups.push({ battleVersion: entry.battleVersion, entries: [entry] })
  }

  return rawGroups.flatMap((group) => {
    const visible = group.entries.filter((entry) => !BOOKKEEPING_EVENTS.has(entry.eventType))
    if (visible.length === 0) return []
    const contextEntry = visible[0]
    if (!contextEntry) return []

    return [
      {
        battleVersion: group.battleVersion,
        entries: visible,
        round: contextEntry.round ?? visible.find((entry) => entry.round !== null)?.round ?? null,
        turnNumber:
          contextEntry.turnNumber ??
          visible.find((entry) => entry.turnNumber !== null)?.turnNumber ??
          null,
        occurredAt: group.entries[0]?.occurredAt ?? contextEntry.occurredAt,
      },
    ]
  })
}

function findEntry(group: ActionGroup, eventType: string): BattleLogEntry | null {
  return group.entries.find((entry) => entry.eventType === eventType) ?? null
}

function internalActionLabel(label: string | null | undefined): boolean {
  if (!label) return true
  return /^(battle|pvp|system)\b/iu.test(label.trim())
}

function usefulActionLabel(entries: readonly BattleLogEntry[]): string | null {
  const label = entries.find((entry) => entry.actionLabel)?.actionLabel ?? null
  return internalActionLabel(label) ? null : label
}

function statusName(entry: BattleLogEntry): string {
  const explicit = entry.templateValues.status?.trim()
  if (explicit) return explicit
  if (entry.eventType === 'pvp_lowered_guard_applied') return 'Lowered Guard'
  if (entry.headline && !internalActionLabel(entry.headline)) return entry.headline
  return 'Status'
}

function statusIsNegative(name: string, entry: BattleLogEntry): boolean {
  if (entry.tone === 'warning') return true
  return /(lowered guard|poison|bleed|burn|stun|weaken|slow|curse|vulnerab)/iu.test(name)
}

function statusApplicationSecondary(
  group: ActionGroup,
  options: PresentationOptions,
  consumed: Set<string>,
): readonly BattleLogSegment[] | null {
  const candidates = group.entries.filter(
    (entry) => entry.eventType === 'status_applied' || entry.eventType === 'pvp_lowered_guard_applied',
  )
  const seen = new Set<string>()
  const entry = candidates.find((candidate) => {
    const name = statusName(candidate).toLowerCase()
    if (seen.has(name)) return false
    seen.add(name)
    return true
  })
  if (!entry) return null

  const name = statusName(entry)
  const target = combatantName(entry.targetCombatantId, options)
  const duration = reasonableDurationLabel(entry)
  const negative = statusIsNegative(name, entry)
  consumed.add(name.toLowerCase())
  if (duration) consumed.add(duration.toLowerCase())

  return [
    segment('↳ '),
    ...(target ? [segment(target, 'target')] : []),
    segment(negative ? ' suffers ' : ' gains '),
    segment(name, 'outcome', negative ? 'warning' : 'benefit'),
    ...(duration ? [segment(` · ${duration}`)] : []),
  ]
}

function attackSegments(
  actor: string | null,
  target: string | null,
  actionLabel: string | null,
  outcome: string,
  tone: BattleLogTone,
): readonly BattleLogSegment[] {
  const safeActor = actor ?? 'Combatant'
  const safeTarget = target ?? 'the target'
  const basic = !actionLabel || actionLabel === 'Basic Attack'

  if (basic) {
    return [
      segment(safeActor, 'actor'),
      segment(' strikes '),
      segment(safeTarget, 'target'),
      segment(' — '),
      segment(outcome, 'outcome', tone),
    ]
  }

  return [
    segment(safeActor, 'actor'),
    segment(' uses '),
    segment(actionLabel, 'action'),
    segment(' on '),
    segment(safeTarget, 'target'),
    segment(' — '),
    segment(outcome, 'outcome', tone),
  ]
}

function movementDestination(entry: BattleLogEntry): string | null {
  const route = entry.facts.find((item) => item.label.includes('→'))?.label
  if (!route) return null
  return route.split('→').at(-1)?.trim() || null
}

function presentAction(group: ActionGroup, options: PresentationOptions): PresentedBattleLogAction {
  const consumed = new Set<string>()
  const tone = strongestTone(group.entries)
  const surrender = findEntry(group, 'pvp_combatant_surrendered')
  const completed = findEntry(group, 'battle_completed')
  const abandoned = findEntry(group, 'battle_abandoned')
  const started = findEntry(group, 'battle_started')
  const timeout = findEntry(group, 'pvp_turn_timed_out')
  const resolved = findEntry(group, 'stat_driven_attack_resolved')
  const damage = findEntry(group, 'damage_applied')
  const healing = findEntry(group, 'healing_applied')
  const moved = findEntry(group, 'combatant_moved')
  const statusApplied =
    findEntry(group, 'status_applied') ?? findEntry(group, 'pvp_lowered_guard_applied')
  const statusExpired = findEntry(group, 'status_expired')
  const waited = findEntry(group, 'combatant_waited')
  const resource = findEntry(group, 'resource_changed') ?? findEntry(group, 'mp_spent')
  const actionLabel = usefulActionLabel(group.entries)

  let primary: readonly BattleLogSegment[]
  let secondary: readonly BattleLogSegment[] | null = null
  let kind: BattleLogKind = group.entries[0]?.kind ?? 'system'
  let significance: BattleLogSignificance = 'standard'

  if (surrender) {
    const actor = combatantName(surrender.actorCombatantId, options) ?? 'Combatant'
    primary = [segment(actor, 'actor'), segment(' surrenders', 'outcome', 'warning')]
    kind = 'system'
    significance = 'highlight'
    consumed.add('surrendered')
  } else if (completed) {
    primary = [segment('Battle complete', 'outcome', 'benefit')]
    kind = 'system'
    significance = 'highlight'
    consumed.add('complete')
  } else if (abandoned) {
    primary = [segment('Battle ended early', 'outcome', 'warning')]
    kind = 'system'
    significance = 'highlight'
    consumed.add('ended early')
  } else if (timeout) {
    const actor = combatantName(timeout.actorCombatantId, options) ?? 'Combatant'
    primary = [
      segment(actor, 'actor'),
      segment("'s turn expires — "),
      segment('action forfeited', 'outcome', 'warning'),
    ]
    secondary = statusApplicationSecondary(group, options, consumed)
    kind = 'turn'
    consumed.add('timed out')
  } else if (resolved?.templateValues.outcome === 'MISSED') {
    const actor = combatantName(resolved.actorCombatantId, options)
    const target = combatantName(resolved.targetCombatantId, options)
    primary = attackSegments(actor, target, actionLabel, 'Miss', 'warning')
    kind = 'offense'
    consumed.add('miss')
    consumed.add('missed')
    secondary = statusApplicationSecondary(group, options, consumed)
  } else if (damage) {
    const actor = combatantName(damage.actorCombatantId, options)
    const target = combatantName(damage.targetCombatantId, options)
    const amount = damage.templateValues.amount?.trim()
    const outcome = amount ? `${amount} damage` : 'Damage dealt'
    primary = attackSegments(actor, target, actionLabel, outcome, 'damage')
    kind = 'offense'
    if (amount) {
      consumed.add(`${amount} dmg`.toLowerCase())
      consumed.add(`${amount} damage`.toLowerCase())
    }
    consumed.add('hit')
    const defeated = damage.facts.some((item) => item.label.trim() === '0 HP')
    if (defeated) {
      significance = 'highlight'
      consumed.add('0 hp')
      secondary = [
        segment('↳ '),
        ...(target ? [segment(target, 'target')] : []),
        segment(' is defeated', 'outcome', 'warning'),
      ]
    } else {
      secondary = statusApplicationSecondary(group, options, consumed)
    }
  } else if (healing) {
    const actor = combatantName(healing.actorCombatantId, options)
    const target = combatantName(healing.targetCombatantId, options)
    const amount = healing.templateValues.amount?.trim()
    const outcome = amount ? `+${amount} HP` : 'HP restored'
    if (actor && target && actor !== target) {
      primary = [
        segment(actor, 'actor'),
        segment(' restores '),
        segment(target, 'target'),
        segment(' — '),
        segment(outcome, 'outcome', 'healing'),
      ]
    } else {
      primary = [
        segment(target ?? actor ?? 'Combatant', 'actor'),
        segment(' recovers — '),
        segment(outcome, 'outcome', 'healing'),
      ]
    }
    kind = 'recovery'
    if (amount) consumed.add(`+${amount} hp`.toLowerCase())
    secondary = statusApplicationSecondary(group, options, consumed)
  } else if (moved) {
    const actor = combatantName(moved.actorCombatantId, options) ?? 'Combatant'
    const destination = movementDestination(moved)
    primary = [
      segment(actor, 'actor'),
      segment(' moves'),
      ...(destination
        ? [segment(' to '), segment(destination, 'outcome', 'neutral')]
        : []),
    ]
    kind = 'movement'
    significance = 'quiet'
    if (destination) consumed.add(destination.toLowerCase())
  } else if (statusApplied) {
    const name = statusName(statusApplied)
    const target = combatantName(statusApplied.targetCombatantId, options) ?? 'Combatant'
    const duration = reasonableDurationLabel(statusApplied)
    const negative = statusIsNegative(name, statusApplied)
    primary = [
      segment(target, 'target'),
      segment(negative ? ' suffers ' : ' gains '),
      segment(name, 'outcome', negative ? 'warning' : 'benefit'),
      ...(duration ? [segment(` · ${duration}`)] : []),
    ]
    kind = statusApplied.kind
    consumed.add(name.toLowerCase())
    if (duration) consumed.add(duration.toLowerCase())
  } else if (statusExpired) {
    const name = statusName(statusExpired)
    const target = combatantName(statusExpired.targetCombatantId, options) ?? 'Combatant'
    primary = [
      segment(`${target}'s `, 'target'),
      segment(name, 'action'),
      segment(' fades'),
    ]
    kind = 'status'
    significance = 'quiet'
    consumed.add(name.toLowerCase())
    consumed.add('expired')
  } else if (waited) {
    const actor = combatantName(waited.actorCombatantId, options) ?? 'Combatant'
    primary = [segment(actor, 'actor'), segment(' waits')]
    kind = 'turn'
    significance = 'quiet'
    consumed.add('no action')
  } else if (resource) {
    primary = [segment(renderEntry(resource, options))]
    kind = resource.kind
    significance = 'quiet'
  } else if (started) {
    primary = [segment('Battle begins')]
    kind = 'system'
    significance = 'quiet'
  } else {
    const fallback = group.entries[0]
    primary = [segment(fallback ? renderEntry(fallback, options) : 'Battle event')]
    kind = fallback?.kind ?? 'system'
  }

  const details = uniqueDetails(group.entries, consumed)
  const ariaLabel = [...primary, ...(secondary ?? [])]
    .map((item) => item.text)
    .join('')
    .replace(/↳\s*/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()

  return {
    key: `battle:${group.battleVersion}`,
    battleVersion: group.battleVersion,
    round: group.round,
    turnNumber: group.turnNumber,
    occurredAt: group.occurredAt,
    kind,
    tone,
    significance,
    primary,
    secondary,
    details,
    ariaLabel,
  }
}

export function buildBattleLogPresentation(
  entries: BattleLogView['entries'],
  options: PresentationOptions = {},
): PresentedBattleLogRound[] {
  const actions = groupActions(entries).map((group) => presentAction(group, options))
  const rounds: PresentedBattleLogRound[] = []

  for (const action of actions) {
    const key = action.round === null ? 'recent' : `round:${action.round}`
    const current = rounds.at(-1)
    if (current?.key === key) {
      ;(current.actions as PresentedBattleLogAction[]).push(action)
    } else {
      rounds.push({
        key,
        round: action.round,
        occurredAt: action.occurredAt,
        actions: [action],
      })
    }
  }

  return rounds
}

export function countPresentedBattleLogActions(entries: BattleLogView['entries']): number {
  return groupActions(entries).length
}
