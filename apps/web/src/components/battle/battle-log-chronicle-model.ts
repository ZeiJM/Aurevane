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
  hasRecordedResult: boolean
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
  'skill_cooldown_advanced',
  'skill_cooldown_ready',
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
  let roundBoundary: BattleLogEntry | null = null
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
    'skill_cooldown_advanced',
    'skill_cooldown_ready',
  ])
  const activationOutcomes = new Set([
    'damage_applied',
    'healing_applied',
    'resource_changed',
    'status_applied',
    'status_removed',
    'persistent_effect_applied',
    'barrier_changed',
    'recovery_scheduled',
    'terrain_overlay_changed',
    'combatant_displaced',
    'displacement_failed',
    'combatant_rewound',
    'temporary_skill_copied',
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
      (entry.actionId || entry.periodicStatusId) &&
      ((((entry.actionId && periodicActions.has(entry.actionId)) || entry.periodicStatusId) &&
        ['damage_applied', 'healing_applied', 'status_removed'].includes(entry.eventType)) ||
        (entry.eventType === 'healing_applied' &&
          scheduledRecovery.has(recoveryKey(entry, 'HP'))) ||
        (entry.eventType === 'resource_changed' &&
          entry.templateValues.resource === 'MP' &&
          scheduledRecovery.has(recoveryKey(entry, 'MP'))))
    const activation =
      entry.effectActivationRound !== undefined &&
      roundBoundary?.battleVersion === entry.battleVersion &&
      roundBoundary.round === entry.effectActivationRound &&
      start?.round === entry.effectActivationRound &&
      entry.actionId &&
      activationOutcomes.has(entry.eventType)
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
          // Activation may kill a newly selected actor and force an immediate handoff.
          entry.effectActivationRound === undefined &&
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
          'skill_cooldown_advanced',
          'skill_cooldown_ready',
        ].includes(entry.eventType) &&
        entry.actorCombatantId !== start.actorCombatantId
      ) {
        start = null
      } else if (
        !passive.has(entry.eventType) &&
        !settlement &&
        !activation &&
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
    if (entry.eventType === 'round_started') roundBoundary = entry
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
  const loweredGuard = entry.actionId === 'battle.lowered-guard.apply'
  return {
    key: eventKey(entry),
    actorId: ownerId,
    title: loweredGuard
      ? 'Lowered Guard'
      : (entry.actionContext?.name ?? entry.actionLabel ?? entry.headline),
    family: family(entry),
    contentId: entry.actionContext?.contentId ?? entry.actionContext?.skillId ?? null,
    contentVersion: entry.actionContext?.contentVersion ?? null,
    flavorTemplate:
      loweredGuard && entry.eventType === 'combat_action_used'
        ? '{actor} lowered {actor.possessive} guard!'
        : (entry.actionContext?.battleText ?? entry.actionContext?.flavor ?? null),
    narrator:
      entry.actionContext?.narrator ??
      (entry.actorNarrator ? { actor: entry.actorNarrator } : undefined),
    targetName,
    fallbackNarration: fallbackNarration(entry, actorName),
    hasRecordedResult: entry.eventType === 'resonance_activated',
    outcomes: [],
    specials: [],
  }
}

function duration(entry: BattleLogEntry): string | undefined {
  const recorded = entry.facts.find((fact) => /^\d+ turns?$/u.test(fact.label))?.label
  if (recorded) return recorded
  const turns = entry.effectTiming?.remainingOwnerTurnEnds
  if (turns) return `${turns} turn${turns === 1 ? '' : 's'}`
  const rounds = entry.effectTiming?.remainingRoundBoundaries
  return rounds ? `${rounds} round${rounds === 1 ? '' : 's'}` : undefined
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
  if (entry.effectTimingState === 'pending') return null
  switch (entry.eventType) {
    case 'effect_pending': {
      const label =
        value.effect ?? (entry.statusId ? combatStatusDetails(entry.statusId).name : entry.headline)
      const candidateRound =
        value.round ?? value.activation?.match(/^ until round ([1-9]\d*)$/)?.[1]
      const recordedRound =
        candidateRound &&
        /^[1-9]\d*$/.test(candidateRound) &&
        Number.isSafeInteger(Number(candidateRound))
          ? Number(candidateRound)
          : undefined
      const round = recordedRound ? `round ${recordedRound}` : 'a future round'
      const remaining =
        entry.effectTiming?.remainingOwnerTurnEnds ?? entry.effectTiming?.remainingRoundBoundaries
      const candidateEnd = recordedRound && remaining ? recordedRound + remaining - 1 : undefined
      const endRound = candidateEnd && Number.isSafeInteger(candidateEnd) ? candidateEnd : undefined
      const span =
        remaining && remaining > 1 && endRound
          ? `during rounds ${recordedRound}–${endRound}`
          : `at the start of ${round}`
      return {
        ...base,
        tone: effectTone(entry.statusId),
        text:
          remaining && remaining > 1 && endRound
            ? `${label} will affect ${entry.targetCombatantId ? target : 'the ground'} ${span}!`
            : `${label} will take effect${entry.targetCombatantId ? ` on ${target}` : ''} ${span}!`,
        ...(entry.statusId ? { statusId: entry.statusId, duration: duration(entry) } : {}),
      }
    }
    case 'damage_applied': {
      if (entry.periodicStatusId) {
        const label = combatStatusDetails(entry.periodicStatusId).name
        const narration =
          entry.periodicStatusId === 'bleed'
            ? `${target}'s wounds reopen`
            : entry.periodicStatusId === 'poison'
              ? `Poison courses through ${target}`
              : `Flames scorch ${target}`
        return {
          ...base,
          text: `${narration} · ${label} deals ${value.amount ?? 'Resolved'} damage`,
          tone: 'damage',
          statusId: entry.periodicStatusId,
        }
      }
      return {
        ...base,
        text: `${value.amount ?? 'Resolved'} damage`,
        recipient: ` to ${target}`,
        tone: 'damage',
      }
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
      if (statusId === 'lowered-guard')
        return {
          ...base,
          tone: 'harm',
          statusId,
          text: `${target} is left wide open to the enemy${turns ? ` for ${turns}` : ''}.${value.stacks && value.stacks !== '1' ? ` · ×${value.stacks}` : ''}`,
          ...(turns ? { duration: turns } : {}),
        }
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
    case 'combat_status_resistance_resolved':
      return { ...base, text: `${target} resists the harmful effect tags.`, tone: 'benefit' }
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
    case 'summon_spawned':
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
      .filter((entry) => entry.eventType === 'damage_applied' && !entry.periodicStatusId)
      .map((entry) => `${entry.battleVersion}:${entry.targetCombatantId}`),
  )
  const commands = new Map<number, BattleLogEntry>()
  for (const entry of ordered)
    if (entry.eventType === 'combat_action_used') commands.set(entry.battleVersion, entry)
  const pendingOutcomes = new Map<number, BattleLogEntry[]>()
  const pinnedNames = new Map<string, string>()
  for (const entry of ordered) {
    const narrator = entry.actionContext?.narrator
    const actorIdentity = narrator?.actor ?? entry.actorNarrator
    if (entry.actorCombatantId && actorIdentity?.name)
      pinnedNames.set(entry.actorCombatantId, actorIdentity.name)
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
  const activations = new Map<string, BattleLogEntry>()
  for (const entry of ordered) {
    if (entry.eventType !== 'resonance_activated' || !entry.actorCombatantId) continue
    const id = entry.actionContext?.contentId ?? entry.actionContext?.skillId
    const contentVersion = entry.actionContext?.contentVersion
    if (id && contentVersion !== undefined)
      activations.set(
        `${entry.battleVersion}:${originKey(entry.actorCombatantId, id, contentVersion)}`,
        entry,
      )
  }
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
        if (pending.eventType === 'summon_spawned') committed.hasRecordedResult = true
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
      const actions = command?.actorId === ownerId ? command.specials : actorGroup().actions
      const existing = actions.find(
        (item) =>
          item.family === 'resonance' &&
          item.contentId === special.contentId &&
          item.contentVersion === special.contentVersion,
      )
      if (existing)
        Object.assign(existing, { ...special, key: existing.key, outcomes: existing.outcomes })
      else actions.push(special)
      continue
    }
    if (entry.eventType === 'summon_spawned') {
      if (
        command?.actorId === ownerId &&
        commands.get(entry.battleVersion)?.actionId === entry.actionId
      )
        command.hasRecordedResult = true
      else if (
        commands.get(entry.battleVersion)?.actorCombatantId === ownerId &&
        commands.get(entry.battleVersion)?.actionId === entry.actionId
      ) {
        const pending = pendingOutcomes.get(entry.battleVersion) ?? []
        pending.push(entry)
        pendingOutcomes.set(entry.battleVersion, pending)
      }
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
        const recordedContext =
          activations.get(
            `${entry.battleVersion}:${originKey(ownerId, origin.contentId, origin.contentVersion)}`,
          ) ?? specialContexts.get(originKey(ownerId, origin.contentId, origin.contentVersion))
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
      !entry.periodicStatusId &&
      (entry.actorCombatantId === null || entry.actorCombatantId === command.actorId)
    ) {
      command.outcomes.push(result)
      attachOutcomeNarrator(command, entry)
      if (command.targetName === 'the ground' && entry.targetCombatantId) {
        command.targetName = chronicleCombatantName(entry.targetCombatantId, names)
      }
    } else {
      const standalone = action(entry, names, ownerId)
      standalone.flavorTemplate = null
      standalone.fallbackNarration = ''
      standalone.outcomes.push(result)
      actorGroup().actions.push(standalone)
    }
  }
  return [...rounds.values()].sort((a, b) => a.round - b.round)
}
