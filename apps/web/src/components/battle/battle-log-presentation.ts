import {
  isSkillNarrationVariantValid,
  type SkillNarrationTemplate,
} from '@aurevane/game-core/combat/battle-narration'

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
  skillNarrations?: Readonly<Record<string, SkillNarrationTemplate>>
}

interface ActionGroup {
  key: string
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

const STANDALONE_EVENTS = new Set(['status_expired', 'battle_completed', 'battle_abandoned'])

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
  if (combatantId.startsWith('character:')) {
    if (options.combatantNames) return 'Opponent'
    return options.playerName ?? 'Wayfarer'
  }
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

    const mainEntries = visible.filter((entry) => !STANDALONE_EVENTS.has(entry.eventType))
    const standaloneEntries = visible.filter((entry) => STANDALONE_EVENTS.has(entry.eventType))
    const groups: ActionGroup[] = []

    const addGroup = (groupEntries: BattleLogEntry[], key: string) => {
      const contextEntry = groupEntries[0]
      if (!contextEntry) return
      groups.push({
        key,
        battleVersion: group.battleVersion,
        entries: groupEntries,
        round:
          contextEntry.round ?? groupEntries.find((entry) => entry.round !== null)?.round ?? null,
        turnNumber:
          contextEntry.turnNumber ??
          groupEntries.find((entry) => entry.turnNumber !== null)?.turnNumber ??
          null,
        occurredAt: contextEntry.occurredAt,
      })
    }

    if (mainEntries.length > 0) addGroup(mainEntries, `battle:${group.battleVersion}`)
    for (const standalone of standaloneEntries) {
      addGroup(
        [standalone],
        `battle:${group.battleVersion}:${standalone.eventType}:${standalone.eventIndex}`,
      )
    }

    return groups.sort((left, right) => {
      return (right.entries[0]?.eventIndex ?? 0) - (left.entries[0]?.eventIndex ?? 0)
    })
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
  expectedTargetCombatantId?: string | null,
): readonly BattleLogSegment[] | null {
  const candidates = group.entries.filter(
    (entry) =>
      (entry.eventType === 'status_applied' ||
        entry.eventType === 'pvp_lowered_guard_applied' ||
        entry.eventType === 'ai_lowered_guard_applied') &&
      (!expectedTargetCombatantId || entry.targetCombatantId === expectedTargetCombatantId),
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
  const refreshed = entry.templateValues.statusChange === 'REFRESHED'
  const stacked = entry.templateValues.statusChange === 'STACKED'
  const stacks = entry.templateValues.stacks?.trim()
  const negative = statusIsNegative(name, entry)
  consumed.add(name.toLowerCase())
  if (duration) consumed.add(duration.toLowerCase())
  if (stacks) consumed.add(`×${stacks} stacks`.toLowerCase())
  const durationDisplay =
    entry.eventType === 'pvp_lowered_guard_applied' && duration === '1 turn'
      ? 'until next turn'
      : duration

  if (stacked) {
    return [
      segment('↳ '),
      ...(target ? [segment(`${target}'s `, 'target')] : []),
      segment(name, 'outcome', negative ? 'warning' : 'benefit'),
      segment(` stacks${stacks ? ` to ×${stacks}` : ''}`),
      ...(durationDisplay ? [segment(` · ${durationDisplay}`)] : []),
    ]
  }

  if (refreshed) {
    return [
      segment('↳ '),
      ...(target ? [segment(`${target}'s `, 'target')] : []),
      segment(name, 'outcome', negative ? 'warning' : 'benefit'),
      segment(' refreshes'),
      ...(durationDisplay ? [segment(` · ${durationDisplay}`)] : []),
    ]
  }

  return [
    segment('↳ '),
    ...(target ? [segment(target, 'target')] : []),
    segment(negative ? ' suffers ' : ' gains '),
    segment(name, 'outcome', negative ? 'warning' : 'benefit'),
    ...(durationDisplay ? [segment(` · ${durationDisplay}`)] : []),
  ]
}

type AttackNarrationOutcome = 'hit' | 'miss' | 'critical'

function narratedAttackSegments(
  template: string,
  values: { actor: string; target: string; ability: string; damage: string },
  tone: BattleLogTone,
): readonly BattleLogSegment[] | null {
  if (!isSkillNarrationVariantValid(template)) return null

  const tokenPattern = /\{(actor|target|ability|damage)\}/gu
  const segments: BattleLogSegment[] = []
  let cursor = 0
  for (const match of template.matchAll(tokenPattern)) {
    const index = match.index ?? 0
    if (index > cursor) segments.push(segment(template.slice(cursor, index)))
    const token = match[1] as keyof typeof values
    const value = values[token]
    if (!value) return null
    if (token === 'actor') segments.push(segment(value, 'actor'))
    else if (token === 'target') segments.push(segment(value, 'target'))
    else if (token === 'ability') segments.push(segment(value, 'action'))
    else segments.push(segment(value, 'outcome', tone))
    cursor = index + match[0].length
  }
  if (cursor < template.length) segments.push(segment(template.slice(cursor)))
  return segments.length > 0 ? segments : null
}

function namedAttackSegments(
  actor: string,
  target: string,
  actionLabel: string,
  outcome: string,
  tone: BattleLogTone,
  narrationOutcome: AttackNarrationOutcome,
): readonly BattleLogSegment[] {
  const miss = narrationOutcome === 'miss'
  const label = actionLabel.toLowerCase()
  const suffix = [segment(' — '), segment(outcome, 'outcome', tone)]

  if (/(fire|flame|ember|pyre|inferno|blaze)/u.test(label)) {
    return [
      segment(actor, 'actor'),
      segment(' sends '),
      segment(actionLabel, 'action'),
      segment(miss ? ' blazing past ' : ' blazing into '),
      segment(target, 'target'),
      ...suffix,
    ]
  }
  if (/(frost|ice|rime|glacier|winter)/u.test(label)) {
    return [
      segment(actor, 'actor'),
      ...(miss
        ? [segment("'s "), segment(actionLabel, 'action'), segment(' flashes cold past ')]
        : [segment(' drives the chill of '), segment(actionLabel, 'action'), segment(' into ')]),
      segment(target, 'target'),
      ...suffix,
    ]
  }
  if (/(lightning|storm|thunder|volt|spark)/u.test(label)) {
    return [
      segment(actor, 'actor'),
      ...(miss
        ? [segment("'s "), segment(actionLabel, 'action'), segment(' cracks past ')]
        : [segment(' arcs '), segment(actionLabel, 'action'), segment(' through ')]),
      segment(target, 'target'),
      ...suffix,
    ]
  }
  if (/(shadow|night|void|gloom|umbra)/u.test(label)) {
    return [
      segment(actor, 'actor'),
      ...(miss
        ? [segment("'s "), segment(actionLabel, 'action'), segment(' slips past ')]
        : [segment(' folds '), segment(actionLabel, 'action'), segment(' around ')]),
      segment(target, 'target'),
      ...suffix,
    ]
  }
  if (/(radiant|light|dawn|sun|solar)/u.test(label)) {
    return [
      segment(actor, 'actor'),
      ...(miss
        ? [segment("'s "), segment(actionLabel, 'action'), segment(' flares past ')]
        : [segment(' casts '), segment(actionLabel, 'action'), segment(' across ')]),
      segment(target, 'target'),
      ...suffix,
    ]
  }
  if (/(slash|rend|cleave|cut|blade|edge)/u.test(label)) {
    return [
      segment(actor, 'actor'),
      ...(miss
        ? [segment("'s "), segment(actionLabel, 'action'), segment(' cuts past ')]
        : [segment(' carves into '), segment(target, 'target'), segment(' with ')]),
      ...(miss ? [segment(target, 'target')] : [segment(actionLabel, 'action')]),
      ...suffix,
    ]
  }
  if (/(strike|bash|smash|crush|hammer|impact)/u.test(label)) {
    return [
      segment(actor, 'actor'),
      ...(miss
        ? [segment("'s "), segment(actionLabel, 'action'), segment(' crashes wide of ')]
        : [segment(' drives '), segment(actionLabel, 'action'), segment(' into ')]),
      segment(target, 'target'),
      ...suffix,
    ]
  }
  if (/(shot|arrow|bolt|snipe|volley)/u.test(label)) {
    return [
      segment(actor, 'actor'),
      ...(miss
        ? [segment("'s "), segment(actionLabel, 'action'), segment(' whistles past ')]
        : [segment(' sends '), segment(actionLabel, 'action'), segment(' into ')]),
      segment(target, 'target'),
      ...suffix,
    ]
  }
  if (/(poison|venom|toxin|blight)/u.test(label)) {
    return [
      segment(actor, 'actor'),
      ...(miss
        ? [segment("'s "), segment(actionLabel, 'action'), segment(' fails to catch ')]
        : [segment(' delivers '), segment(actionLabel, 'action'), segment(' to ')]),
      segment(target, 'target'),
      ...suffix,
    ]
  }

  return [
    segment(actor, 'actor'),
    segment(miss ? ' sends ' : ' unleashes '),
    segment(actionLabel, 'action'),
    segment(miss ? ' toward ' : ' on '),
    segment(target, 'target'),
    ...suffix,
  ]
}

function attackSegments(
  actor: string | null,
  target: string | null,
  actionId: string | null,
  actionLabel: string | null,
  outcome: string,
  tone: BattleLogTone,
  narrationOutcome: AttackNarrationOutcome,
  options: PresentationOptions,
): readonly BattleLogSegment[] {
  const safeActor = actor ?? 'Combatant'
  const safeTarget = target ?? 'the target'
  const basic = !actionLabel || actionLabel === 'Basic Attack'
  const authored = actionId ? options.skillNarrations?.[actionId]?.[narrationOutcome] : undefined

  if (authored) {
    const narrated = narratedAttackSegments(
      authored,
      {
        actor: safeActor,
        target: safeTarget,
        ability: actionLabel ?? 'Attack',
        damage: outcome,
      },
      tone,
    )
    if (narrated) {
      return authored.includes('{damage}')
        ? narrated
        : [...narrated, segment(' — '), segment(outcome, 'outcome', tone)]
    }
  }

  if (basic) {
    return [
      segment(safeActor, 'actor'),
      segment(' strikes '),
      segment(safeTarget, 'target'),
      segment(' — '),
      segment(outcome, 'outcome', tone),
    ]
  }

  return namedAttackSegments(safeActor, safeTarget, actionLabel, outcome, tone, narrationOutcome)
}

function actionUseSegments(actor: string, actionLabel: string): readonly BattleLogSegment[] {
  if (actionLabel === 'Guard') {
    return [segment(actor, 'actor'), segment(' braces with '), segment(actionLabel, 'action')]
  }
  if (actionLabel === 'Recover') {
    return [
      segment(actor, 'actor'),
      segment(' regains footing with '),
      segment(actionLabel, 'action'),
    ]
  }
  return [segment(actor, 'actor'), segment(' invokes '), segment(actionLabel, 'action')]
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
  const actionUsed = findEntry(group, 'combat_action_used')
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
      segment(' hesitates — '),
      segment('the moment passes', 'outcome', 'warning'),
    ]
    secondary = statusApplicationSecondary(group, options, consumed, timeout.actorCombatantId)
    kind = 'turn'
    consumed.add('timed out')
  } else if (resolved?.templateValues.outcome === 'MISSED') {
    const actor = combatantName(resolved.actorCombatantId, options)
    const target = combatantName(resolved.targetCombatantId, options)
    primary = attackSegments(
      actor,
      target,
      resolved.actionId,
      actionLabel,
      'Miss',
      'warning',
      'miss',
      options,
    )
    kind = 'offense'
    consumed.add('miss')
    consumed.add('missed')
    secondary = statusApplicationSecondary(group, options, consumed, resolved.targetCombatantId)
  } else if (damage) {
    const actor = combatantName(damage.actorCombatantId, options)
    const target = combatantName(damage.targetCombatantId, options)
    const amount = damage.templateValues.amount?.trim()
    const outcome = amount ? `${amount} damage` : 'Damage dealt'
    const selfDamage =
      damage.actorCombatantId !== null &&
      damage.targetCombatantId !== null &&
      damage.actorCombatantId === damage.targetCombatantId
    if (selfDamage) {
      primary = [
        segment(target ?? actor ?? 'Combatant', 'actor'),
        segment(' takes '),
        segment(outcome, 'outcome', 'damage'),
        ...(actionLabel && actionLabel !== 'Basic Attack'
          ? [segment(' from '), segment(actionLabel, 'action')]
          : []),
      ]
    } else {
      primary = attackSegments(
        actor,
        target,
        damage.actionId,
        actionLabel,
        outcome,
        'damage',
        'hit',
        options,
      )
    }
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
      secondary = statusApplicationSecondary(group, options, consumed, damage.targetCombatantId)
    }
  } else if (healing) {
    const actor = combatantName(healing.actorCombatantId, options)
    const target = combatantName(healing.targetCombatantId, options)
    const amount = healing.templateValues.amount?.trim()
    const outcome = amount ? `+${amount} HP` : 'HP restored'
    if (actionLabel && actionLabel !== 'Recover') {
      primary = [
        segment(actor ?? target ?? 'Combatant', 'actor'),
        segment(' channels '),
        segment(actionLabel, 'action'),
        ...(target && target !== actor ? [segment(' into '), segment(target, 'target')] : []),
        segment(' — '),
        segment(outcome, 'outcome', 'healing'),
      ]
    } else if (actor && target && actor !== target) {
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
    secondary = statusApplicationSecondary(group, options, consumed, healing.targetCombatantId)
  } else if (moved) {
    const actor = combatantName(moved.actorCombatantId, options) ?? 'Combatant'
    primary = [segment(actor, 'actor'), segment(' moves')]
    kind = 'movement'
    significance = 'quiet'
  } else if (statusApplied) {
    if (actionUsed && actionLabel) {
      const actor = combatantName(actionUsed.actorCombatantId, options) ?? 'Combatant'
      primary = actionUseSegments(actor, actionLabel)
      secondary = statusApplicationSecondary(
        group,
        options,
        consumed,
        statusApplied.targetCombatantId,
      )
      kind = actionUsed.kind
    } else {
      const name = statusName(statusApplied)
      const target = combatantName(statusApplied.targetCombatantId, options) ?? 'Combatant'
      const duration = reasonableDurationLabel(statusApplied)
      const negative = statusIsNegative(name, statusApplied)
      const refreshed = statusApplied.templateValues.statusChange === 'REFRESHED'
      const stacked = statusApplied.templateValues.statusChange === 'STACKED'
      const stacks = statusApplied.templateValues.stacks?.trim()
      primary = stacked
        ? [
            segment(`${target}'s `, 'target'),
            segment(name, 'outcome', negative ? 'warning' : 'benefit'),
            segment(` stacks${stacks ? ` to ×${stacks}` : ''}`),
            ...(duration ? [segment(` · ${duration}`)] : []),
          ]
        : refreshed
          ? [
              segment(`${target}'s `, 'target'),
              segment(name, 'outcome', negative ? 'warning' : 'benefit'),
              segment(' refreshes'),
              ...(duration ? [segment(` · ${duration}`)] : []),
            ]
          : [
              segment(target, 'target'),
              segment(negative ? ' suffers ' : ' gains '),
              segment(name, 'outcome', negative ? 'warning' : 'benefit'),
              ...(duration ? [segment(` · ${duration}`)] : []),
            ]
      kind = statusApplied.kind
      consumed.add(name.toLowerCase())
      if (duration) consumed.add(duration.toLowerCase())
    }
  } else if (statusExpired) {
    const name = statusName(statusExpired)
    const target = combatantName(statusExpired.targetCombatantId, options) ?? 'Combatant'
    primary = [
      segment(`${target}'s `, 'target'),
      segment(name, 'action'),
      segment(' fades as their turn begins'),
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
  } else if (actionUsed && actionLabel) {
    const actor = combatantName(actionUsed.actorCombatantId, options) ?? 'Combatant'
    primary = actionUseSegments(actor, actionLabel)
    kind = actionUsed.kind
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
  const ariaLabel = [primary, secondary ?? []]
    .map((segments) => segments.map((item) => item.text).join(''))
    .filter(Boolean)
    .join(' ')
    .replace(/↳\s*/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()

  return {
    key: group.key,
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
    const key = action.round === null ? 'battle' : `round:${action.round}`
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