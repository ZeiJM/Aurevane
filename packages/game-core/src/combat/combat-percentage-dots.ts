import type {
  CombatActionDefinition,
  CombatEffectDefinition,
  CombatEncounterIssue,
  CombatEncounterState,
  CombatResolutionEvent,
} from './actions'
import { collectCommittedHostileCommandDamage } from './combat-committed-damage'
export interface AttackPercentageDotProfile {
  kind: 'attack-percentage'
  basisPoints: number
  decayBasisPointsPerTick?: number
}

export interface CapturedPercentageDotDamage {
  capturedDamage: number
  profile: AttackPercentageDotProfile
}

function integer(
  value: unknown,
  minimum: number,
  maximum: number,
  field: string,
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  )
    throw new RangeError(`${field} must be a safe integer from ${minimum} to ${maximum}.`)
}

export function validatePercentageDotProfile(
  profile: AttackPercentageDotProfile,
  ticks: number,
  type: 'burn' | 'poison' | 'bleed',
): void {
  if (!profile || typeof profile !== 'object' || profile.kind !== 'attack-percentage')
    throw new TypeError('DoT damage profile must use attack-percentage.')
  integer(ticks, 1, 4, 'DoT ticks')
  integer(profile.basisPoints, 1, 10000, 'DoT percentage basis points')
  if (profile.decayBasisPointsPerTick !== undefined) {
    if (type !== 'burn') throw new TypeError('Only Burn can author percentage-point decay.')
    integer(profile.decayBasisPointsPerTick, 0, 10000, 'Burn percentage-point decay')
  }
  if (profile.basisPoints - (profile.decayBasisPointsPerTick ?? 0) * (ticks - 1) <= 0)
    throw new RangeError('Every scheduled Burn percentage must remain positive.')
}

export function percentageDotTickDamage(
  basis: number,
  profile: AttackPercentageDotProfile,
  stage = 0,
): number {
  integer(basis, 0, Number.MAX_SAFE_INTEGER, 'Captured attack HP damage')
  integer(stage, 0, 3, 'DoT stage')
  validatePercentageDotProfile(
    profile,
    stage + 1,
    profile.decayBasisPointsPerTick === undefined ? 'poison' : 'burn',
  )
  const percentage = profile.basisPoints - (profile.decayBasisPointsPerTick ?? 0) * stage
  return Number((BigInt(basis) * BigInt(percentage)) / 10000n)
}

export function validateCapturedPercentageDotDamage(
  value: CapturedPercentageDotDamage,
  ticks: number,
  type: 'burn' | 'poison' | 'bleed',
  stage = 0,
): void {
  if (!value || typeof value !== 'object') throw new TypeError('Captured DoT damage is required.')
  integer(value.capturedDamage, 1, Number.MAX_SAFE_INTEGER, 'Captured attack HP damage')
  integer(stage, 0, 3, 'DoT stage')
  validatePercentageDotProfile(value.profile, ticks + stage, type)
}

export interface PercentageDotCommand {
  id: number
  actorId: string
  actionId: string
  createdRound: number
  damageByRecipient: Readonly<Record<string, number>>
  outstandingDamageEffectOrdinals: readonly number[]
}

export function isPercentageDotEffect(effect: {
  type: string
  damageProfile?: AttackPercentageDotProfile
}): effect is Extract<CombatEffectDefinition, { type: 'burn' | 'poison' | 'bleed' }> & {
  damageProfile: AttackPercentageDotProfile
} {
  return (
    (effect.type === 'burn' || effect.type === 'poison' || effect.type === 'bleed') &&
    effect.damageProfile !== undefined
  )
}

export function allocatePercentageDotCommand(
  state: CombatEncounterState,
  action: CombatActionDefinition,
): { state: CombatEncounterState; commandId: number } {
  if (state.percentageDotPolicyVersion !== 1)
    throw new TypeError('Percentage attacks require their pinned encounter policy.')
  const id = state.nextPercentageDotCommandId ?? 1
  integer(id, 1, Number.MAX_SAFE_INTEGER - 1, 'Percentage command identity')
  const actorId = state.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new TypeError('Percentage attacks require an active actor.')
  return {
    commandId: id,
    state: {
      ...state,
      nextPercentageDotCommandId: id + 1,
      percentageDotCommands: [
        ...(state.percentageDotCommands ?? []),
        {
          id,
          actorId,
          actionId: action.id,
          createdRound: state.tactical.battle.round,
          damageByRecipient: {},
          outstandingDamageEffectOrdinals: [],
        },
      ],
    },
  }
}

export function recordPercentageDotCommandDamage(
  state: CombatEncounterState,
  commandId: number,
  events: readonly CombatResolutionEvent[],
  resolvedEffectOrdinals: readonly number[],
): CombatEncounterState {
  const command = state.percentageDotCommands?.find((row) => row.id === commandId)
  if (!command) throw new TypeError('Percentage damage must reference its originating command.')
  const damage = collectCommittedHostileCommandDamage(state, events, {
    sourceCombatantId: command.actorId,
    actionId: command.actionId,
  })
  const damageByRecipient = { ...command.damageByRecipient }
  for (const [id, amount] of damage) {
    const total = (damageByRecipient[id] ?? 0) + amount
    integer(total, 1, Number.MAX_SAFE_INTEGER, 'Command HP damage')
    Object.defineProperty(damageByRecipient, id, {
      value: total,
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
  return {
    ...state,
    percentageDotCommands: state.percentageDotCommands!.map((row) =>
      row.id !== commandId
        ? row
        : {
            ...row,
            damageByRecipient,
            outstandingDamageEffectOrdinals: row.outstandingDamageEffectOrdinals.filter(
              (ordinal) => !resolvedEffectOrdinals.includes(ordinal),
            ),
          },
    ),
  }
}

export function validatePercentageDotCommandState(
  state: CombatEncounterState,
): CombatEncounterIssue[] {
  try {
    if (state.nextPercentageDotCommandId !== undefined)
      integer(
        state.nextPercentageDotCommandId,
        1,
        Number.MAX_SAFE_INTEGER,
        'Next percentage command identity',
      )
    const commands = state.percentageDotCommands ?? []
    if (!Array.isArray(commands)) throw new TypeError('Percentage commands must be an array.')
    if (
      (commands.length || state.nextPercentageDotCommandId !== undefined) &&
      state.percentageDotPolicyVersion !== 1
    )
      throw new TypeError('Percentage commands require their policy.')
    const ids = new Set<number>()
    const units = new Map(state.tactical.battle.combatants.map((row) => [row.id, row]))
    for (const command of commands) {
      integer(command.id, 1, Number.MAX_SAFE_INTEGER - 1, 'Percentage command identity')
      if (
        ids.has(command.id) ||
        command.id >= (state.nextPercentageDotCommandId ?? 0) ||
        !units.has(command.actorId) ||
        !command.actionId.trim()
      )
        throw new TypeError('Invalid percentage command identity.')
      integer(command.createdRound, 1, state.tactical.battle.round, 'Command creation round')
      ids.add(command.id)
      if (
        !command.damageByRecipient ||
        typeof command.damageByRecipient !== 'object' ||
        Array.isArray(command.damageByRecipient)
      )
        throw new TypeError('Invalid captured receipts.')
      for (const [id, amount] of Object.entries(command.damageByRecipient)) {
        integer(amount, 1, Number.MAX_SAFE_INTEGER, 'Captured recipient HP damage')
        if (!units.has(id) || units.get(id)!.teamId === units.get(command.actorId)!.teamId)
          throw new TypeError('Only hostile recipients qualify.')
      }
      if (
        !Array.isArray(command.outstandingDamageEffectOrdinals) ||
        new Set(command.outstandingDamageEffectOrdinals).size !==
          command.outstandingDamageEffectOrdinals.length
      )
        throw new TypeError('Invalid outstanding effects.')
      for (const ordinal of command.outstandingDamageEffectOrdinals) {
        integer(ordinal, 0, Number.MAX_SAFE_INTEGER, 'Damage effect ordinal')
        if (
          !state.pendingEffects?.some(
            (row) =>
              row.percentageDotCommandId === command.id &&
              row.percentageDotDamageEffectOrdinal === ordinal &&
              row.effect.type === 'damage',
          )
        )
          throw new TypeError('Orphan damage dependency.')
      }
    }
    for (const pending of state.pendingEffects ?? []) {
      if (pending.percentageDotCommandId === undefined) {
        if (
          pending.percentageDotDamageEffectOrdinal !== undefined ||
          isPercentageDotEffect(pending.effect)
        )
          throw new TypeError('Missing percentage command dependency.')
        continue
      }
      const command = commands.find((row) => row.id === pending.percentageDotCommandId)
      if (
        !command ||
        command.actorId !== pending.actorId ||
        command.actionId !== pending.actionId ||
        (!isPercentageDotEffect(pending.effect) && pending.effect.type !== 'damage')
      )
        throw new TypeError('Orphan percentage dependency.')
      if (
        pending.effect.type === 'damage' &&
        !command.outstandingDamageEffectOrdinals.includes(pending.percentageDotDamageEffectOrdinal!)
      )
        throw new TypeError('Untracked delayed damage.')
      if (
        isPercentageDotEffect(pending.effect) &&
        pending.percentageDotDamageEffectOrdinal !== undefined
      )
        throw new TypeError('DoTs cannot resolve a direct damage ordinal.')
    }
    return []
  } catch {
    return [{ field: 'percentageDotCommands', message: 'Invalid percentage attack dependencies.' }]
  }
}

/** Exact decimal input: never round extra precision, scientific notation or invalid values. */
export function parsePercentageBasisPoints(text: string, allowZero = false): number {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text)
  if (!match) throw new TypeError('Use a percentage with at most two decimal places.')
  const basisPoints = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  integer(basisPoints, allowZero ? 0 : 1, 10000, 'Percentage basis points')
  return basisPoints
}

export function percentageBasisPointsText(basisPoints: number): string {
  integer(basisPoints, 0, 10000, 'Percentage basis points')
  const decimals = String(basisPoints % 100)
    .padStart(2, '0')
    .replace(/0+$/, '')
  return `${Math.floor(basisPoints / 100)}${decimals ? `.${decimals}` : ''}`
}

export function percentageDotSequence(profile: AttackPercentageDotProfile, ticks: number): string {
  validatePercentageDotProfile(
    profile,
    ticks,
    profile.decayBasisPointsPerTick !== undefined ? 'burn' : 'poison',
  )
  return Array.from(
    { length: ticks },
    (_, stage) =>
      `${percentageBasisPointsText(profile.basisPoints - (profile.decayBasisPointsPerTick ?? 0) * stage)}%`,
  ).join(' → ')
}

export function validateCurrentPercentageDotAuthoring(
  definition: Pick<CombatActionDefinition, 'tags' | 'target'> & {
    effects: readonly (CombatEffectDefinition | { type: 'summon' })[]
  },
): void {
  for (const effect of definition.effects) {
    if (
      effect.type === 'apply-status' &&
      'statusId' in effect &&
      ['burn', 'poison', 'bleed'].includes(effect.statusId!)
    )
      throw new TypeError(
        'Use typed percentage Burn, Poison or Bleed effects instead of generic status applications.',
      )
    if (effect.type !== 'burn' && effect.type !== 'poison' && effect.type !== 'bleed') continue
    if (!effect.damageProfile)
      throw new TypeError(
        'Current Burn, Poison and Bleed require an attack-percentage damage profile.',
      )
    validatePercentageDotProfile(
      effect.damageProfile,
      effect.type === 'bleed' ? effect.ticks! : effect.durationTurns!,
      effect.type,
    )
    if (!definition.tags.includes('attack'))
      throw new TypeError('A percentage DoT Skill requires the attack tag.')
    if (
      effect.recipient === 'actor' ||
      definition.target.kind === 'self' ||
      ['ally', 'self'].includes(definition.target.teamPolicy) ||
      definition.target.friendlyFire === 'allies-only'
    )
      throw new TypeError('Percentage DoTs require hostile attack recipients.')
    const covered = definition.effects.some(
      (damage) =>
        damage.type === 'damage' &&
        damage.amount! > 0 &&
        damage.recipient !== 'actor' &&
        (damage.recipient === effect.recipient ||
          damage.recipient === 'affected-units' ||
          (effect.recipient === 'affected-units' &&
            damage.recipient === 'primary-unit' &&
            definition.target.shape.kind === 'single' &&
            definition.target.kind === 'unit')),
    )
    if (!covered) throw new TypeError('Add direct hostile Damage covering every DoT recipient.')
  }
}

export function percentageDotDescription(type: 'burn' | 'poison' | 'bleed'): string {
  const basis =
    'Each tick uses the displayed percentage of HP damage dealt by that attack, rounded down.'
  if (type === 'burn')
    return `${basis} Only one Burn can be active on a recipient; reapplication replaces it and restarts its duration and decay. Each later tick loses the authored percentage-point decay. While burning, a unit takes 2 HP backlash once after each damaging command, including misses and multi-hit attacks.`
  if (type === 'poison')
    return `${basis} Only one Poison can be active on a recipient; reapplication replaces it, restarts its duration and resets movement progress. Every five traversed tiles, including Push or Pull, cause an extra tick without consuming a turn-end tick. Partial movement carries between turns; instantaneous relocation does not count.`
  return `${basis} Each Bleed application retains its own captured attack damage and duration. Applications tick independently with no stack limit.`
}

export function percentageDotMagnitude(
  effect: Extract<CombatEffectDefinition, { type: 'burn' | 'poison' | 'bleed' }>,
): string {
  if (!effect.damageProfile) throw new TypeError('A percentage profile is required.')
  try {
    return effect.type === 'burn'
      ? percentageDotSequence(effect.damageProfile, effect.durationTurns!)
      : `${percentageBasisPointsText(effect.damageProfile.basisPoints)}%`
  } catch {
    return 'Invalid percentage'
  }
}
