import type { AbilityBehavior, AbilityEffect } from '@aurevane/game-core/combat/combat-definition'
import type { CombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import type { CombatEffectTarget } from '@aurevane/game-core/combat/combat-effect-recipients'

type CompanionStatus = 'frozen' | 'wet' | 'conductive' | 'cleanse-chilled'
interface Companion {
  status: CompanionStatus
  recipient: 'actor' | 'primary-unit' | 'affected-units'
  target?: CombatEffectTarget
}
const generatedPrefix = 'element-companion.'
const statusByElement: Readonly<Record<string, CompanionStatus | undefined>> = {
  ice: 'frozen',
  water: 'wet',
  storm: 'conductive',
  fire: 'cleanse-chilled',
}
const key = (value: Companion) => `${value.status}.${value.recipient}`
function requiredCompanions(value: AbilityBehavior): Map<string, Companion> {
  const required = new Map<string, Companion>()
  for (const { payload } of value.effects) {
    if (payload.type !== 'damage' && payload.type !== 'pierce') continue
    const status = statusByElement[payload.element ?? '']
    if (!status) continue
    const next: Companion = {
      status,
      recipient: status === 'cleanse-chilled' ? 'actor' : payload.recipient,
      target: status === 'cleanse-chilled' ? 'self' : payload.target,
    }
    const previous = required.get(key(next))
    if (previous && previous.target !== next.target)
      next.target = previous.target === 'all' || next.target === 'all' ? 'all' : undefined
    required.set(key(next), next)
  }
  return required
}
function matches(effect: AbilityEffect, companion: Companion): boolean {
  const payload = effect.payload
  return (
    payload.recipient === companion.recipient &&
    (companion.status === 'cleanse-chilled'
      ? payload.type === 'remove-status' &&
        payload.statusIds.length === 1 &&
        payload.statusIds[0] === 'frozen'
      : payload.type === 'apply-status' && payload.statusId === companion.status)
  )
}
export function isAuthoredElementalCompanion(effect: AbilityEffect): boolean {
  if (!effect.id.startsWith(generatedPrefix) || effect.requirements) return false
  const status = effect.id.slice(generatedPrefix.length).split('.')[0]
  return matches(effect, {
    status: status as CompanionStatus,
    recipient: effect.payload.recipient as Companion['recipient'],
  })
}
/** An unchanged standard historical counterpart can be recognized only on a deliberate transition.
 * Conditional, customized and duplicate manual tags remain authored data, never cleanup targets. */
function standardCompanion(effect: AbilityEffect, companion: Companion): boolean {
  if (effect.requirements || effect.timing !== undefined || !matches(effect, companion))
    return false
  const payload = effect.payload
  if (payload.type !== 'apply-status' && payload.type !== 'remove-status') return false
  if (
    payload.target !== companion.target &&
    !(companion.status === 'cleanse-chilled' && payload.target === undefined)
  )
    return false
  const allowed = [
    'type',
    'recipient',
    'target',
    ...(companion.status === 'cleanse-chilled'
      ? ['statusIds', 'removalMode', 'selectionKind']
      : ['statusId', 'stacks', 'durationTurns', 'potencyBasisPoints']),
  ]
  if (Object.keys(payload).some((field) => !allowed.includes(field))) return false
  return (
    payload.type === 'remove-status' ||
    (payload.type === 'apply-status' &&
      payload.stacks === 1 &&
      payload.durationTurns === 2 &&
      (companion.status === 'frozen'
        ? payload.potencyBasisPoints === undefined
        : payload.potencyBasisPoints === 2000))
  )
}
function companionPayload(companion: Companion, existing?: CombatTagPayload): CombatTagPayload {
  if (companion.status === 'cleanse-chilled')
    return {
      type: 'remove-status',
      recipient: 'actor',
      target: 'self',
      statusIds: ['frozen'],
      removalMode: 'specified',
    }
  const payload = existing?.type === 'apply-status' ? { ...existing } : {}
  Reflect.deleteProperty(payload, 'target')
  if (companion.status === 'frozen') Reflect.deleteProperty(payload, 'potencyBasisPoints')
  return {
    ...payload,
    type: 'apply-status',
    recipient: companion.recipient,
    statusId: companion.status,
    stacks: existing?.type === 'apply-status' ? existing.stacks : 1,
    durationTurns: existing?.type === 'apply-status' ? (existing.durationTurns ?? 2) : 2,
    ...(companion.status === 'frozen'
      ? {}
      : {
          potencyBasisPoints:
            existing?.type === 'apply-status' ? (existing.potencyBasisPoints ?? 2000) : 2000,
        }),
    ...(companion.target !== undefined ? { target: companion.target } : {}),
  }
}

/** Editor transitions only. Historical definitions and captured commands never call this helper. */
export function withAuthoredElementalCompanions(
  previous: AbilityBehavior,
  next: AbilityBehavior,
  options: { preserveExisting?: boolean } = {},
): AbilityBehavior {
  const required = requiredCompanions(next)
  const before = requiredCompanions(previous)
  let effects = options.preserveExisting
    ? [...next.effects]
    : next.effects.filter((effect) => {
        if (isAuthoredElementalCompanion(effect))
          return [...required.values()].some((companion) => matches(effect, companion))
        for (const [oldKey, companion] of before) {
          if (required.has(oldKey) || !matches(effect, companion)) continue
          const counterparts = previous.effects.filter((candidate) => matches(candidate, companion))
          if (
            counterparts.length === 1 &&
            standardCompanion(counterparts[0]!, companion) &&
            JSON.stringify(counterparts[0]) === JSON.stringify(effect)
          )
            return false
        }
        return true
      })
  for (const companion of required.values()) {
    const counterparts = effects.filter((effect) => matches(effect, companion))
    const manual = counterparts.filter((effect) => !isAuthoredElementalCompanion(effect))
    if (manual.length) {
      if (options.preserveExisting) continue
      // Authored conflicts remain visible to the strict validator. Never erase a manual predicate.
      effects = effects.filter(
        (effect) => !isAuthoredElementalCompanion(effect) || !matches(effect, companion),
      )
      const prior = before.get(key(companion))
      if (
        manual.length === 1 &&
        prior &&
        standardCompanion(manual[0]!, prior) &&
        (prior.target !== companion.target ||
          (manual[0]!.payload.type === 'remove-status' &&
            manual[0]!.payload.removalMode !== 'specified'))
      )
        effects = effects.map((effect) =>
          effect === manual[0]
            ? { ...effect, payload: companionPayload(companion, effect.payload) }
            : effect,
        )
      continue
    }
    const existing = counterparts[0]
    if (existing) {
      if (options.preserveExisting) continue
      const payload = companionPayload(companion, existing.payload)
      if (JSON.stringify(payload) !== JSON.stringify(existing.payload))
        effects = effects.map((effect) => (effect === existing ? { ...effect, payload } : effect))
      continue
    }
    const prefix = `${generatedPrefix}${key(companion)}`
    let id = prefix
    for (let index = 1; effects.some((effect) => effect.id === id); index++)
      id = `${prefix}.${index}`
    effects = [...effects, { id, payload: companionPayload(companion) }]
  }
  return effects.length === next.effects.length &&
    effects.every((effect, index) => effect === next.effects[index])
    ? next
    : { ...next, effects }
}
