from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    actual = text.count(old)
    assert actual == count, (path, old[:120], actual, count)
    file.write_text(text.replace(old, new))


state = 'packages/game-core/src/combat/combat-effect-state.ts'
replace(
    state,
    """export interface CombatBurnInstance {
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  profileVersion: number
  stage: number
  provenance?: CombatEffectInstanceProvenance
}""",
    """export interface CombatBurnInstance {
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  profileVersion: number
  stage: number
  /** Explicit current Curse eligibility; omitted historical Burn remains non-copyable. */
  curseCopyable?: boolean
  provenance?: CombatEffectInstanceProvenance
}""",
)

dots = 'packages/game-core/src/combat/combat-dots.ts'
replace(
    dots,
    """export interface CurrentBurnEffect {
  type: 'burn'
  recipient: CombatEffectRecipient
}""",
    """export interface CurrentBurnEffect {
  type: 'burn'
  recipient: CombatEffectRecipient
  curseCopyable?: boolean
}

export function validateCurrentBurnEffect(effect: { curseCopyable?: unknown }): void {
  if (effect.curseCopyable !== undefined && typeof effect.curseCopyable !== 'boolean') {
    throw new TypeError('Burn curseCopyable must be boolean when supplied.')
  }
}""",
)
replace(
    dots,
    """export function applyCurrentBurnState(
  state: CombatEncounterState,
  sourceCombatantId: string,
  targetCombatantId: string,
  sourceActionId: string,
): CombatEncounterState {""",
    """export function applyCurrentBurnState(
  state: CombatEncounterState,
  sourceCombatantId: string,
  targetCombatantId: string,
  sourceActionId: string,
  curseCopyable?: boolean,
): CombatEncounterState {""",
)
replace(
    dots,
    """  sourceActionId: string,
  curseCopyable?: boolean,
): CombatEncounterState {
  const effectState = normalizeCombatEffectState(state.effectState)
  const nextInstance: CombatBurnInstance = {""",
    """  sourceActionId: string,
  curseCopyable?: boolean,
): CombatEncounterState {
  validateCurrentBurnEffect({ curseCopyable })
  const effectState = normalizeCombatEffectState(state.effectState)
  const nextInstance: CombatBurnInstance = {""",
)
replace(
    dots,
    """    profileVersion: CURRENT_BURN_PROFILE_VERSION,
    stage: 0,
  }""",
    """    profileVersion: CURRENT_BURN_PROFILE_VERSION,
    stage: 0,
    ...(curseCopyable !== undefined ? { curseCopyable } : {}),
  }""",
    1,
)
replace(
    dots,
    """      instance.profileVersion !== CURRENT_BURN_PROFILE_VERSION ||
      !Number.isSafeInteger(instance.stage) ||""",
    """      instance.profileVersion !== CURRENT_BURN_PROFILE_VERSION ||
      (instance.curseCopyable !== undefined && typeof instance.curseCopyable !== 'boolean') ||
      !Number.isSafeInteger(instance.stage) ||""",
    1,
)
replace(
    dots,
    """          message:
            'Burn state must contain one valid current-profile stage from 0 to 2 per target, sorted by target ID.',""",
    """          message:
            'Burn state must contain one valid current-profile stage from 0 to 2 per target, sorted by target ID, with optional boolean copy policy.',""",
    1,
)

legacy = 'packages/game-core/src/combat/actions-legacy.ts'
replace(
    legacy,
    """  validateCombatDotState,
  validateCurrentBleedEffect,
  validateCurrentPoisonEffect,""",
    """  validateCombatDotState,
  validateCurrentBleedEffect,
  validateCurrentBurnEffect,
  validateCurrentPoisonEffect,""",
)
replace(
    legacy,
    "  | { type: 'burn'; recipient: CombatEffectRecipient }",
    "  | { type: 'burn'; recipient: CombatEffectRecipient; curseCopyable?: boolean }",
)
replace(
    legacy,
    "      state: applyCurrentBurnState(state, actorId, recipientId, actionId),",
    """      state: applyCurrentBurnState(
        state,
        actorId,
        recipientId,
        actionId,
        effect.curseCopyable,
      ),""",
)
replace(
    legacy,
    "    if (effect.type === 'poison') validateCurrentPoisonEffect(effect)",
    "    if (effect.type === 'poison') validateCurrentPoisonEffect(effect)\n    if (effect.type === 'burn') validateCurrentBurnEffect(effect)",
    1,
)

validation = 'packages/game-core/src/combat/combat-authoring-validation.ts'
replace(
    validation,
    "import { validateCurrentBleedEffect, validateCurrentPoisonEffect } from './combat-dots'",
    "import { validateCurrentBleedEffect, validateCurrentBurnEffect, validateCurrentPoisonEffect } from './combat-dots'",
)
replace(
    validation,
    "    if (effect.type === 'poison') validateCurrentPoisonEffect(effect)",
    "    if (effect.type === 'poison') validateCurrentPoisonEffect(effect)\n    if (effect.type === 'burn') validateCurrentBurnEffect(effect)",
)

copy = 'packages/game-core/src/combat/combat-status-copy.ts'
replace(
    copy,
    "import { currentPoisonInstance } from './combat-dots'",
    "import { currentBurnInstance, currentPoisonInstance } from './combat-dots'",
)
replace(
    copy,
    "import { normalizeCombatEffectState, type CombatPoisonInstance } from './combat-effect-state'",
    "import { normalizeCombatEffectState, type CombatBurnInstance, type CombatPoisonInstance } from './combat-effect-state'",
)
replace(
    copy,
    """interface CombatCopyPlan {
  receiverId: string
  copies: readonly StatusCopy[]
  poison: PoisonCopy | undefined
}""",
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
)
replace(
    copy,
    "  if (donorId === receiverId) return { receiverId, copies: [], poison: undefined }",
    "  if (donorId === receiverId) return { receiverId, copies: [], poison: undefined, burn: undefined }",
)
replace(
    copy,
    """  const poison = donorPoison?.curseCopyable === true
    ? { donor: donorPoison, previous: currentPoisonInstance(state, receiverId) ?? undefined }
    : undefined
  return { receiverId, copies, poison }""",
    """  const poison = donorPoison?.curseCopyable === true
    ? { donor: donorPoison, previous: currentPoisonInstance(state, receiverId) ?? undefined }
    : undefined
  const donorBurn = effect.mode === 'curse' ? currentBurnInstance(state, donorId) : null
  const burn = donorBurn?.curseCopyable === true
    ? { donor: donorBurn, previous: currentBurnInstance(state, receiverId) ?? undefined }
    : undefined
  return { receiverId, copies, poison, burn }""",
)
replace(
    copy,
    """  const { receiverId, copies, poison } = planCombatStatusCopies(
    state,
    actorId,
    selectedId,
    effect,
    content,
  )
  if (copies.length === 0 && !poison)
    throw new Error('Status copying requires eligible active statuses.')""",
    """  const { receiverId, copies, poison, burn } = planCombatStatusCopies(
    state,
    actorId,
    selectedId,
    effect,
    content,
  )
  if (copies.length === 0 && !poison && !burn)
    throw new Error('Status copying requires eligible active statuses.')""",
)
replace(
    copy,
    """  const effectState = nextPoison ? normalizeCombatEffectState(state.effectState) : undefined
  const nextEffectState =
    nextPoison && effectState
      ? {
          ...effectState,
          poison: [
            ...effectState.poison.filter((entry) => entry.targetCombatantId !== receiverId),
            nextPoison,
          ].sort((left, right) => left.targetCombatantId.localeCompare(right.targetCombatantId)),
        }
      : state.effectState""",
    """  const nextBurn = burn
    ? {
        targetCombatantId: receiverId,
        sourceCombatantId: actorId,
        sourceActionId: actionId,
        profileVersion: burn.donor.profileVersion,
        stage: burn.previous ? 0 : burn.donor.stage,
        curseCopyable: true as const,
      }
    : undefined
  const effectState = nextPoison || nextBurn ? normalizeCombatEffectState(state.effectState) : undefined
  const nextEffectState = effectState
    ? {
        ...effectState,
        ...(nextPoison
          ? {
              poison: [
                ...effectState.poison.filter((entry) => entry.targetCombatantId !== receiverId),
                nextPoison,
              ].sort((left, right) => left.targetCombatantId.localeCompare(right.targetCombatantId)),
            }
          : {}),
        ...(nextBurn
          ? {
              burn: [
                ...effectState.burn.filter((entry) => entry.targetCombatantId !== receiverId),
                nextBurn,
              ].sort((left, right) => left.targetCombatantId.localeCompare(right.targetCombatantId)),
            }
          : {}),
      }
    : state.effectState""",
)
replace(
    copy,
    """      ...(nextPoison
        ? [
            {
              effectType: 'copy-statuses' as const,
              combatantId: receiverId,
              before: poison?.previous ? `poison:${poison.previous.movementRemainder}` : 'none',
              after: `poison:${nextPoison.movementRemainder}`,
            },
          ]
        : []),
    ],""",
    """      ...(nextPoison
        ? [
            {
              effectType: 'copy-statuses' as const,
              combatantId: receiverId,
              before: poison?.previous ? `poison:${poison.previous.movementRemainder}` : 'none',
              after: `poison:${nextPoison.movementRemainder}`,
            },
          ]
        : []),
      ...(nextBurn
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
)
replace(
    copy,
    "  const { receiverId, copies, poison } = planCombatStatusCopies(",
    "  const { receiverId, copies, poison, burn } = planCombatStatusCopies(",
)
replace(
    copy,
    """  if (!poison) return { ...after, statusState }
  const provenance = createCombatEffectInstanceProvenance({""",
    """  if (!poison && !burn) return { ...after, statusState }
  const poisonProvenance = poison ? createCombatEffectInstanceProvenance({""",
)
replace(
    copy,
    """    copyOrdinal: copies.length,
    createdRound: before.tactical.battle.round,
    createdTurn: before.tactical.battle.turnNumber,
    copiedFromInstanceId: poison.donor.provenance?.instanceId,
    inheritedFromInstanceId: poison.previous?.provenance?.instanceId,
  })
  const effectState = normalizeCombatEffectState(after.effectState)
  return {
    ...after,
    statusState,
    effectState: {
      ...effectState,
      poison: effectState.poison.map((entry) =>
        entry.targetCombatantId === receiverId && entry.sourceCombatantId === actorId
          ? { ...entry, provenance }
          : entry,
      ),
    },
  }""",
    """    copyOrdinal: copies.length,
    createdRound: before.tactical.battle.round,
    createdTurn: before.tactical.battle.turnNumber,
    copiedFromInstanceId: poison.donor.provenance?.instanceId,
    inheritedFromInstanceId: poison.previous?.provenance?.instanceId,
  }) : undefined
  const burnProvenance = burn ? createCombatEffectInstanceProvenance({
    action: context.provenance,
    targetCombatantId: receiverId,
    effectOrdinal: 0,
    copyOrdinal: copies.length + (poison ? 1 : 0),
    createdRound: before.tactical.battle.round,
    createdTurn: before.tactical.battle.turnNumber,
    copiedFromInstanceId: burn.donor.provenance?.instanceId,
    inheritedFromInstanceId: burn.previous?.provenance?.instanceId,
  }) : undefined
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
    },
  }""",
)
replace(
    legacy,
    "return plan.copies.length === 0 && !plan.poison",
    "return plan.copies.length === 0 && !plan.poison && !plan.burn",
)

docs = Path('docs/COMBAT.md')
docs.write_text(
    docs.read_text().rstrip()
    + '''

## Curse Burn copy state (staged typed-effect extension)

Current Burn authoring may explicitly set `curseCopyable: true | false`. The optional policy is
persisted with the Burn instance; omitted historical Burn remains valid and non-copyable, and
malformed authoring or saved values fail closed. Normal Burn reapplication continues to replace the
single current Burn and restart at stage 0, including replacing an earlier copy-policy value.

A pure single-unit Curse can copy an explicitly eligible Burn from caster to target while leaving the
donor unchanged. When the target is not already burning, the copied Burn preserves the donor's exact
current stage in the 4→3→2 sequence. If the target already has Burn, normal pinned reapplication rules
win: the target Burn is replaced and restarts at stage 0. The new instance rebinds source combatant
and source action to Curse and remains explicitly copyable. Copying Burn causes no immediate damage
or backlash; normal end-turn Burn ticks, cleanse and damaging-command backlash apply afterward.

K3 assigns Burn after ordinary status copies and Poison in the shared deterministic copy ordinal
sequence. `copiedFromInstanceId` names the immediate donor Burn; replacing an existing target Burn
uses `inheritedFromInstanceId` when that instance had provenance. No-context execution does not reuse
or invent donor provenance. Amplify never copies Burn in this slice. Bleed typed-state copying,
repeat-use/publication, AI and broader copying remain separate gates; no published Skill is activated.
'''
)
