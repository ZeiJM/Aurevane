import 'server-only'

import type {
  BattleEventCursor,
  BattleEventRecord,
  BattleEventRepository,
} from '@aurevane/db/battle-session'

export type BattleLogKind =
  'offense' | 'movement' | 'defense' | 'recovery' | 'status' | 'resource' | 'turn' | 'system'

export type BattleLogTone = 'neutral' | 'damage' | 'healing' | 'benefit' | 'warning'

export interface BattleLogFact {
  label: string
  tone: BattleLogTone
}

export interface BattleLogEntry {
  battleVersion: number
  eventIndex: number
  occurredAt: string
  eventType: string
  message: string
  messageTemplate: string
  templateValues: Readonly<Record<string, string>>
  actorCombatantId: string | null
  targetCombatantId: string | null
  actionId: string | null
  actionLabel: string | null
  round: number | null
  turnNumber: number | null
  kind: BattleLogKind
  headline: string
  tone: BattleLogTone
  facts: readonly BattleLogFact[]
}

export interface BattleLogView {
  battleSessionId: string
  entries: readonly BattleLogEntry[]
}

export interface BattleLogService {
  getLog(userId: string, battleSessionId: string): Promise<BattleLogView>
}

const BATTLE_LOG_PAGE_SIZE = 100

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function combatantLabel(value: unknown): string {
  if (typeof value !== 'string') return 'Combatant'
  if (value.startsWith('character:')) return 'Wayfarer'
  if (value.startsWith('recruit:')) return 'Recruit'
  return 'Combatant'
}

function actionLabel(value: unknown): string {
  if (value === 'basic.attack.unarmed.basic') return 'Basic Attack'
  if (value === 'basic.guard') return 'Guard'
  if (value === 'basic.recover') return 'Recover'
  if (typeof value !== 'string' || value.length === 0) return 'Action'
  return value
    .split(/[._-]+/u)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function actionKind(value: unknown): BattleLogKind {
  if (value === 'basic.guard') return 'defense'
  if (value === 'basic.recover') return 'recovery'
  return 'offense'
}

function statusLabel(value: unknown): string {
  if (value === 'guarded') return 'Guarded'
  if (value === 'lowered-guard') return 'Lowered Guard'
  if (typeof value !== 'string' || value.length === 0) return 'Status'
  return value
    .split(/[._-]+/u)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function recruitReasonLabel(value: unknown): string {
  if (value === 'legal-damage') return 'an attack opportunity'
  if (value === 'close-distance') return 'closing the distance'
  if (value === 'guard-survival') return 'Guard'
  if (value === 'face-threat') return 'facing the threat'
  if (value === 'safe-end-turn') return 'ending the turn'
  return 'a legal tactical option'
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function positionLabel(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const position = value as Record<string, unknown>
  const x = numberValue(position.x)
  const y = numberValue(position.y)
  if (x === null || y === null) return null
  return `${x + 1}, ${y + 1}`
}

function fact(label: string | null, tone: BattleLogTone = 'neutral'): BattleLogFact[] {
  return label ? [{ label, tone }] : []
}

function renderTemplate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_.-]*)\}/gu, (_match, token: string) => {
    return values[token] ?? ''
  })
}

function createEntry(
  record: BattleEventRecord,
  eventType: string,
  input: {
    message?: string
    messageTemplate: string
    templateValues?: Readonly<Record<string, string>>
    actorCombatantId?: string | null
    targetCombatantId?: string | null
    actionId?: string | null
    actionLabel?: string | null
    round?: number | null
    turnNumber?: number | null
    kind: BattleLogKind
    headline: string
    tone?: BattleLogTone
    facts?: readonly BattleLogFact[]
  },
): BattleLogEntry {
  const actorCombatantId = input.actorCombatantId ?? null
  const targetCombatantId = input.targetCombatantId ?? null
  const templateValues = input.templateValues ?? {}
  const defaultMessageValues = {
    ...templateValues,
    actor: combatantLabel(actorCombatantId),
    target: combatantLabel(targetCombatantId),
  }

  return {
    battleVersion: record.battleVersion,
    eventIndex: record.eventIndex,
    occurredAt: record.createdAt,
    eventType,
    message: input.message ?? renderTemplate(input.messageTemplate, defaultMessageValues),
    messageTemplate: input.messageTemplate,
    templateValues,
    actorCombatantId,
    targetCombatantId,
    actionId: input.actionId ?? null,
    actionLabel: input.actionLabel ?? null,
    round: input.round ?? null,
    turnNumber: input.turnNumber ?? null,
    kind: input.kind,
    headline: input.headline,
    tone: input.tone ?? 'neutral',
    facts: input.facts ?? [],
  }
}

function sanitizePersistedEvent(record: BattleEventRecord): BattleLogEntry | null {
  if (!record.event || typeof record.event !== 'object' || Array.isArray(record.event)) return null
  const event = record.event as Record<string, unknown>
  const eventType = stringValue(event.event)
  if (!eventType) return null

  switch (eventType) {
    case 'combatant_moved': {
      const actorCombatantId = stringValue(event.combatantId)
      const origin = positionLabel(event.from)
      const destination = positionLabel(event.to)
      const cost = numberValue(event.movementCost)
      const route = origin && destination ? `${origin} → ${destination}` : (destination ?? origin)
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.combatantId)} moved${origin ? ` from ${origin}` : ''}${destination ? ` to ${destination}` : ''}${cost === null ? '' : ` for ${cost} Movement`}.`,
        messageTemplate: `{actor} moved${origin ? ` from ${origin}` : ''}${destination ? ` to ${destination}` : ''}.`,
        actorCombatantId,
        kind: 'movement',
        headline: 'Move',
        facts: [...fact(route), ...fact(cost === null ? null : `${cost} Move spent`)],
      })
    }
    case 'movement_spent': {
      const actorCombatantId = stringValue(event.combatantId)
      const amount = numberValue(event.amount)
      const remaining = numberValue(event.remaining)
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.combatantId)} spent ${amount ?? 'resolved'} Movement${remaining === null ? '' : `; ${remaining} remains`}.`,
        messageTemplate: '{actor} spent {amount} Movement.',
        templateValues: { amount: String(amount ?? 'resolved') },
        actorCombatantId,
        kind: 'resource',
        headline: 'Movement',
        facts: [
          ...fact(amount === null ? null : `−${amount} Move`),
          ...fact(remaining === null ? null : `${remaining} left`),
        ],
      })
    }
    case 'combatant_facing_changed': {
      const actorCombatantId = stringValue(event.combatantId)
      const facing = stringValue(event.facing) ?? 'a new direction'
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.combatantId)} ended facing ${facing}.`,
        messageTemplate: '{actor} faces {facing}.',
        templateValues: { facing },
        actorCombatantId,
        kind: 'turn',
        headline: 'Facing',
        facts: fact(facing.toUpperCase()),
      })
    }
    case 'final_facing_selected':
      return null
    case 'action_spent':
      return null
    case 'combat_action_used': {
      const actorCombatantId = stringValue(event.actorId)
      const actionId = stringValue(event.actionId)
      const label = actionLabel(actionId)
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.actorId)} used ${label}.`,
        messageTemplate: '{actor} used {action}.',
        templateValues: { action: label },
        actorCombatantId,
        actionId,
        actionLabel: label,
        kind: actionKind(actionId),
        headline: label,
      })
    }
    case 'damage_applied': {
      const actorCombatantId = stringValue(event.sourceCombatantId)
      const targetCombatantId = stringValue(event.targetCombatantId)
      const actionId = stringValue(event.actionId)
      const amount = numberValue(event.amount)
      const hpAfter = numberValue(event.hpAfter)
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.targetCombatantId)} took ${amount ?? 'resolved'} damage${hpAfter === null ? '' : ` and has ${hpAfter} HP remaining`}.`,
        messageTemplate: '{target} took {amount} damage.',
        templateValues: { amount: String(amount ?? 'resolved') },
        actorCombatantId,
        targetCombatantId,
        actionId,
        actionLabel: actionId ? actionLabel(actionId) : null,
        kind: 'offense',
        headline: actionId ? actionLabel(actionId) : 'Damage',
        tone: 'damage',
        facts: [
          ...fact(amount === null ? null : `${amount} DMG`, 'damage'),
          ...fact(hpAfter === null ? null : `${hpAfter} HP remaining`),
        ],
      })
    }
    case 'healing_applied': {
      const actorCombatantId = stringValue(event.sourceCombatantId)
      const targetCombatantId = stringValue(event.targetCombatantId)
      const actionId = stringValue(event.actionId)
      const amount = numberValue(event.amount)
      const hpAfter = numberValue(event.hpAfter)
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.targetCombatantId)} recovered ${amount ?? 'resolved'} HP${hpAfter === null ? '' : ` and now has ${hpAfter} HP`}.`,
        messageTemplate: '{target} recovered {amount} HP.',
        templateValues: { amount: String(amount ?? 'resolved') },
        actorCombatantId,
        targetCombatantId,
        actionId,
        actionLabel: actionId ? actionLabel(actionId) : 'Recover',
        kind: 'recovery',
        headline: actionId ? actionLabel(actionId) : 'Recover',
        tone: 'healing',
        facts: [
          ...fact(amount === null ? null : `+${amount} HP`, 'healing'),
          ...fact(hpAfter === null ? null : `${hpAfter} HP remaining`),
        ],
      })
    }
    case 'mp_spent': {
      const actorCombatantId = stringValue(event.combatantId)
      const amount = numberValue(event.amount)
      const remaining = numberValue(event.remaining)
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.combatantId)} spent ${amount ?? 'resolved'} MP${remaining === null ? '' : `; ${remaining} remains`}.`,
        messageTemplate: '{actor} spent {amount} MP.',
        templateValues: { amount: String(amount ?? 'resolved') },
        actorCombatantId,
        kind: 'resource',
        headline: 'MP',
        facts: [
          ...fact(amount === null ? null : `−${amount} MP`),
          ...fact(remaining === null ? null : `${remaining} left`),
        ],
      })
    }
    case 'resource_changed': {
      const targetCombatantId = stringValue(event.targetCombatantId)
      const delta = numberValue(event.delta)
      const resource = stringValue(event.resource)?.toUpperCase() ?? 'RESOURCE'
      const direction = delta !== null && delta < 0 ? 'spent' : 'gained'
      const amount = delta === null ? 'resolved' : Math.abs(delta)
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.targetCombatantId)} ${direction} ${amount} ${resource}.`,
        messageTemplate: '{target} {direction} {amount} {resource}.',
        templateValues: { direction, amount: String(amount), resource },
        targetCombatantId,
        kind: 'resource',
        headline: resource,
        tone: delta !== null && delta > 0 ? 'benefit' : 'neutral',
        facts: fact(
          delta === null ? resource : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${resource}`,
        ),
      })
    }
    case 'status_applied': {
      const targetCombatantId = stringValue(event.targetCombatantId)
      const statusId = stringValue(event.statusId)
      const label = statusLabel(statusId)
      const remaining = numberValue(event.remainingOwnerTurnStarts)
      const refreshed = event.refreshed === true
      const beneficial = statusId === 'guarded' || statusId?.startsWith('buff.') === true
      return createEntry(record, eventType, {
        message: refreshed
          ? `${combatantLabel(event.targetCombatantId)} refreshed ${label}${remaining === null ? '' : ` for ${remaining} owner-turn start${remaining === 1 ? '' : 's'}`}.`
          : `${combatantLabel(event.targetCombatantId)} gained ${label}${remaining === null ? '' : ` for ${remaining} owner-turn start${remaining === 1 ? '' : 's'}`}.`,
        messageTemplate: refreshed ? "{target}'s {status} refreshed." : '{target} gained {status}.',
        templateValues: { status: label, statusChange: refreshed ? 'REFRESHED' : 'APPLIED' },
        targetCombatantId,
        kind: beneficial && statusId === 'guarded' ? 'defense' : 'status',
        headline: label,
        tone: beneficial ? 'benefit' : 'neutral',
        facts: [
          ...fact(label, beneficial ? 'benefit' : 'neutral'),
          ...fact(remaining === null ? null : `${remaining} turn${remaining === 1 ? '' : 's'}`),
        ],
      })
    }
    case 'status_expired': {
      const targetCombatantId = stringValue(event.combatantId)
      const label = statusLabel(event.statusId)
      return createEntry(record, eventType, {
        message: `${label} expired on ${combatantLabel(event.combatantId)}.`,
        messageTemplate: '{status} expired on {target}.',
        templateValues: { status: label },
        targetCombatantId,
        kind: 'status',
        headline: label,
        facts: [],
      })
    }
    case 'combatant_waited': {
      const actorCombatantId = stringValue(event.combatantId)
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.combatantId)} waited.`,
        messageTemplate: '{actor} waited.',
        actorCombatantId,
        kind: 'turn',
        headline: 'Wait',
        facts: fact('No action'),
      })
    }
    case 'round_started': {
      const round = numberValue(event.round)
      return createEntry(record, eventType, {
        message: `Round ${round ?? '—'} began.`,
        messageTemplate: 'Round {round} began.',
        templateValues: { round: String(round ?? '—') },
        round,
        kind: 'turn',
        headline: `Round ${round ?? '—'}`,
      })
    }
    case 'turn_started': {
      const actorCombatantId = stringValue(event.combatantId)
      const round = numberValue(event.round)
      const turnNumber = numberValue(event.turnNumber)
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.combatantId)} activation began${round === null ? '' : ` in Round ${round}`}${turnNumber === null ? '' : ` (activation ${turnNumber})`}.`,
        messageTemplate: '{actor} began turn {turn}.',
        templateValues: { turn: String(turnNumber ?? '—') },
        actorCombatantId,
        round,
        turnNumber,
        kind: 'turn',
        headline: 'Turn Start',
      })
    }
    case 'turn_ended': {
      const actorCombatantId = stringValue(event.combatantId)
      const turnNumber = numberValue(event.turnNumber)
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.combatantId)} ended the activation${turnNumber === null ? '' : ` ${turnNumber}`}.`,
        messageTemplate: '{actor} ended turn {turn}.',
        templateValues: { turn: String(turnNumber ?? '—') },
        actorCombatantId,
        turnNumber,
        kind: 'turn',
        headline: 'Turn End',
      })
    }
    case 'stat_driven_attack_resolved': {
      const actorCombatantId = stringValue(event.actorId)
      const targetCombatantId = stringValue(event.targetId)
      const actionId = stringValue(event.actionId) ?? 'basic.attack.unarmed.basic'
      const label = actionLabel(actionId)
      const hit = event.hit === true
      const chance = numberValue(event.hitChanceBasisPoints)
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.actorId)} Basic Attack ${hit ? 'HIT' : 'MISSED'}${chance === null ? '' : ` (${Math.round(chance / 100)}% hit chance)`}.`,
        messageTemplate: '{actor} {action} {outcome}.',
        templateValues: { action: label, outcome: hit ? 'HIT' : 'MISSED' },
        actorCombatantId,
        targetCombatantId,
        actionId,
        actionLabel: label,
        kind: 'offense',
        headline: label,
        tone: hit ? 'damage' : 'warning',
        facts: [
          ...fact(hit ? 'HIT' : 'MISS', hit ? 'damage' : 'warning'),
          ...fact(chance === null ? null : `${Math.round(chance / 100)}% hit chance`),
        ],
      })
    }
    case 'recruit_ai_decision': {
      const actorCombatantId = stringValue(event.combatantId)
      const reason = recruitReasonLabel(event.reason)
      return createEntry(record, eventType, {
        message: `Recruit chose ${reason}.`,
        messageTemplate: '{actor} chose {reason}.',
        templateValues: { reason },
        actorCombatantId,
        kind: 'turn',
        headline: 'Tactical Choice',
      })
    }
    case 'pvp_turn_timed_out':
    case 'ai_turn_timed_out': {
      const actorCombatantId = stringValue(event.combatantId)
      const timeouts = numberValue(event.consecutiveMisses)
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.combatantId)} timed out${timeouts === null ? '' : ` (${timeouts} consecutive timeout${timeouts === 1 ? '' : 's'})`}.`,
        messageTemplate: '{actor} timed out.',
        actorCombatantId,
        kind: 'turn',
        headline: 'Turn Timeout',
        tone: 'warning',
        facts:
          timeouts !== null && timeouts > 1
            ? fact(`${timeouts} consecutive timeouts`, 'warning')
            : [],
      })
    }
    case 'pvp_lowered_guard_applied':
    case 'ai_lowered_guard_applied': {
      const targetCombatantId = stringValue(event.combatantId)
      const remaining = numberValue(event.remainingOwnerTurnStarts)
      const multiplier = numberValue(event.damageTakenMultiplierBasisPoints)
      const multiplierValue = multiplier === null ? null : multiplier / 10_000
      const multiplierLabel =
        multiplierValue === null
          ? null
          : `Takes ${multiplierValue
              .toFixed(2)
              .replace(/\.0+$/u, '')
              .replace(/(\.\d*[1-9])0+$/u, '$1')}× damage`
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.combatantId)} gained Lowered Guard after the turn timer expired.`,
        messageTemplate: '{target} gained Lowered Guard.',
        targetCombatantId,
        kind: 'status',
        headline: 'Lowered Guard',
        tone: 'warning',
        facts: [
          ...fact('Lowered Guard', 'warning'),
          ...fact(remaining === null ? null : `${remaining} turn${remaining === 1 ? '' : 's'}`),
          ...fact(multiplierLabel, 'warning'),
        ],
      })
    }
    case 'pvp_combatant_surrendered': {
      const actorCombatantId = stringValue(event.combatantId)
      return createEntry(record, eventType, {
        message: `${combatantLabel(event.combatantId)} surrendered.`,
        messageTemplate: '{actor} surrendered.',
        actorCombatantId,
        kind: 'system',
        headline: 'Surrender',
        tone: 'warning',
        facts: fact('Surrendered', 'warning'),
      })
    }
    case 'battle_completed':
      return createEntry(record, eventType, {
        message: 'Battle completed.',
        messageTemplate: 'Battle completed.',
        kind: 'system',
        headline: 'Battle Complete',
        tone: 'benefit',
        facts: fact('Complete', 'benefit'),
      })
    case 'battle_started':
      return createEntry(record, eventType, {
        message: 'Battle began.',
        messageTemplate: 'Battle began.',
        kind: 'system',
        headline: 'Battle Start',
      })
    case 'battle_abandoned':
      return createEntry(record, eventType, {
        message: 'Practice battle was aborted.',
        messageTemplate: 'Practice battle ended early.',
        kind: 'system',
        headline: 'Battle Ended',
        tone: 'warning',
        facts: fact('Ended early', 'warning'),
      })
    default:
      return null
  }
}

function eventKey(entry: Pick<BattleLogEntry, 'battleVersion' | 'eventIndex'>): string {
  return `${entry.battleVersion}:${entry.eventIndex}`
}

function annotateBattleContext(entries: readonly BattleLogEntry[]): BattleLogEntry[] {
  const oldestFirst = [...entries].sort((left, right) => {
    if (left.battleVersion !== right.battleVersion) return left.battleVersion - right.battleVersion
    return left.eventIndex - right.eventIndex
  })
  const context = new Map<string, { round: number | null; turnNumber: number | null }>()
  let round: number | null = null
  let turnNumber: number | null = null

  for (const entry of oldestFirst) {
    if (entry.eventType === 'round_started') turnNumber = null
    if (entry.round !== null) round = entry.round
    if (entry.turnNumber !== null) turnNumber = entry.turnNumber
    context.set(eventKey(entry), {
      round: entry.round ?? round,
      turnNumber: entry.turnNumber ?? turnNumber,
    })
  }

  let nextRound: number | null = null
  for (let index = oldestFirst.length - 1; index >= 0; index -= 1) {
    const entry = oldestFirst[index]
    if (!entry) continue
    const key = eventKey(entry)
    const resolved = context.get(key)
    if (!resolved) continue
    if (resolved.round !== null) {
      nextRound = resolved.round
      continue
    }
    if (nextRound !== null) context.set(key, { ...resolved, round: nextRound })
  }

  return entries.map((entry) => {
    const resolved = context.get(eventKey(entry))
    return resolved ? { ...entry, ...resolved } : entry
  })
}

export function buildBattleLogView(
  battleSessionId: string,
  records: readonly BattleEventRecord[],
): BattleLogView {
  const entries = records
    .map(sanitizePersistedEvent)
    .filter((entry): entry is BattleLogEntry => entry !== null)

  return {
    battleSessionId,
    entries: annotateBattleContext(entries),
  }
}

export async function collectBattleEventHistory(
  fetchPage: (
    pageSize: number,
    before?: BattleEventCursor,
  ) => Promise<readonly BattleEventRecord[]>,
): Promise<BattleEventRecord[]> {
  const records: BattleEventRecord[] = []
  const seen = new Set<string>()
  let before: BattleEventCursor | undefined

  while (true) {
    const page = await fetchPage(BATTLE_LOG_PAGE_SIZE, before)
    if (page.length === 0) break

    for (const record of page) {
      const key = `${record.battleVersion}:${record.eventIndex}`
      if (seen.has(key)) continue
      seen.add(key)
      records.push(record)
    }

    if (page.length < BATTLE_LOG_PAGE_SIZE) break
    const oldest = page.at(-1)
    if (!oldest) break
    const nextBefore: BattleEventCursor = {
      battleVersion: oldest.battleVersion,
      eventIndex: oldest.eventIndex,
    }
    if (
      before?.battleVersion === nextBefore.battleVersion &&
      before.eventIndex === nextBefore.eventIndex
    ) {
      throw new Error('Battle event history pagination did not advance.')
    }
    before = nextBefore
  }

  return records
}

export function createBattleLogService(repository: BattleEventRepository): BattleLogService {
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
