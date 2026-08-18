import 'server-only'

import type { BattleEventRecord, BattleEventRepository } from '@aurevane/db/battle-session'

export interface BattleLogEntry {
  battleVersion: number
  eventIndex: number
  occurredAt: string
  eventType: string
  message: string
}

export interface BattleLogView {
  battleSessionId: string
  entries: readonly BattleLogEntry[]
}

export interface BattleLogService {
  getLog(userId: string, battleSessionId: string): Promise<BattleLogView>
}

const BATTLE_LOG_LIMIT = 100

function combatantLabel(value: unknown): string {
  if (typeof value !== 'string') return 'Combatant'
  if (value.startsWith('character:')) return 'Wayfarer'
  if (value.startsWith('recruit:')) return 'Recruit'
  return 'Combatant'
}

function actionLabel(value: unknown): string {
  if (value === 'basic.attack.unarmed.basic') return 'Basic Attack'
  if (value === 'basic.guard') return 'Guard'
  if (typeof value !== 'string' || value.length === 0) return 'an action'
  return value
    .split(/[._-]+/u)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function statusLabel(value: unknown): string {
  if (value === 'guarded') return 'Guarded'
  if (typeof value !== 'string' || value.length === 0) return 'a status'
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

function sanitizePersistedEvent(record: BattleEventRecord): BattleLogEntry | null {
  if (!record.event || typeof record.event !== 'object' || Array.isArray(record.event)) return null
  const event = record.event as Record<string, unknown>
  const eventType = typeof event.event === 'string' ? event.event : null
  if (!eventType) return null

  let message: string | null = null

  switch (eventType) {
    case 'combatant_moved': {
      const origin = positionLabel(event.from)
      const destination = positionLabel(event.to)
      const cost = numberValue(event.movementCost)
      message = `${combatantLabel(event.combatantId)} moved${origin ? ` from ${origin}` : ''}${destination ? ` to ${destination}` : ''}${cost === null ? '' : ` for ${cost} Movement`}.`
      break
    }
    case 'movement_spent': {
      const amount = numberValue(event.amount)
      const remaining = numberValue(event.remaining)
      message = `${combatantLabel(event.combatantId)} spent ${amount ?? 'resolved'} Movement${remaining === null ? '' : `; ${remaining} remains`}.`
      break
    }
    case 'combatant_facing_changed': {
      const facing = typeof event.facing === 'string' ? event.facing : 'a new direction'
      message = `${combatantLabel(event.combatantId)} ended facing ${facing}.`
      break
    }
    case 'final_facing_selected':
      return null
    case 'action_spent':
      return null
    case 'combat_action_used':
      message = `${combatantLabel(event.actorId)} used ${actionLabel(event.actionId)}.`
      break
    case 'damage_applied': {
      const amount = numberValue(event.amount)
      const hpAfter = numberValue(event.hpAfter)
      message = `${combatantLabel(event.targetCombatantId)} took ${amount ?? 'resolved'} damage${hpAfter === null ? '' : ` and has ${hpAfter} HP remaining`}.`
      break
    }
    case 'healing_applied': {
      const amount = numberValue(event.amount)
      const hpAfter = numberValue(event.hpAfter)
      message = `${combatantLabel(event.targetCombatantId)} recovered ${amount ?? 'resolved'} HP${hpAfter === null ? '' : ` and now has ${hpAfter} HP`}.`
      break
    }
    case 'mp_spent': {
      const amount = numberValue(event.amount)
      const remaining = numberValue(event.remaining)
      message = `${combatantLabel(event.combatantId)} spent ${amount ?? 'resolved'} MP${remaining === null ? '' : `; ${remaining} remains`}.`
      break
    }
    case 'resource_changed': {
      const delta = numberValue(event.delta)
      const resource =
        typeof event.resource === 'string' ? event.resource.toUpperCase() : 'resource'
      message = `${combatantLabel(event.targetCombatantId)} ${delta !== null && delta < 0 ? 'spent' : 'gained'} ${delta === null ? 'resolved' : Math.abs(delta)} ${resource}.`
      break
    }
    case 'status_applied': {
      const remaining = numberValue(event.remainingOwnerTurnStarts)
      message = `${combatantLabel(event.targetCombatantId)} gained ${statusLabel(event.statusId)}${remaining === null ? '' : ` for ${remaining} owner-turn start${remaining === 1 ? '' : 's'}`}.`
      break
    }
    case 'status_expired':
      message = `${statusLabel(event.statusId)} expired on ${combatantLabel(event.combatantId)}.`
      break
    case 'combatant_waited':
      message = `${combatantLabel(event.combatantId)} waited.`
      break
    case 'round_started': {
      const round = numberValue(event.round)
      message = `Round ${round ?? '—'} began.`
      break
    }
    case 'turn_started': {
      const round = numberValue(event.round)
      const activation = numberValue(event.turnNumber)
      message = `${combatantLabel(event.combatantId)} activation began${round === null ? '' : ` in Round ${round}`}${activation === null ? '' : ` (activation ${activation})`}.`
      break
    }
    case 'turn_ended': {
      const activation = numberValue(event.turnNumber)
      message = `${combatantLabel(event.combatantId)} ended the activation${activation === null ? '' : ` ${activation}`}.`
      break
    }
    case 'stat_driven_attack_resolved': {
      const hit = event.hit === true
      const chance = numberValue(event.hitChanceBasisPoints)
      message = `${combatantLabel(event.actorId)} Basic Attack ${hit ? 'HIT' : 'MISSED'}${chance === null ? '' : ` (${Math.round(chance / 100)}% hit chance)`}.`
      break
    }
    case 'recruit_ai_decision': {
      message = `Recruit chose ${recruitReasonLabel(event.reason)}.`
      break
    }
    case 'battle_completed':
      message = 'Battle completed.'
      break
    case 'battle_started':
      message = 'Battle began.'
      break
    case 'battle_abandoned':
      message = 'Practice battle was aborted.'
      break
    default:
      return null
  }

  return {
    battleVersion: record.battleVersion,
    eventIndex: record.eventIndex,
    occurredAt: record.createdAt,
    eventType,
    message,
  }
}

export function createBattleLogService(repository: BattleEventRepository): BattleLogService {
  return {
    async getLog(userId, battleSessionId) {
      const records = await repository.findBattleEvents(userId, battleSessionId, BATTLE_LOG_LIMIT)
      return {
        battleSessionId,
        entries: records
          .map(sanitizePersistedEvent)
          .filter((entry): entry is BattleLogEntry => entry !== null),
      }
    },
  }
}
