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
    "  movementRemainder: number\n  provenance?: CombatEffectInstanceProvenance",
    "  movementRemainder: number\n  /** Explicit current Curse eligibility; omitted historical Poison remains non-copyable. */\n  curseCopyable?: boolean\n  provenance?: CombatEffectInstanceProvenance",
)

dots = 'packages/game-core/src/combat/combat-dots.ts'
replace(
    dots,
    "export interface CurrentPoisonEffect {\n  type: 'poison'\n  recipient: CombatEffectRecipient\n}",
    """export interface CurrentPoisonEffect {
  type: 'poison'
  recipient: CombatEffectRecipient
  curseCopyable?: boolean
}

export function validateCurrentPoisonEffect(effect: { curseCopyable?: unknown }): void {
  if (effect.curseCopyable !== undefined && typeof effect.curseCopyable !== 'boolean') {
    throw new TypeError('Poison curseCopyable must be boolean when supplied.')
  }
}""",
)
replace(
    dots,
    "  sourceActionId: string,\n): CombatEncounterState {",
    "  sourceActionId: string,\n  curseCopyable?: boolean,\n): CombatEncounterState {",
    1,
)
replace(
    dots,
    "  const effectState = normalizeCombatEffectState(state.effectState)\n  const existing = effectState.poison.find(",
    "  validateCurrentPoisonEffect({ curseCopyable })\n  const effectState = normalizeCombatEffectState(state.effectState)\n  const existing = effectState.poison.find(",
    1,
)
replace(
    dots,
    "    movementRemainder: existing?.movementRemainder ?? 0,\n  }",
    "    movementRemainder: existing?.movementRemainder ?? 0,\n    ...(curseCopyable !== undefined ? { curseCopyable } : {}),\n  }",
    1,
)
replace(
    dots,
    "      !Number.isSafeInteger(instance.movementRemainder) ||\n      instance.movementRemainder < 0 ||",
    "      (instance.curseCopyable !== undefined && typeof instance.curseCopyable !== 'boolean') ||\n      !Number.isSafeInteger(instance.movementRemainder) ||\n      instance.movementRemainder < 0 ||",
    1,
)
replace(
    dots,
    "            'Poison state must contain one valid current-profile instance per target, sorted by target ID, with movement progress from 0 to 4.',",
    "            'Poison state must contain one valid current-profile instance per target, sorted by target ID, with movement progress from 0 to 4 and optional boolean copy policy.',",
    1,
)

legacy = 'packages/game-core/src/combat/actions-legacy.ts'
replace(
    legacy,
    "  validateCombatDotState,\n  validateCurrentBleedEffect,",
    "  validateCombatDotState,\n  validateCurrentBleedEffect,\n  validateCurrentPoisonEffect,",
)
replace(
    legacy,
    "  | { type: 'poison'; recipient: CombatEffectRecipient }",
    "  | { type: 'poison'; recipient: CombatEffectRecipient; curseCopyable?: boolean }",
)
replace(
    legacy,
    "      state: applyCurrentPoisonState(state, actorId, recipientId, actionId),",
    """      state: applyCurrentPoisonState(
        state,
        actorId,
        recipientId,
        actionId,
        effect.curseCopyable,
      ),""",
)
replace(
    legacy,
    "    if (effect.type === 'bleed') validateCurrentBleedEffect(effect)",
    "    if (effect.type === 'poison') validateCurrentPoisonEffect(effect)\n    if (effect.type === 'bleed') validateCurrentBleedEffect(effect)",
    1,
)

validation = 'packages/game-core/src/combat/combat-authoring-validation.ts'
replace(
    validation,
    "import { validateCurrentBleedEffect } from './combat-dots'",
    "import { validateCurrentBleedEffect, validateCurrentPoisonEffect } from './combat-dots'",
)
replace(
    validation,
    "    if (effect.type === 'bleed') validateCurrentBleedEffect(effect)",
    "    if (effect.type === 'poison') validateCurrentPoisonEffect(effect)\n    if (effect.type === 'bleed') validateCurrentBleedEffect(effect)",
)

copy = 'packages/game-core/src/combat/combat-status-copy.ts'
replace(
    copy,
    "import { compareCombatStatusInstances } from './combat-accuracy-status'\nimport { createCombatEffectInstanceProvenance } from './combat-kernel-types'",
    """import { compareCombatStatusInstances } from './combat-accuracy-status'
import { currentPoisonInstance } from './combat-dots'
import { normalizeCombatEffectState, type CombatPoisonInstance } from './combat-effect-state'
import { createCombatEffectInstanceProvenance } from './combat-kernel-types'""",
)
replace(
    copy,
    "interface StatusCopy {\n  donor: CombatStatusInstance\n  previous: CombatStatusInstance | undefined\n  next: CombatStatusInstance\n}",
    """interface StatusCopy {
  donor: CombatStatusInstance
  previous: CombatStatusInstance | undefined
  next: CombatStatusInstance
}

interface PoisonCopy {
  donor: CombatPoisonInstance
  previous: CombatPoisonInstance | undefined
}

interface CombatCopyPlan {
  receiverId: string
  copies: readonly StatusCopy[]
  poison: PoisonCopy | undefined
}""",
)
replace(copy, "): { receiverId: string; copies: readonly StatusCopy[] } {", "): CombatCopyPlan {")
replace(
    copy,
    "  if (donorId === receiverId) return { receiverId, copies: [] }",
    "  if (donorId === receiverId) return { receiverId, copies: [], poison: undefined }",
)
replace(
    copy,
    "  return { receiverId, copies }\n}",
    """  const donorPoison = effect.mode === 'curse' ? currentPoisonInstance(state, donorId) : null
  const poison = donorPoison?.curseCopyable === true
    ? { donor: donorPoison, previous: currentPoisonInstance(state, receiverId) ?? undefined }
    : undefined
  return { receiverId, copies, poison }
}""",
    1,
)
replace(
    copy,
    "  const { receiverId, copies } = planCombatStatusCopies(state, actorId, selectedId, effect, content)\n  if (copies.length === 0) throw new Error('Status copying requires eligible active statuses.')",
    """  const { receiverId, copies, poison } = planCombatStatusCopies(state, actorId, selectedId, effect, content)
  if (copies.length === 0 && !poison) throw new Error('Status copying requires eligible active statuses.')""",
)
old_state = """  return {
    state: {
      ...state,
      statusState: state.statusState.map((row) =>
        row.combatantId === receiverId
          ? {
              ...row,
              statuses: [
                ...row.statuses.filter((status) => !replaced.has(status)),
                ...copies.map((copy) => copy.next),
              ].sort(compareCombatStatusInstances),
            }
          : row,
      ),
    },
    events:"""
new_state = """  const statusState = state.statusState.map((row) =>
    row.combatantId === receiverId
      ? {
          ...row,
          statuses: [
            ...row.statuses.filter((status) => !replaced.has(status)),
            ...copies.map((copy) => copy.next),
          ].sort(compareCombatStatusInstances),
        }
      : row,
  )
  const effectState = normalizeCombatEffectState(state.effectState)
  const nextPoison = poison
    ? {
        targetCombatantId: receiverId,
        sourceCombatantId: actorId,
        sourceActionId: actionId,
        profileVersion: poison.donor.profileVersion,
        movementRemainder: poison.previous?.movementRemainder ?? poison.donor.movementRemainder,
        curseCopyable: true as const,
      }
    : undefined
  const nextEffectState = nextPoison
    ? {
        ...effectState,
        poison: [
          ...effectState.poison.filter((entry) => entry.targetCombatantId !== receiverId),
          nextPoison,
        ].sort((left, right) => left.targetCombatantId.localeCompare(right.targetCombatantId)),
      }
    : effectState
  return {
    state: { ...state, statusState, effectState: nextEffectState },
    events:"""
replace(copy, old_state, new_state)
replace(
    copy,
    """    projections: copies.map(({ previous, next }) => ({
      effectType: 'copy-statuses',
      combatantId: receiverId,
      before: statusSummary(previous),
      after: statusSummary(next),
    })),""",
    """    projections: [
      ...copies.map(({ previous, next }) => ({
        effectType: 'copy-statuses',
        combatantId: receiverId,
        before: statusSummary(previous),
        after: statusSummary(next),
      })),
      ...(nextPoison
        ? [
            {
              effectType: 'copy-statuses',
              combatantId: receiverId,
              before: poison?.previous ? `poison:${poison.previous.movementRemainder}` : 'none',
              after: `poison:${nextPoison.movementRemainder}`,
            },
          ]
        : []),
    ],""",
)
replace(
    copy,
    "  const { receiverId, copies } = planCombatStatusCopies(\n",
    "  const { receiverId, copies, poison } = planCombatStatusCopies(\n",
)
old_return = """  return {
    ...after,
    statusState: after.statusState.map((row) =>
      row.combatantId === receiverId
        ? {
            ...row,
            statuses: row.statuses.map((status) => {
              const assigned = assignments.get(status.statusId)
              if (!assigned || status.sourceCombatantId !== actorId) return status
              const provenance = createCombatEffectInstanceProvenance({
                action: context.provenance,
                targetCombatantId: receiverId,
                effectOrdinal: 0,
                copyOrdinal: assigned.copyOrdinal,
                createdRound: before.tactical.battle.round,
                createdTurn: before.tactical.battle.turnNumber,
                copiedFromInstanceId: assigned.copy.donor.provenance?.instanceId,
                inheritedFromInstanceId: assigned.copy.previous?.provenance?.instanceId,
              })
              return { ...status, provenance }
            }),
          }
        : row,
    ),
  }"""
new_return = """  const statusState = after.statusState.map((row) =>
    row.combatantId === receiverId
      ? {
          ...row,
          statuses: row.statuses.map((status) => {
            const assigned = assignments.get(status.statusId)
            if (!assigned || status.sourceCombatantId !== actorId) return status
            const provenance = createCombatEffectInstanceProvenance({
              action: context.provenance,
              targetCombatantId: receiverId,
              effectOrdinal: 0,
              copyOrdinal: assigned.copyOrdinal,
              createdRound: before.tactical.battle.round,
              createdTurn: before.tactical.battle.turnNumber,
              copiedFromInstanceId: assigned.copy.donor.provenance?.instanceId,
              inheritedFromInstanceId: assigned.copy.previous?.provenance?.instanceId,
            })
            return { ...status, provenance }
          }),
        }
      : row,
  )
  if (!poison) return { ...after, statusState }
  const provenance = createCombatEffectInstanceProvenance({
    action: context.provenance,
    targetCombatantId: receiverId,
    effectOrdinal: 0,
    copyOrdinal: copies.length,
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
  }"""
replace(copy, old_return, new_return)

# Existing legality should consider explicitly copyable Poison as part of the same pure operation.
replace(
    legacy,
    """      planCombatStatusCopies(state, actorId, target.combatantId, copyEffect, content).copies.length ===
        0""",
    """      (() => {
        const plan = planCombatStatusCopies(state, actorId, target.combatantId, copyEffect, content)
        return plan.copies.length === 0 && !plan.poison
      })()""",
)

docs = Path('docs/COMBAT.md')
docs.write_text(
    docs.read_text().rstrip()
    + '''

## Curse Poison copy state (staged typed-effect extension)

Current Poison authoring may explicitly set `curseCopyable: true | false`. The flag is copied into
its persistent Poison row so later Curse legality does not infer eligibility from the display name.
Historical Poison rows which omit this optional field remain valid and are not Curse-copyable.
Malformed authored or persisted values fail closed.

A pure single-unit Curse can copy an explicitly eligible Poison from the caster to its selected
recipient while leaving the original Poison unchanged. A new recipient Poison preserves the donor's
current movement remainder. If the recipient already has Poison, the normal single-instance rule
wins and the recipient's own movement remainder is retained rather than reset to donor progress.
The copied instance rebinds source combatant/action to the Curse command and becomes explicitly
copyable. No Poison damage fires merely because it was copied; existing movement/end-turn Poison
processing continues afterward.

With K3 context the copy uses the shared `copyOrdinal` sequence after any copied ordinary statuses,
records the immediate donor in `copiedFromInstanceId`, and records a replaced recipient instance in
`inheritedFromInstanceId`. Without K3 context no donor provenance is silently reused. Amplify never
copies Poison in this slice. Burn/Bleed typed state, repeat-use/publication, AI and broader copying
remain separate gates; no published Skill is activated here.
'''
)
