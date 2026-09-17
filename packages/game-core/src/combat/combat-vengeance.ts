import type { CombatActionDefinition, CombatEncounterState } from './actions'

export interface CombatVengeanceDefinition {
  conversionBasisPoints: number
  minimumDamage?: number
  maximumDamage: number
}

export interface CombatVengeanceBasis {
  effectOrdinal: number
  sourceCombatantId: string
  windowStartRound: number
  windowEndRound: number
  damageByRound: readonly { round: number; amount: number }[]
  rawDamage: number
}

/** Validate before lowering the profile to ordinary damage, so invalid authoring cannot disappear. */
export function validateVengeanceActionDefinition(action: CombatActionDefinition): void {
  for (const effect of action.effects) {
    if (!('vengeance' in effect) || effect.vengeance === undefined) continue
    if (effect.type !== 'damage' || action.sourceType === 'basic-attack') {
      throw new TypeError(
        'Vengeance requires a damage effect outside the historical Basic Attack adapter.',
      )
    }
    if (effect.amount !== 0 || effect.scaling !== undefined) {
      throw new TypeError('Vengeance requires zero base damage and no offensive-stat scaling.')
    }
    const profile = effect.vengeance
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      throw new TypeError('Vengeance requires a typed conversion profile.')
    }
    if (
      Object.keys(profile).some(
        (key) => !['conversionBasisPoints', 'minimumDamage', 'maximumDamage'].includes(key),
      )
    ) {
      throw new TypeError('Vengeance profile contains an unsupported field.')
    }
    assertSafeInteger(profile.conversionBasisPoints, 1, 'conversion percentage')
    assertSafeInteger(profile.maximumDamage, 1, 'maximum damage')
    if (profile.minimumDamage !== undefined) {
      assertSafeInteger(profile.minimumDamage, 0, 'minimum damage')
      if (profile.minimumDamage > profile.maximumDamage) {
        throw new RangeError('Vengeance minimum damage cannot exceed its maximum.')
      }
    }
  }
}

/** Read one command-start snapshot. Vengeance never consumes history or reactive output. */
export function materializeVengeanceDamage(
  state: CombatEncounterState,
  action: CombatActionDefinition,
): { action: CombatActionDefinition; basis: readonly CombatVengeanceBasis[] } {
  validateVengeanceActionDefinition(action)
  if (
    !action.effects.some((effect) => effect.type === 'damage' && effect.vengeance !== undefined)
  ) {
    return { action, basis: [] }
  }
  const actorId =
    state.tactical.battle.lifecycle === 'active'
      ? state.tactical.battle.currentTurn?.combatantId
      : undefined
  // Preserve the established inactive-turn legality report rather than inventing a potency source.
  if (!actorId) return { action, basis: [] }
  const round = state.tactical.battle.round
  assertSafeInteger(round, 1, 'current round')
  const firstRound = Math.max(1, round - 2)
  const history = state.effectState?.damageHistory ?? []
  if (!Array.isArray(history)) throw new TypeError('Vengeance history must be an array.')
  const byRound = new Map<number, number>()
  for (const entry of history) {
    if (!entry || typeof entry !== 'object')
      throw new TypeError('Vengeance history contains an invalid row.')
    if (entry.combatantId !== actorId) continue
    assertSafeInteger(entry.round, 1, 'history round')
    if (entry.round < firstRound || entry.round > round) continue
    assertSafeInteger(entry.amount, 0, 'history amount')
    if (byRound.has(entry.round))
      throw new TypeError('Vengeance history must have one row per actor and round.')
    byRound.set(entry.round, entry.amount)
  }
  const damageByRound = Array.from({ length: round - firstRound + 1 }, (_, index) => {
    const entryRound = firstRound + index
    return { round: entryRound, amount: byRound.get(entryRound) ?? 0 }
  })
  // Each row is safe, but the three-row total need not fit a JavaScript number.
  const total = damageByRound.reduce((sum, entry) => sum + BigInt(entry.amount), 0n)
  const basis: CombatVengeanceBasis[] = []
  const effects = action.effects.map((effect, effectOrdinal) => {
    if (effect.type !== 'damage' || effect.vengeance === undefined) return effect
    const { vengeance, ...ordinaryDamage } = effect
    const converted = (total * BigInt(vengeance.conversionBasisPoints)) / 10_000n
    const minimum = BigInt(vengeance.minimumDamage ?? 0)
    const maximum = BigInt(vengeance.maximumDamage)
    const bounded = converted < minimum ? minimum : converted > maximum ? maximum : converted
    const rawDamage = Number(bounded)
    basis.push({
      effectOrdinal,
      sourceCombatantId: actorId,
      windowStartRound: firstRound,
      windowEndRound: round,
      damageByRound,
      rawDamage,
    })
    return { ...ordinaryDamage, amount: rawDamage }
  })
  return { action: { ...action, effects }, basis }
}

function assertSafeInteger(
  value: unknown,
  minimum: number,
  label: string,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`Vengeance ${label} must be a safe integer of at least ${minimum}.`)
  }
}
