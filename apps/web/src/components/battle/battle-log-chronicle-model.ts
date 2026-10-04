import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import type { BattleLogEntry } from '@/server/battle/battle-log-service'

import { renderBattleLogEntry } from './battle-log-presentation'

export type ChronicleFamily =
  'movement' | 'idle' | 'skill' | 'essence' | 'resonance' | 'ascension' | 'severence'
export interface ChronicleOutcome {
  key: string
  text: string
  recipient?: string
  tone: 'neutral' | 'damage' | 'recovery' | 'benefit' | 'harm'
  statusId?: string
  duration?: string
}
export interface ChronicleAction {
  key: string
  actorId: string
  title: string
  family: ChronicleFamily
  contentId: string | null
  contentVersion: number | null
  flavorTemplate: string | null
  narrator?: NonNullable<BattleLogEntry['actionContext']>['narrator']
  targetName: string
  fallbackNarration: string
  outcomes: ChronicleOutcome[]
  specials: ChronicleAction[]
}
export interface ChronicleRound {
  round: number
  actors: { actorId: string; name: string; actions: ChronicleAction[] }[]
}
export interface ChronicleNames {
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
}

const OMITTED_EVENTS = new Set([
  'movement_spent',
  'combatant_facing_changed',
  'final_facing_selected',
  'round_started',
  'turn_started',
  'turn_ended',
  'combatant_waited',
  'recruit_ai_decision',
  'status_expired',
  'terrain_overlay_expired',
  'resonance_armed',
  'resonance_expired',
  'battle_started',
  'pvp_turn_timed_out',
  'ai_turn_timed_out',
  'mp_spent',
  'summon_ability_used',
])

export function chronicleCombatantName(id: string | null, names: ChronicleNames): string {
  if (!id) return 'the ground'
  const known = names.combatantNames?.[id]
  if (known) return known
  if (id.startsWith('character:')) return names.playerName ?? 'Wayfarer'
  return id.startsWith('recruit:') ? 'Recruit' : 'Combatant'
}

function eventKey(entry: BattleLogEntry) {
  return `${entry.battleVersion}:${entry.eventIndex}`
}

/** A missing boundary or unknown history cannot prove that a character did nothing. */
function completedIdleTurns(entries: readonly BattleLogEntry[]): Set<string> {
  const idle = new Set<string>()
  // Surrender hands off the turn before its surrender receipt in the same commit.
  const surrendered = new Set(
    entries
      .filter((entry) => entry.eventType === 'pvp_combatant_surrendered')
      .map((entry) => `${entry.battleVersion}:${entry.actorCombatantId}`),
  )
  let start: BattleLogEntry | null = null
  let previous: BattleLogEntry | null = null
  let ended: BattleLogEntry | null = null
  const scheduledRecovery = new Set<string>()
  const recoveryKey = (entry: BattleLogEntry, resource: string) =>
    JSON.stringify([entry.actorCombatantId, entry.targetCombatantId, entry.actionId, resource])
  const periodicActions = new Set([
    'status.poison',
    'status.burn',
    'status.bleed',
    'status.regeneration',
    'status.poison.current.v1',
    'status.burn.current.v1',
    'status.bleed.current.v1',
  ])
  const passive = new Set([
    'combatant_facing_changed',
    'final_facing_selected',
    'combatant_waited',
    'ai_turn_timed_out',
    'pvp_turn_timed_out',
    'status_expired',
    'terrain_overlay_expired',
    'resonance_armed',
    'resonance_expired',
  ])
  for (const entry of entries) {
    if (
      entry.eventType === 'recovery_scheduled' &&
      entry.actorCombatantId &&
      entry.targetCombatantId &&
      entry.actionId &&
      ['HP', 'MP'].includes(entry.templateValues.resource)
    ) {
      scheduledRecovery.add(recoveryKey(entry, entry.templateValues.resource))
    }
    // Canonical upkeep follows the outgoing end AND the next actor's start in
    // the same commit. It must not turn that next actor's untouched turn into action.
    const settlement =
      ended?.battleVersion === entry.battleVersion &&
      entry.targetCombatantId === ended.actorCombatantId &&
      entry.actionId &&
      ((periodicActions.has(entry.actionId) &&
        ['damage_applied', 'healing_applied', 'status_removed'].includes(entry.eventType)) ||
        (entry.eventType === 'healing_applied' &&
          scheduledRecovery.has(recoveryKey(entry, 'HP'))) ||
        (entry.eventType === 'resource_changed' &&
          entry.templateValues.resource === 'MP' &&
          scheduledRecovery.has(recoveryKey(entry, 'MP'))))
    if (entry.eventType === 'turn_started') {
      start =
        entry.actorCombatantId && entry.turnNumber !== null && entry.round !== null ? entry : null
    } else if (
      !previous &&
      entry.battleVersion === 2 &&
      entry.eventIndex === 0 &&
      entry.round === 1 &&
      entry.turnNumber === 1 &&
      entry.actorCombatantId &&
      (entry.eventType === 'final_facing_selected' ||
        entry.eventType === 'ai_turn_timed_out' ||
        entry.eventType === 'pvp_turn_timed_out' ||
        (entry.eventType === 'recruit_ai_decision' &&
          ['facing the threat', 'ending the turn'].includes(entry.templateValues.reason)))
    ) {
      // Creation pins snapshot v1 without events. A first idle-ending command
      // at v2/index 0 proves the opening turn without inventing a turn marker.
      start = entry
    } else if (start) {
      const continuous =
        previous &&
        !previous.historyGapAfter &&
        ((entry.battleVersion === previous.battleVersion &&
          entry.eventIndex === previous.eventIndex + 1) ||
          (entry.battleVersion === previous.battleVersion + 1 && entry.eventIndex === 0))
      if (!continuous || entry.round !== start.round || entry.turnNumber !== start.turnNumber) {
        start = null
      } else if (entry.eventType === 'turn_ended') {
        if (
          entry.actorCombatantId === start.actorCombatantId &&
          !surrendered.has(`${entry.battleVersion}:${entry.actorCombatantId}`)
        )
          idle.add(eventKey(entry))
        start = null
      } else if (
        [
          'combatant_facing_changed',
          'final_facing_selected',
          'combatant_waited',
          'ai_turn_timed_out',
          'pvp_turn_timed_out',
        ].includes(entry.eventType) &&
        entry.actorCombatantId !== start.actorCombatantId
      ) {
        start = null
      } else if (
        !passive.has(entry.eventType) &&
        !settlement &&
        !(
          entry.eventType === 'recruit_ai_decision' &&
          entry.actorCombatantId === start.actorCombatantId &&
          ['facing the threat', 'ending the turn'].includes(entry.templateValues.reason)
        )
      ) {
        start = null
      }
    }
    if (entry.eventType === 'turn_ended') ended = entry
    else if (entry.eventType === 'combat_action_used' || entry.eventType === 'hidden_combat_action')
      ended = null
    previous = entry
  }
  return idle
}

function family(entry: BattleLogEntry): ChronicleFamily {
  // Enriched content comes only from exact pinned references after viewer projection.
  const context = entry.actionContext
  if (context?.family) return context.family
  if (entry.eventType === 'resonance_activated') return 'resonance'
  return 'skill'
}

function fallbackNarration(entry: BattleLogEntry, actor: string): string {
  switch (entry.actionId) {
    case 'basic.guard':
      return `${actor} settles into a guarded stance.`
    case 'basic.recover':
      return `${actor} steadies their breath and gathers strength.`
    case 'basic.recover.mp':
      return `${actor} draws magic back into their hands.`
    case 'basic.attack.unarmed.basic':
      return `${actor} drives a measured strike through an opening.`
    default:
      if (entry.eventType === 'resonance_activated')
        return `${actor}'s disciplines answer together.`
      if (entry.eventType === 'combat_action_used')
        return `${actor} uses ${entry.actionLabel ?? 'the skill'}.`
      return ''
  }
}

function action(entry: BattleLogEntry, names: ChronicleNames, ownerId: string): ChronicleAction {
  const actorName = chronicleCombatantName(ownerId, names)
  const targetName = chronicleCombatantName(entry.targetCombatantId, names)
  return {
    key: eventKey(entry),
    actorId: ownerId,
    title: entry.actionContext?.name ?? entry.actionLabel ?? entry.headline,
    family: family(entry),
    contentId: entry.actionContext?.contentId ?? entry.actionContext?.skillId ?? null,
    contentVersion: entry.actionContext?.contentVersion ?? null,
    flavorTemplate: entry.actionContext?.battleText ?? entry.actionContext?.flavor ?? null,
    narrator: entry.actionContext?.narrator,
    targetName,
    fallbackNarration: fallbackNarration(entry, actorName),
    outcomes: [],
    specials: [],
  }
}

function duration(entry: BattleLogEntry): string | undefined {
  return entry.facts.find((fact) => /^\d+ turns?$/u.test(fact.label))?.label
}

function attachOutcomeNarrator(action: ChronicleAction, entry: BattleLogEntry) {
  const narrator = entry.actionContext?.narrator
  if (!narrator) return
  action.narrator = {
    actor: action.narrator?.actor ?? narrator.actor,
    ...((action.narrator?.target ?? narrator.target)
      ? { target: action.narrator?.target ?? narrator.target }
      : {}),
  }
}

/** Classify only the identity preserved by viewer-safe history; display names are not authority. */
function effectTone(statusId: string | undefined): ChronicleOutcome['tone'] {
  const kind = statusId ? combatStatusDetails(statusId).kind : 'Effect'
  return kind === 'Buff' ? 'benefit' : kind === 'Debuff' ? 'harm' : 'neutral'
}

function isAccuracyReceipt(entry: BattleLogEntry): boolean {
  return (
    entry.eventType === 'stat_driven_attack_resolved' ||
    entry.eventType === 'combat_accuracy_resolved'
  )
}

function outcome(entry: BattleLogEntry, names: ChronicleNames): ChronicleOutcome | null {
  const target = chronicleCombatantName(entry.targetCombatantId, names)
  const value = entry.templateValues
  const base = { key: eventKey(entry), tone: 'neutral' as const }
  switch (entry.eventType) {
    case 'effect_pending': {
      const label =
        value.effect ?? (entry.statusId ? combatStatusDetails(entry.statusId).name : entry.headline)
      const recordedRound = value.round ?? value.activation?.match(/^ until round ([1-9]\d*)$/)?.[1]
      const round =
        recordedRound && /^[1-9]\d*$/.test(recordedRound)
          ? `round ${recordedRound}`
          : 'a future round'
      return {
        ...base,
        tone: effectTone(entry.statusId),
        text: `${label} will take effect${entry.targetCombatantId ? ` on ${target}` : ''} at the start of ${round}!`,
        ...(entry.statusId ? { statusId: entry.statusId, duration: duration(entry) } : {}),
      }
    }
    case 'damage_applied':
      return {
        ...base,
        text: `${value.amount ?? 'Resolved'} damage`,
        recipient: ` to ${target}`,
        tone: 'damage',
      }
    case 'healing_applied':
      return {
        ...base,
        text: `+${value.amount ?? 'Resolved'} HP`,
        recipient: entry.targetCombatantId === entry.actorCombatantId ? undefined : ` to ${target}`,
        tone: 'recovery',
      }
    case 'resource_changed': {
      const recovered = value.direction === 'gained' || value.direction === 'recovered'
      const resource = value.resource ?? 'resource'
      const lost = value.direction === 'spent'
      const recoveryResource = resource === 'MP' || resource === 'HP'
      return {
        ...base,
        text: `${recovered ? '+' : '−'}${value.amount ?? 'Resolved'} ${resource}`,
        recipient: entry.targetCombatantId === entry.actorCombatantId ? undefined : ` to ${target}`,
        tone:
          recoveryResource && recovered
            ? 'recovery'
            : recoveryResource && lost
              ? 'harm'
              : 'neutral',
      }
    }
    case 'status_applied':
    case 'pvp_lowered_guard_applied':
    case 'ai_lowered_guard_applied': {
      const turns = duration(entry)
      const statusId =
        value.statusId ??
        entry.statusId ??
        (entry.eventType.includes('lowered_guard') ? 'lowered-guard' : undefined)
      return {
        ...base,
        tone: effectTone(statusId),
        text: `${value.status ?? entry.headline}${turns ? `, ${turns}` : ''}${value.stacks && value.stacks !== '1' ? ` · ×${value.stacks}` : ''}`,
        recipient:
          entry.targetCombatantId && entry.targetCombatantId !== entry.actorCombatantId
            ? ` to ${target}`
            : undefined,
        ...(statusId ? { statusId } : {}),
        ...(turns ? { duration: turns } : {}),
      }
    }
    case 'stat_driven_attack_resolved':
    case 'combat_accuracy_resolved':
      return {
        ...base,
        text:
          value.outcome === 'MISSED'
            ? `The ${entry.eventType === 'combat_accuracy_resolved' ? 'skill' : 'strike'} misses ${target}.`
            : `The ${entry.eventType === 'combat_accuracy_resolved' ? 'skill' : 'strike'} hits ${target}.`,
      }
    case 'status_removed': {
      const tone = effectTone(entry.statusId)
      return {
        ...base,
        text: renderBattleLogEntry(entry, names),
        tone: tone === 'benefit' ? 'harm' : tone === 'harm' ? 'benefit' : 'neutral',
        ...(entry.statusId ? { statusId: entry.statusId } : {}),
      }
    }
    case 'recovery_scheduled':
      return {
        ...base,
        text: renderBattleLogEntry(entry, names),
        tone: value.resource === 'HP' || value.resource === 'MP' ? 'recovery' : 'neutral',
      }
    case 'combat_action_used':
    case 'resonance_activated':
      return null
    default:
      return {
        ...base,
        text: renderBattleLogEntry(entry, names),
        tone: effectTone(entry.statusId),
        ...(entry.statusId ? { statusId: entry.statusId, duration: duration(entry) } : {}),
      }
  }
}

/** All viewer-safe recorded outcomes are retained; no authored magnitude substitutes for a result. */
export function buildBattleChronicle(
  entries: readonly BattleLogEntry[],
  names: ChronicleNames = {},
): ChronicleRound[] {
  const rounds = new Map<number, ChronicleRound>()
  const ordered = [...entries].sort(
    (a, b) => a.battleVersion - b.battleVersion || a.eventIndex - b.eventIndex,
  )
  const idleTurns = completedIdleTurns(ordered)
  const damageTargets = new Set(
    ordered
      .filter((entry) => entry.eventType === 'damage_applied')
      .map((entry) => `${entry.battleVersion}:${entry.targetCombatantId}`),
  )
  const commands = new Map<number, BattleLogEntry>()
  for (const entry of ordered)
    if (entry.eventType === 'combat_action_used') commands.set(entry.battleVersion, entry)
  const pendingOutcomes = new Map<number, BattleLogEntry[]>()
  const pinnedNames = new Map<string, string>()
  for (const entry of ordered) {
    const narrator = entry.actionContext?.narrator
    if (entry.actorCombatantId && narrator?.actor.name)
      pinnedNames.set(entry.actorCombatantId, narrator.actor.name)
    if (entry.targetCombatantId && narrator?.target?.name)
      pinnedNames.set(entry.targetCombatantId, narrator.target.name)
  }
  names = {
    ...names,
    combatantNames: { ...names.combatantNames, ...Object.fromEntries(pinnedNames) },
  }
  const moved = new Set<string>()
  const specialContexts = new Map<string, BattleLogEntry>()
  const originKey = (actorId: string, id: string, version: number) => `${actorId}:${id}@${version}`
  let command: ChronicleAction | null = null
  let version = -1
  for (const entry of ordered) {
    if (entry.battleVersion !== version) {
      command = null
      version = entry.battleVersion
    }
    if (
      entry.eventType === 'round_started' ||
      entry.eventType === 'turn_started' ||
      entry.eventType === 'turn_ended'
    )
      command = null
    const idle = idleTurns.has(eventKey(entry))
    if (OMITTED_EVENTS.has(entry.eventType) && !idle) continue
    const roundNumber = entry.round ?? 1
    const round = rounds.get(roundNumber) ?? { round: roundNumber, actors: [] }
    const ownerId: string =
      entry.actorCombatantId ?? command?.actorId ?? entry.targetCombatantId ?? 'battle'
    const actorGroup = () => {
      let group = round.actors.find((actor) => actor.actorId === ownerId)
      if (!group) {
        group = {
          actorId: ownerId,
          name: ownerId === 'battle' ? 'Battle' : chronicleCombatantName(ownerId, names),
          actions: [],
        }
        round.actors.push(group)
      }
      rounds.set(roundNumber, round)
      return group
    }
    if (idle) {
      actorGroup().actions.push({
        ...action(entry, names, ownerId),
        family: 'idle',
        title: '',
        fallbackNarration: `${chronicleCombatantName(ownerId, names)} stands around and does nothing.`,
        flavorTemplate: null,
      })
      continue
    }
    if (entry.eventType === 'combatant_moved') {
      const key = `${roundNumber}:${ownerId}`
      if (!moved.has(key)) {
        moved.add(key)
        actorGroup().actions.push({
          ...action(entry, names, ownerId),
          family: 'movement',
          title: '',
          fallbackNarration: `${chronicleCombatantName(ownerId, names)} moves.`,
          flavorTemplate: null,
        })
      }
      continue
    }
    if (entry.eventType === 'combat_action_used') {
      const committed = action(entry, names, ownerId)
      command = committed
      for (const pending of pendingOutcomes.get(entry.battleVersion) ?? []) {
        const result = outcome(pending, names)
        if (result) committed.outcomes.push(result)
        attachOutcomeNarrator(committed, pending)
        if (pending.targetCombatantId)
          committed.targetName = chronicleCombatantName(pending.targetCombatantId, names)
      }
      pendingOutcomes.delete(entry.battleVersion)
      actorGroup().actions.push(committed)
      continue
    }
    if (entry.eventType === 'resonance_activated') {
      const special = action(entry, names, ownerId)
      if (special.contentId && special.contentVersion !== null)
        specialContexts.set(originKey(ownerId, special.contentId, special.contentVersion), entry)
      if (command?.actorId === ownerId) command.specials.push(special)
      else actorGroup().actions.push(special)
      continue
    }
    if (
      isAccuracyReceipt(entry) &&
      entry.templateValues.outcome === 'HIT' &&
      damageTargets.has(`${entry.battleVersion}:${entry.targetCombatantId}`)
    )
      continue
    if (
      !command &&
      commands.get(entry.battleVersion)?.actorCombatantId === entry.actorCombatantId &&
      isAccuracyReceipt(entry)
    ) {
      const pending = pendingOutcomes.get(entry.battleVersion) ?? []
      pending.push(entry)
      pendingOutcomes.set(entry.battleVersion, pending)
      continue
    }
    const result = outcome(entry, names)
    if (!result) continue
    const origin = entry.effectOrigin
    if (origin?.family === 'resonance') {
      // Origin refs have been checked against immutable viewer-visible authority by the service.
      const actions = command?.actorId === ownerId ? command.specials : actorGroup().actions
      let special = actions.find(
        (item) =>
          item.family === 'resonance' &&
          item.contentId === origin.contentId &&
          item.contentVersion === origin.contentVersion,
      )
      if (!special) {
        const recordedContext = specialContexts.get(
          originKey(ownerId, origin.contentId, origin.contentVersion),
        )
        special = action(
          {
            ...entry,
            ...(recordedContext
              ? { actionContext: recordedContext.actionContext }
              : { actionContext: undefined, actionLabel: 'Resonance' }),
          },
          names,
          ownerId,
        )
        special.family = 'resonance'
        special.contentId = origin.contentId
        special.contentVersion = origin.contentVersion
        actions.push(special)
      }
      special.outcomes.push(result)
      attachOutcomeNarrator(special, entry)
      continue
    }
    if (
      command &&
      (entry.actorCombatantId === null || entry.actorCombatantId === command.actorId)
    ) {
      command.outcomes.push(result)
      attachOutcomeNarrator(command, entry)
      if (command.targetName === 'the ground' && entry.targetCombatantId) {
        command.targetName = chronicleCombatantName(entry.targetCombatantId, names)
      }
    } else {
      const standalone = action(entry, names, ownerId)
      standalone.outcomes.push(result)
      actorGroup().actions.push(standalone)
    }
  }
  return [...rounds.values()].sort((a, b) => a.round - b.round)
}
