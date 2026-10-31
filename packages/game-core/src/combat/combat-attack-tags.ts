import type {
  CombatActionDefinition,
  CombatContentCatalog,
  CombatEffectDefinition,
  CombatEncounterState,
} from './actions'
import { currentBleedStacks, currentBurnInstances, currentPoisonInstances } from './combat-dots'
import { hasCombatReversalStrain } from './combat-reversal'

export type CombatAttackTag =
  | { readonly type: 'weak-point'; readonly recipient: 'actor'; readonly debuffThreshold: number }
  | { readonly type: 'spike'; readonly recipient: 'actor' }
  | {
      readonly type: 'ruin'
      readonly recipient: 'actor'
      readonly bonusPerDebuffBasisPoints: number
    }

/** Private committed damage metadata. It is never accepted as canonical authoring or projected. */
export interface CombatAttackTagCapture {
  readonly weakPointDebuffThreshold?: number
  readonly spike?: true
  readonly ruinBonusPerDebuffBasisPoints?: number
  readonly capturedDebuffs: Readonly<Record<string, number>>
  /** Omitted entries retain the historical unconditional gate; empty lists block that tag. */
  readonly eligibleRecipients?: Readonly<
    Partial<Record<CombatAttackTag['type'], readonly string[]>>
  >
}
export function isAttackTag(effect: { readonly type: string }): effect is CombatAttackTag {
  return ['weak-point', 'spike', 'ruin'].includes(effect.type)
}
export function validateAttackTag(effect: CombatEffectDefinition): void {
  if (!isAttackTag(effect)) return
  const extra = effect as CombatEffectDefinition
  if (
    effect.recipient !== 'actor' ||
    extra.target !== undefined ||
    extra.durationTurns !== undefined ||
    extra.power !== undefined ||
    extra.potencyBasisPoints !== undefined
  )
    throw new TypeError(
      'Attack annotations modify the containing Damage and have no target or duration.',
    )
  if (
    effect.type === 'weak-point' &&
    (!Number.isSafeInteger(effect.debuffThreshold) || effect.debuffThreshold < 0)
  )
    throw new TypeError('Weak Point threshold must be a nonnegative safe integer.')
  if (
    effect.type === 'ruin' &&
    (!Number.isSafeInteger(effect.bonusPerDebuffBasisPoints) ||
      effect.bonusPerDebuffBasisPoints < 1)
  )
    throw new TypeError('Ruin percentage must be a positive safe integer.')
}
export function validateAttackTagAction(action: Pick<CombatActionDefinition, 'effects'>): void {
  for (const effect of action.effects)
    if (effect.type === 'damage' && effect.attackTagCapture !== undefined)
      validateAttackTagCapture(effect.attackTagCapture)
  const tags = action.effects.filter(isAttackTag)
  for (const tag of tags) validateAttackTag(tag)
  if (
    tags.length &&
    !action.effects.some((effect) => effect.type === 'damage' && !effect.vengeance)
  )
    throw new TypeError('Attack annotations require an ordinary Damage effect.')
  if (new Set(tags.map((tag) => tag.type)).size !== tags.length)
    throw new TypeError('Use each attack annotation once per behavior.')
}
function countActiveTargetDebuffs(
  state: CombatEncounterState,
  targetId: string,
  content: CombatContentCatalog,
): number {
  const ids = new Set<string>()
  for (const status of state.statusState.find((row) => row.combatantId === targetId)?.statuses ??
    []) {
    if (
      status.timingState === 'pending' ||
      status.stacks <= 0 ||
      status.remainingOwnerTurnStarts <= 0
    )
      continue
    const definition = content.statuses.find(
      (row) => row.id === status.statusId && row.version === status.statusVersion,
    )
    if (!definition)
      throw new TypeError('Active debuff counting requires its pinned status definition.')
    if (definition.polarity === 'negative') ids.add(status.statusId)
  }
  if (
    currentPoisonInstances(state, targetId).some(
      (row) => row.remainingTicks === undefined || row.remainingTicks > 0,
    )
  )
    ids.add('poison')
  if (
    currentBurnInstances(state, targetId).some(
      (row) => row.remainingTicks === undefined || row.remainingTicks > 0,
    )
  )
    ids.add('burn')
  if (currentBleedStacks(state, targetId).some((row) => row.remainingTicks > 0)) ids.add('bleed')
  if (hasCombatReversalStrain(state, targetId)) ids.add('reversal-strain')
  return ids.size
}
export function captureAttackTagDamage<
  T extends Pick<CombatActionDefinition, 'effects' | 'effectEligibleRecipientIds'>,
>(
  state: CombatEncounterState,
  action: T,
  content: CombatContentCatalog,
  recapture = false,
  executionActorId = state.tactical.battle.currentTurn?.combatantId,
): T {
  validateAttackTagAction(action)
  const tags = action.effects.flatMap((effect, ordinal) =>
    isAttackTag(effect) ? [{ effect, eligible: action.effectEligibleRecipientIds?.[ordinal] }] : [],
  )
  if (!tags.length && !recapture) return action
  const rules = tags.length
    ? ({
        ...tags.reduce(
          (rules, { effect: tag }) => ({
            ...rules,
            ...(tag.type === 'weak-point'
              ? { weakPointDebuffThreshold: tag.debuffThreshold }
              : tag.type === 'spike'
                ? { spike: true as const }
                : { ruinBonusPerDebuffBasisPoints: tag.bonusPerDebuffBasisPoints }),
          }),
          {},
        ),
        ...(tags.some(({ eligible }) => eligible !== undefined)
          ? {
              eligibleRecipients: Object.fromEntries(
                tags.flatMap(({ effect, eligible }) =>
                  eligible === undefined ||
                  (executionActorId !== undefined && eligible.includes(executionActorId))
                    ? []
                    : [[effect.type, [...eligible]]],
                ),
              ),
            }
          : {}),
        capturedDebuffs: Object.fromEntries(
          state.tactical.battle.combatants.map((unit) => [
            unit.id,
            countActiveTargetDebuffs(state, unit.id, content),
          ]),
        ),
      } as CombatAttackTagCapture)
    : undefined
  return {
    ...action,
    effects: action.effects.map((effect) => {
      if (effect.type !== 'damage' || effect.vengeance) return effect
      const capture = rules ?? effect.attackTagCapture
      if (!capture) return effect
      return {
        ...effect,
        attackTagCapture: recapture
          ? {
              ...capture,
              capturedDebuffs: Object.fromEntries(
                state.tactical.battle.combatants.map((unit) => [
                  unit.id,
                  countActiveTargetDebuffs(state, unit.id, content),
                ]),
              ),
            }
          : capture,
      }
    }),
  }
}
function annotationEligible(
  capture: CombatAttackTagCapture,
  type: CombatAttackTag['type'],
  targetId: string,
): boolean {
  const ids = capture.eligibleRecipients?.[type]
  return ids === undefined || ids.includes(targetId)
}
export function hasWeakPointCritical(
  effect: { readonly attackTagCapture?: CombatAttackTagCapture },
  targetId: string,
): boolean {
  const capture = effect.attackTagCapture
  return (
    capture?.weakPointDebuffThreshold !== undefined &&
    annotationEligible(capture, 'weak-point', targetId) &&
    (capture.capturedDebuffs[targetId] ?? 0) > capture.weakPointDebuffThreshold
  )
}
export function applyAttackTagDamage(
  amount: number,
  effect: { readonly attackTagCapture?: CombatAttackTagCapture },
  targetId: string,
  critical: boolean,
): number {
  const capture = effect.attackTagCapture
  if (!capture) return amount
  const count = BigInt(capture.capturedDebuffs[targetId] ?? 0)
  let damage =
    (BigInt(amount) *
      (10000n +
        count *
          BigInt(
            annotationEligible(capture, 'ruin', targetId)
              ? (capture.ruinBonusPerDebuffBasisPoints ?? 0)
              : 0,
          ))) /
    10000n
  if (critical && capture.spike && annotationEligible(capture, 'spike', targetId)) damage *= 2n
  if (damage > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError('Attack annotation damage exceeds the safe integer range.')
  return Number(damage)
}
export function attackTagDescription(effect: CombatAttackTag): string {
  if (effect.type === 'weak-point')
    return `Damage is guaranteed to be critical against an enemy with more than ${effect.debuffThreshold} active debuffs when the attack is committed. The attack must still hit.`
  if (effect.type === 'spike')
    return 'Doubles the complete damage of critical hits. Ordinary hits are unchanged.'
  return `Increases Damage by ${effect.bonusPerDebuffBasisPoints / 100}% per active debuff on the enemy when the attack is committed.`
}

function validateAttackTagCapture(value: CombatAttackTagCapture): void {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) =>
        ![
          'weakPointDebuffThreshold',
          'spike',
          'ruinBonusPerDebuffBasisPoints',
          'capturedDebuffs',
          'eligibleRecipients',
        ].includes(key),
    ) ||
    !value.capturedDebuffs ||
    typeof value.capturedDebuffs !== 'object' ||
    Array.isArray(value.capturedDebuffs) ||
    Object.entries(value.capturedDebuffs).some(
      ([id, count]) => !id.trim() || !Number.isSafeInteger(count) || count < 0,
    )
  )
    throw new TypeError('Invalid committed attack annotation capture.')
  if (
    value.eligibleRecipients !== undefined &&
    (!value.eligibleRecipients ||
      typeof value.eligibleRecipients !== 'object' ||
      Array.isArray(value.eligibleRecipients) ||
      Object.entries(value.eligibleRecipients).some(
        ([type, ids]) =>
          !['weak-point', 'spike', 'ruin'].includes(type) ||
          !Array.isArray(ids) ||
          new Set(ids).size !== ids.length ||
          ids.some((id: unknown) => typeof id !== 'string' || !id.trim()),
      ))
  )
    throw new TypeError('Invalid committed attack annotation eligibility.')
  if (
    value.weakPointDebuffThreshold !== undefined &&
    (!Number.isSafeInteger(value.weakPointDebuffThreshold) || value.weakPointDebuffThreshold < 0)
  )
    throw new TypeError('Invalid committed Weak Point threshold.')
  if (value.spike !== undefined && value.spike !== true)
    throw new TypeError('Invalid committed Spike rule.')
  if (
    value.ruinBonusPerDebuffBasisPoints !== undefined &&
    (!Number.isSafeInteger(value.ruinBonusPerDebuffBasisPoints) ||
      value.ruinBonusPerDebuffBasisPoints < 1)
  )
    throw new TypeError('Invalid committed Ruin percentage.')
}
