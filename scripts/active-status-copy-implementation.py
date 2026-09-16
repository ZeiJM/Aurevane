from pathlib import Path

root = Path('packages/game-core/src/combat')

def patch(name, old, new, count=1):
    path = root / name
    text = path.read_text()
    assert text.count(old) == count, (name, old[:130], text.count(old), count)
    path.write_text(text.replace(old, new))

helper = root / 'combat-status-copy.ts'
assert not helper.exists()
helper.write_text('''import type {
  CombatActionDefinition,
  CombatContentCatalog,
  CombatEffectDefinition,
  CombatEffectProjection,
  CombatEncounterState,
  CombatResolutionContext,
  CombatResolutionTransition,
  CombatStatusDefinition,
  CombatStatusInstance,
} from './actions'
import { compareCombatStatusInstances } from './combat-accuracy-status'
import { createCombatEffectInstanceProvenance } from './combat-kernel-types'

export interface CombatStatusCopyEffect {
  type: 'copy-statuses'
  recipient: 'primary-unit'
  mode: 'amplify' | 'curse'
}

/** Copying is staged as a pure, single-unit command until composition/repeat/AI gates exist. */
export function validateCombatStatusCopyAction(action: CombatActionDefinition): void {
  for (const effect of action.effects) {
    if (effect.type !== 'copy-statuses') continue
    if (
      action.effects.length !== 1 || action.sourceType === 'basic-attack' ||
      action.target.kind !== 'unit' || action.target.shape.kind !== 'single' ||
      effect.recipient !== 'primary-unit' ||
      (effect.mode !== 'amplify' && effect.mode !== 'curse')
    ) {
      throw new TypeError('Status copying requires one pure, single-unit Amplify or Curse operation, never Basic Attack.')
    }
  }
}

function isCopyable(definition: CombatStatusDefinition, mode: CombatStatusCopyEffect['mode']): boolean {
  const permitted = mode === 'amplify' ? definition.amplifyCopyable : definition.curseCopyable
  return permitted === true &&
    definition.polarity === (mode === 'amplify' ? 'positive' : 'negative') &&
    (definition.reactionClass === undefined || definition.reactionClass === 'ordinary' ||
      definition.reactionClass === 'periodic' || definition.reactionClass === 'reactive')
}

function assertPinnedStatus(instance: CombatStatusInstance, definition: CombatStatusDefinition): void {
  if (
    instance.statusVersion !== definition.version ||
    !Number.isSafeInteger(instance.stacks) || instance.stacks < 1 || instance.stacks > definition.maximumStacks ||
    !Number.isSafeInteger(instance.remainingOwnerTurnStarts) || instance.remainingOwnerTurnStarts < 1 ||
    instance.remainingOwnerTurnStarts > definition.durationOwnerTurnStarts
  ) {
    throw new TypeError('Copied status state must match its pinned version, stack cap and remaining duration.')
  }
}

interface StatusCopy {
  donor: CombatStatusInstance
  previous: CombatStatusInstance | undefined
  next: CombatStatusInstance
}

/** Only ordinary status rows are enumerated; typed DoT/resource/terrain state is never inferred. */
export function planCombatStatusCopies(
  state: CombatEncounterState,
  actorId: string,
  selectedId: string,
  effect: CombatStatusCopyEffect,
  content: CombatContentCatalog,
): { receiverId: string; copies: readonly StatusCopy[] } {
  const donorId = effect.mode === 'amplify' ? selectedId : actorId
  const receiverId = effect.mode === 'amplify' ? actorId : selectedId
  if (donorId === receiverId) return { receiverId, copies: [] }
  const donors = state.statusState.find((row) => row.combatantId === donorId)?.statuses ?? []
  const receiver = state.statusState.find((row) => row.combatantId === receiverId)?.statuses ?? []
  const definitions = new Map(content.statuses.map((definition) => [definition.id, definition]))
  const selected = new Map<string, { donor: CombatStatusInstance; definition: CombatStatusDefinition }>()
  for (const donor of [...donors].sort(compareCombatStatusInstances)) {
    const definition = definitions.get(donor.statusId)
    if (!definition) throw new TypeError(`Missing pinned status definition ${donor.statusId}.`)
    if (!isCopyable(definition, effect.mode)) continue
    assertPinnedStatus(donor, definition)
    const previous = selected.get(donor.statusId)
    // Rebound Marks share one receiver relationship: choose the longest-lived source, stable on ties.
    if (!previous || donor.remainingOwnerTurnStarts > previous.donor.remainingOwnerTurnStarts) {
      selected.set(donor.statusId, { donor, definition })
    }
  }
  const copies = [...selected.values()].map(({ donor, definition }): StatusCopy => {
    const previous = receiver.find((status) => status.statusId === donor.statusId &&
      (status.sourceScopedMark !== true || status.sourceCombatantId === actorId))
    if (previous) assertPinnedStatus(previous, definition)
    const previousStacks = previous?.stacks ?? 0
    const next: CombatStatusInstance = {
      ...(donor.sourceScopedMark === true ? { sourceScopedMark: true as const } : {}),
      statusId: donor.statusId,
      statusVersion: donor.statusVersion,
      // Both inputs are bounded; adding only the remaining capacity avoids unsafe integer sums.
      stacks: previousStacks + Math.min(donor.stacks, definition.maximumStacks - previousStacks),
      remainingOwnerTurnStarts: Math.max(donor.remainingOwnerTurnStarts, previous?.remainingOwnerTurnStarts ?? 0),
      sourceCombatantId: actorId,
    }
    return { donor, previous, next }
  })
  return { receiverId, copies }
}

function statusSummary(status: CombatStatusInstance | undefined): string {
  return status ? `${status.statusId}:${status.stacks}:${status.remainingOwnerTurnStarts}` : 'none'
}

export function applyCombatStatusCopies(
  state: CombatEncounterState,
  actorId: string,
  selectedId: string,
  actionId: string,
  effect: CombatStatusCopyEffect,
  content: CombatContentCatalog,
): CombatResolutionTransition & { projections: CombatEffectProjection[] } {
  const { receiverId, copies } = planCombatStatusCopies(state, actorId, selectedId, effect, content)
  if (copies.length === 0) throw new Error('Status copying requires eligible active statuses.')
  const replaced = new Set(copies.map((copy) => copy.previous).filter((entry) => entry !== undefined))
  return {
    state: {
      ...state,
      statusState: state.statusState.map((row) => row.combatantId === receiverId ? {
        ...row,
        statuses: [
          ...row.statuses.filter((status) => !replaced.has(status)),
          ...copies.map((copy) => copy.next),
        ].sort(compareCombatStatusInstances),
      } : row),
    },
    events: copies.map(({ previous, next }) => ({
      event: 'status_applied', actionId, sourceCombatantId: actorId, targetCombatantId: receiverId,
      statusId: next.statusId, stacks: next.stacks, remainingOwnerTurnStarts: next.remainingOwnerTurnStarts,
      refreshed: previous !== undefined, stacked: previous !== undefined && next.stacks > previous.stacks,
    })),
    projections: copies.map(({ previous, next }) => ({
      effectType: 'copy-statuses', combatantId: receiverId, before: statusSummary(previous), after: statusSummary(next),
    })),
  }
}

/** Called by the existing K3 attachment stage only after the single copy operation commits. */
export function attachCombatStatusCopyProvenance(
  before: CombatEncounterState,
  after: CombatEncounterState,
  actorId: string,
  selectedId: string,
  effect: Extract<CombatEffectDefinition, { type: 'copy-statuses' }>,
  content: CombatContentCatalog,
  context: CombatResolutionContext,
): CombatEncounterState {
  const { receiverId, copies } = planCombatStatusCopies(before, actorId, selectedId, effect, content)
  const assignments = new Map(copies.map((copy, copyOrdinal) => [copy.next.statusId, { copy, copyOrdinal }]))
  return {
    ...after,
    statusState: after.statusState.map((row) => row.combatantId === receiverId ? {
      ...row,
      statuses: row.statuses.map((status) => {
        const assigned = assignments.get(status.statusId)
        if (!assigned || status.sourceCombatantId !== actorId) return status
        const provenance = createCombatEffectInstanceProvenance({
          action: context.provenance, targetCombatantId: receiverId, effectOrdinal: 0,
          copyOrdinal: assigned.copyOrdinal,
          createdRound: before.tactical.battle.round, createdTurn: before.tactical.battle.turnNumber,
          copiedFromInstanceId: assigned.copy.donor.provenance?.instanceId,
          inheritedFromInstanceId: assigned.copy.previous?.provenance?.instanceId,
        })
        return { ...status, provenance }
      }),
    } : row),
  }
}
''')

# Retain one existing authoritative resolver and its cost/target/accuracy/terminal behavior.
path = root / 'actions-legacy.ts'
path.write_text("import { applyCombatStatusCopies, planCombatStatusCopies, validateCombatStatusCopyAction, type CombatStatusCopyEffect } from './combat-status-copy'\n" + path.read_text())
patch('actions-legacy.ts', 'export type CombatEffectDefinition =\n', 'export type CombatEffectDefinition =\n  | CombatStatusCopyEffect\n')
patch('actions-legacy.ts', '  let projectedEffects: CombatEffectProjection[] = []', '''  const copyEffect = action.effects[0]
  if (issues.length === 0 && copyEffect?.type === 'copy-statuses' && target.combatantId) {
    if (target.combatantId === actorId ||
      planCombatStatusCopies(state, actorId, target.combatantId, copyEffect, content).copies.length === 0) {
      issues.push({ code: 'requirement-not-met', message: 'Status copying requires eligible active statuses on a different combatant.' })
    }
  }

  let projectedEffects: CombatEffectProjection[] = []''')
patch('actions-legacy.ts', '      const before = nextState\n      const applied = applyEffect(', '''      if (effect.type === 'copy-statuses') {
        const copied = applyCombatStatusCopies(nextState, actorId, recipientId, action.id, effect, content)
        nextState = copied.state
        events.push(...copied.events)
        projections.push(...copied.projections)
        continue
      }
      const before = nextState
      const applied = applyEffect(''')
patch('actions-legacy.ts', "effect: Exclude<CombatEffectDefinition, { type: 'create-terrain' }>", "effect: Exclude<CombatEffectDefinition, { type: 'create-terrain' | 'copy-statuses' }>")
# Add the same shape check to both authoring boundaries; no definition guessing.
for filename in ['actions-legacy.ts', 'combat-authoring-validation.ts']:
    if filename == 'combat-authoring-validation.ts':
        path = root / filename
        path.write_text("import { validateCombatStatusCopyAction } from './combat-status-copy'\n" + path.read_text())
    path = root / filename
    text = path.read_text()
    start = text.index('function validateCombatActionDefinition(')
    body = text.index('): void {', start) + len('): void {')
    text = text[:body] + '\n  validateCombatStatusCopyAction(action)' + text[body:]
    path.write_text(text)
    patch(filename, "        'barrier-change',\n      ],\n      'effect type',", "        'barrier-change',\n        'copy-statuses',\n      ],\n      'effect type',")

# K3 owns copied/inherited lineage. No context means no invented historical provenance.
path = root / 'combat-effect-provenance.ts'
path.write_text("import { attachCombatStatusCopyProvenance } from './combat-status-copy'\n" + path.read_text())
patch('combat-effect-provenance.ts', '  CombatActionDefinition,\n', '  CombatActionDefinition,\n  CombatContentCatalog,\n')
patch('combat-effect-provenance.ts', '  context: CombatResolutionContext,\n): CombatEncounterState {', '  context: CombatResolutionContext,\n  content?: CombatContentCatalog,\n): CombatEncounterState {')
patch('combat-effect-provenance.ts', '  if (!evaluation.actorId) return after\n', '''  if (!evaluation.actorId) return after
  const copyEffect = action.effects[0]
  if (copyEffect?.type === 'copy-statuses') {
    if (!evaluation.primaryCombatantId) return after
    if (!content) throw new TypeError('Copied status provenance requires its pinned catalog.')
    return attachCombatStatusCopyProvenance(before, after, evaluation.actorId,
      evaluation.primaryCombatantId, copyEffect, content, context)
  }
''')
patch('actions.ts', '      provenanceEvaluation,\n      context,\n', '      provenanceEvaluation,\n      context,\n      content,\n')
patch('mature-skills.ts', "  const idPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/", """  if (definition.effects.some((effect) => effect.type === 'copy-statuses')) {
    issues.push('effects.status-copy-staged')
  }
  const idPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/""")

docs = Path('docs/COMBAT.md')
docs.write_text(docs.read_text().rstrip() + '''

## Amplify/Curse active-status copying (staged single-unit kernel slice)

The `copy-statuses` operation now supports pure, single-unit Amplify and Curse commands.
Amplify copies eligible positive status rows from the selected unit to the caster. Curse copies
eligible negative status rows from the caster to the selected unit. Originals are not removed.
Eligibility requires explicit copy permission and matching polarity; system/self-cost states and
unclassified or excluded effects cannot become copy targets merely through names or display tags.
Existing range, team, visibility, living-target, resource and per-target accuracy checks still apply.
Self-copy and an empty eligible donor are illegal before spending anything. A missed hostile copy
still spends its ordinary costs but neither copies nor reattributes a status. Automatic Hit and
preview RNG purity are unchanged.

The receiving status uses the pinned definition, copied remaining duration, and bounded stacks.
An existing receiver status combines stacks up to its cap and retains the longer of its current
and incoming remaining duration; no copy refills the definition's full timer. Source-scoped Marks
rebind to the Curse caster and preserve other receiver sources. Donor Marks that become one
relationship after rebinding are deduplicated, taking the longest remaining duration and stable
source order for ties. Copied/inherited K3 lineage identifies the selected donor and prior receiver
instance. Missing historical lineage remains absent. Distinct copies reuse the merged tuple-based
`copyOrdinal` identity; no alternate identity format is introduced.

This slice enumerates ordinary status rows only. Typed Poison/Burn/Bleed counters, ongoing recovery,
Barrier pools, terrain, resources, build state and temporary Skills are not copied here. Mixed
operation packages, area copies and the old Basic Attack path are rejected rather than partially
executed. The mature-Skill boundary blocks this staged operation from publication/repeat adapters
with `effects.status-copy-staged` until the remaining mechanics, repeat-use, player forecasts and
AI gates are implemented. No live catalog or published Skill is changed. K4 remains incomplete.
''')
