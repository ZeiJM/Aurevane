from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    actual = text.count(old)
    assert actual == count, (path, old[:180], actual, count)
    file.write_text(text.replace(old, new))


state = 'packages/game-core/src/combat/combat-effect-state.ts'
replace(
    state,
    """export interface CombatBleedStack {
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  damagePerTick: number
  remainingTicks: number
  applicationOrder: number
  provenance?: CombatEffectInstanceProvenance
}""",
    """export interface CombatBleedStack {
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  damagePerTick: number
  remainingTicks: number
  applicationOrder: number
  /** Explicit current Curse eligibility; omitted historical Bleed remains non-copyable. */
  curseCopyable?: boolean
  provenance?: CombatEffectInstanceProvenance
}""",
)

dots = 'packages/game-core/src/combat/combat-dots.ts'
replace(
    dots,
    """export function validateCurrentBleedEffect(effect: { damagePerTick: number; ticks: number }): void {
  if (!Number.isSafeInteger(effect.damagePerTick) || effect.damagePerTick <= 0) {""",
    """export function validateCurrentBleedEffect(effect: {
  damagePerTick: number
  ticks: number
  curseCopyable?: unknown
}): void {
  if (effect.curseCopyable !== undefined && typeof effect.curseCopyable !== 'boolean') {
    throw new TypeError('Bleed curseCopyable must be boolean when supplied.')
  }
  if (!Number.isSafeInteger(effect.damagePerTick) || effect.damagePerTick <= 0) {""",
)
replace(
    dots,
    """  sourceActionId: string,
  damagePerTick: number,
  ticks: number,
): CombatEncounterState {
  validateCurrentBleedEffect({ damagePerTick, ticks })""",
    """  sourceActionId: string,
  damagePerTick: number,
  ticks: number,
  curseCopyable?: boolean,
): CombatEncounterState {
  validateCurrentBleedEffect({ damagePerTick, ticks, curseCopyable })""",
)
replace(
    dots,
    """    damagePerTick,
    remainingTicks: ticks,
    applicationOrder,
  })""",
    """    damagePerTick,
    remainingTicks: ticks,
    applicationOrder,
    ...(curseCopyable !== undefined ? { curseCopyable } : {}),
  })""",
    1,
)
replace(
    dots,
    """      stack.sourceActionId.length === 0 ||
      stack.sourceActionId.trim() !== stack.sourceActionId ||
      !rawTotalValid ||""",
    """      stack.sourceActionId.length === 0 ||
      stack.sourceActionId.trim() !== stack.sourceActionId ||
      (stack.curseCopyable !== undefined && typeof stack.curseCopyable !== 'boolean') ||
      !rawTotalValid ||""",
)
replace(
    dots,
    """          message:
            'Bleed state must contain at most three valid independent stacks per target in stable application order, each with one to four remaining ticks and no more than 10 raw remaining damage.',""",
    """          message:
            'Bleed state must contain at most three valid independent stacks per target in stable application order, each with one to four remaining ticks, no more than 10 raw remaining damage, and optional boolean copy policy.',""",
)

legacy = 'packages/game-core/src/combat/actions-legacy.ts'
replace(
    legacy,
    """  | {
      type: 'bleed'
      recipient: CombatEffectRecipient
      damagePerTick: number
      ticks: number
    }""",
    """  | {
      type: 'bleed'
      recipient: CombatEffectRecipient
      damagePerTick: number
      ticks: number
      curseCopyable?: boolean
    }""",
)
replace(
    legacy,
    """        actionId,
        effect.damagePerTick,
        effect.ticks,
      ),""",
    """        actionId,
        effect.damagePerTick,
        effect.ticks,
        effect.curseCopyable,
      ),""",
    1,
)
replace(
    legacy,
    "return plan.copies.length === 0 && !plan.poison && !plan.burn",
    "return plan.copies.length === 0 && !plan.poison && !plan.burn && plan.bleed.length === 0",
)

copy = 'packages/game-core/src/combat/combat-status-copy.ts'
replace(
    copy,
    "import { currentBurnInstance, currentPoisonInstance } from './combat-dots'",
    """import {
  applyCurrentBleedState,
  currentBleedStacks,
  currentBurnInstance,
  currentPoisonInstance,
} from './combat-dots'""",
)
replace(
    copy,
    """  normalizeCombatEffectState,
  type CombatBurnInstance,
  type CombatPoisonInstance,""",
    """  normalizeCombatEffectState,
  type CombatBleedStack,
  type CombatBurnInstance,
  type CombatPoisonInstance,""",
)
replace(
    copy,
    """interface BurnCopy {
  donor: CombatBurnInstance
  previous: CombatBurnInstance | undefined
}

interface CombatCopyPlan {
  receiverId: string
  copies: readonly StatusCopy[]
  poison: PoisonCopy | undefined
  burn: BurnCopy | undefined
}""",
    """interface BurnCopy {
  donor: CombatBurnInstance
  previous: CombatBurnInstance | undefined
}

interface BleedCopy {
  donor: CombatBleedStack
  previous: CombatBleedStack | undefined
  replacedSummary: string | undefined
  applicationOrder: number
  attemptIndex: number
  survives: boolean
}

interface SimulatedBleedRow {
  targetCombatantId: string
  damagePerTick: number
  remainingTicks: number
  applicationOrder: number
  existing?: CombatBleedStack
  attemptIndex?: number
}

function planBleedCopies(
  state: CombatEncounterState,
  donorId: string,
  receiverId: string,
  mode: CombatStatusCopyEffect['mode'],
): readonly BleedCopy[] {
  if (mode !== 'curse') return []
  const donors = currentBleedStacks(state, donorId).filter((stack) => stack.curseCopyable === true)
  if (donors.length === 0) return []

  const effectState = normalizeCombatEffectState(state.effectState)
  let maximumOrder = effectState.bleed.reduce(
    (maximum, stack) => Math.max(maximum, stack.applicationOrder),
    0,
  )
  let simulated: SimulatedBleedRow[] = effectState.bleed.map((stack) => ({
    targetCombatantId: stack.targetCombatantId,
    damagePerTick: stack.damagePerTick,
    remainingTicks: stack.remainingTicks,
    applicationOrder: stack.applicationOrder,
    existing: stack,
  }))
  const attempts: Omit<BleedCopy, 'survives'>[] = []

  donors.forEach((donor, attemptIndex) => {
    if (maximumOrder >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Bleed application order has reached the safe integer limit.')
    }
    const targetRows = simulated
      .filter((row) => row.targetCombatantId === receiverId)
      .sort(
        (left, right) =>
          left.remainingTicks - right.remainingTicks ||
          left.applicationOrder - right.applicationOrder,
      )
    const replaced = targetRows.length >= 3 ? targetRows[0] : undefined
    if (replaced) {
      simulated = simulated.filter(
        (row) =>
          row.targetCombatantId !== replaced.targetCombatantId ||
          row.applicationOrder !== replaced.applicationOrder,
      )
    }
    maximumOrder += 1
    const applicationOrder = maximumOrder
    simulated.push({
      targetCombatantId: receiverId,
      damagePerTick: donor.damagePerTick,
      remainingTicks: donor.remainingTicks,
      applicationOrder,
      attemptIndex,
    })
    attempts.push({
      donor,
      previous: replaced?.existing,
      replacedSummary: replaced
        ? `bleed:${replaced.damagePerTick}:${replaced.remainingTicks}`
        : undefined,
      applicationOrder,
      attemptIndex,
    })
  })

  const survivingOrders = new Set(
    simulated
      .filter((row) => row.targetCombatantId === receiverId && row.attemptIndex !== undefined)
      .map((row) => row.applicationOrder),
  )
  return attempts.map((attempt) => ({
    ...attempt,
    survives: survivingOrders.has(attempt.applicationOrder),
  }))
}

interface CombatCopyPlan {
  receiverId: string
  copies: readonly StatusCopy[]
  poison: PoisonCopy | undefined
  burn: BurnCopy | undefined
  bleed: readonly BleedCopy[]
}""",
)
replace(
    copy,
    """  if (donorId === receiverId) return { receiverId, copies: [], poison: undefined, burn: undefined }""",
    """  if (donorId === receiverId)
    return { receiverId, copies: [], poison: undefined, burn: undefined, bleed: [] }""",
)
replace(
    copy,
    """  const burn =
    donorBurn?.curseCopyable === true
      ? { donor: donorBurn, previous: currentBurnInstance(state, receiverId) ?? undefined }
      : undefined
  return { receiverId, copies, poison, burn }""",
    """  const burn =
    donorBurn?.curseCopyable === true
      ? { donor: donorBurn, previous: currentBurnInstance(state, receiverId) ?? undefined }
      : undefined
  const bleed = planBleedCopies(state, donorId, receiverId, effect.mode)
  return { receiverId, copies, poison, burn, bleed }""",
)
replace(
    copy,
    """  const { receiverId, copies, poison, burn } = planCombatStatusCopies(
    state,
    actorId,
    selectedId,
    effect,
    content,
  )
  if (copies.length === 0 && !poison && !burn)
    throw new Error('Status copying requires eligible active statuses.')""",
    """  const { receiverId, copies, poison, burn, bleed } = planCombatStatusCopies(
    state,
    actorId,
    selectedId,
    effect,
    content,
  )
  if (copies.length === 0 && !poison && !burn && bleed.length === 0)
    throw new Error('Status copying requires eligible active statuses.')""",
    1,
)
replace(
    copy,
    """  return {
    state: { ...state, statusState, effectState: nextEffectState },
    events: copies.map(({ previous, next }) => ({""",
    """  let copiedState: CombatEncounterState = { ...state, statusState, effectState: nextEffectState }
  for (const attempt of bleed) {
    copiedState = applyCurrentBleedState(
      copiedState,
      actorId,
      receiverId,
      actionId,
      attempt.donor.damagePerTick,
      attempt.donor.remainingTicks,
      true,
    )
  }
  return {
    state: copiedState,
    events: copies.map(({ previous, next }) => ({""",
)
replace(
    copy,
    """      ...(nextBurn
        ? [
            {
              effectType: 'copy-statuses' as const,
              combatantId: receiverId,
              before: burn?.previous ? `burn:${burn.previous.stage}` : 'none',
              after: `burn:${nextBurn.stage}`,
            },
          ]
        : []),
    ],""",
    """      ...(nextBurn
        ? [
            {
              effectType: 'copy-statuses' as const,
              combatantId: receiverId,
              before: burn?.previous ? `burn:${burn.previous.stage}` : 'none',
              after: `burn:${nextBurn.stage}`,
            },
          ]
        : []),
      ...bleed.map((attempt) => ({
        effectType: 'copy-statuses' as const,
        combatantId: receiverId,
        before: attempt.replacedSummary ?? 'none',
        after: `bleed:${attempt.donor.damagePerTick}:${attempt.donor.remainingTicks}`,
      })),
    ],""",
)
replace(
    copy,
    """  const { receiverId, copies, poison, burn } = planCombatStatusCopies(
    before,
    actorId,
    selectedId,
    effect,
    content,
  )""",
    """  const { receiverId, copies, poison, burn, bleed } = planCombatStatusCopies(
    before,
    actorId,
    selectedId,
    effect,
    content,
  )""",
)
replace(
    copy,
    "  if (!poison && !burn) return { ...after, statusState }",
    "  if (!poison && !burn && bleed.length === 0) return { ...after, statusState }",
)
replace(
    copy,
    """  const effectState = normalizeCombatEffectState(after.effectState)
  return {
    ...after,
    statusState,
    effectState: {
      ...effectState,
      poison: poisonProvenance
        ? effectState.poison.map((entry) =>
            entry.targetCombatantId === receiverId && entry.sourceCombatantId === actorId
              ? { ...entry, provenance: poisonProvenance }
              : entry,
          )
        : effectState.poison,
      burn: burnProvenance
        ? effectState.burn.map((entry) =>
            entry.targetCombatantId === receiverId && entry.sourceCombatantId === actorId
              ? { ...entry, provenance: burnProvenance }
              : entry,
          )
        : effectState.burn,
    },
  }""",
    """  const bleedBaseOrdinal = copies.length + (poison ? 1 : 0) + (burn ? 1 : 0)
  const survivingBleed = new Map(
    bleed
      .filter((attempt) => attempt.survives)
      .map((attempt) => [attempt.applicationOrder, attempt] as const),
  )
  const effectState = normalizeCombatEffectState(after.effectState)
  return {
    ...after,
    statusState,
    effectState: {
      ...effectState,
      poison: poisonProvenance
        ? effectState.poison.map((entry) =>
            entry.targetCombatantId === receiverId && entry.sourceCombatantId === actorId
              ? { ...entry, provenance: poisonProvenance }
              : entry,
          )
        : effectState.poison,
      burn: burnProvenance
        ? effectState.burn.map((entry) =>
            entry.targetCombatantId === receiverId && entry.sourceCombatantId === actorId
              ? { ...entry, provenance: burnProvenance }
              : entry,
          )
        : effectState.burn,
      bleed:
        survivingBleed.size > 0
          ? effectState.bleed.map((entry) => {
              const assigned = survivingBleed.get(entry.applicationOrder)
              if (
                !assigned ||
                entry.targetCombatantId !== receiverId ||
                entry.sourceCombatantId !== actorId
              )
                return entry
              const provenance = createCombatEffectInstanceProvenance({
                action: context.provenance,
                targetCombatantId: receiverId,
                effectOrdinal: 0,
                copyOrdinal: bleedBaseOrdinal + assigned.attemptIndex,
                createdRound: before.tactical.battle.round,
                createdTurn: before.tactical.battle.turnNumber,
                copiedFromInstanceId: assigned.donor.provenance?.instanceId,
                inheritedFromInstanceId: assigned.previous?.provenance?.instanceId,
              })
              return { ...entry, provenance }
            })
          : effectState.bleed,
    },
  }""",
)

docs = Path('docs/COMBAT.md')
docs.write_text(
    docs.read_text().rstrip()
    + '''

## Curse Bleed copy state (staged typed-effect extension)

Current Bleed authoring may explicitly set `curseCopyable: true | false` per independent stack.
The optional policy persists with that stack; omitted historical Bleed remains valid and non-copyable,
and malformed authoring or saved values fail closed.

A pure single-unit Curse copies every explicitly eligible donor Bleed stack in stable donor
application order while leaving the donor unchanged. Each copy preserves the donor's current damage
per tick and remaining ticks, rebinds source combatant/action to Curse, and is explicitly copyable.
Each receiver insertion uses the existing canonical maximum-three-stack rule: when full, replace the
fewest-remaining stack and break ties by oldest application order. Because copies are inserted
sequentially, a later donor may replace an earlier same-command copy. Copying itself causes no damage;
normal independent end-turn ticks, expiry and Cleanse continue afterward.

K3 reserves Bleed copy ordinals after ordinary statuses, Poison and Burn, one ordinal for every
eligible donor attempt in donor order even when an attempted copy is later replaced. Final surviving
rows link to their immediate donor through `copiedFromInstanceId`; `inheritedFromInstanceId` is used
only when the replaced receiver row actually carried provenance at insertion time, never for an
unpersisted same-command transient copy. Amplify does not copy Bleed in this slice. Repeat-use,
publication, AI and broader composition remain separate gates; no published Skill is activated.
'''
)
