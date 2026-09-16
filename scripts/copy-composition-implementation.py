from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}')
    file.write_text(text.replace(old, new))


replace_once(
    'packages/game-core/src/combat/combat-status-copy.ts',
    """export interface CombatStatusCopyEffect {
  type: 'copy-statuses'
  recipient: 'primary-unit'
  mode: 'amplify' | 'curse'
}

/** Copying is staged as a pure, single-unit command until composition/repeat/AI gates exist. */
export function validateCombatStatusCopyAction(action: CombatActionDefinition): void {
  for (const effect of action.effects) {
    if (effect.type !== 'copy-statuses') continue
    if (
      action.effects.length !== 1 ||
      action.sourceType === 'basic-attack' ||
      action.target.kind !== 'unit' ||
      action.target.shape.kind !== 'single' ||
      effect.recipient !== 'primary-unit' ||
      (effect.mode !== 'amplify' && effect.mode !== 'curse')
    ) {
      throw new TypeError(
        'Status copying requires one pure, single-unit Amplify or Curse operation, never Basic Attack.',
      )
    }
  }
}
""",
    """export interface CombatStatusCopyEffect {
  type: 'copy-statuses'
  recipient: 'primary-unit'
  mode: 'amplify' | 'curse'
  /** Composed commands may explicitly permit an empty clone block while later effects still matter. */
  allowNoEligibleEffects?: boolean
}

/** Copying remains single-unit and copy-first while composition is introduced incrementally. */
export function validateCombatStatusCopyAction(action: CombatActionDefinition): void {
  const copyEntries = action.effects
    .map((effect, index) => ({ effect, index }))
    .filter(
      (entry): entry is { effect: CombatStatusCopyEffect; index: number } =>
        entry.effect.type === 'copy-statuses',
    )
  if (copyEntries.length === 0) return
  if (copyEntries.length !== 1) {
    throw new TypeError('Status copying supports exactly one copy operation per command.')
  }

  const entry = copyEntries[0]!
  const effect = entry.effect
  if (effect.allowNoEligibleEffects !== undefined && typeof effect.allowNoEligibleEffects !== 'boolean') {
    throw new TypeError('Status copy allowNoEligibleEffects must be boolean when supplied.')
  }
  if (effect.allowNoEligibleEffects === true && action.effects.length === 1) {
    throw new TypeError('Status copy no-op permission is only valid on a composed command.')
  }
  if (
    entry.index !== 0 ||
    action.sourceType === 'basic-attack' ||
    action.target.kind !== 'unit' ||
    action.target.shape.kind !== 'single' ||
    effect.recipient !== 'primary-unit' ||
    (effect.mode !== 'amplify' && effect.mode !== 'curse')
  ) {
    throw new TypeError(
      'Status copying requires one copy-first, single-unit Amplify or Curse operation, never Basic Attack.',
    )
  }
}
""",
)

replace_once(
    'packages/game-core/src/combat/combat-status-copy.ts',
    """  if (copies.length === 0 && !poison && !burn && bleed.length === 0)
    throw new Error('Status copying requires eligible active statuses.')
""",
    """  if (copies.length === 0 && !poison && !burn && bleed.length === 0) {
    if (effect.allowNoEligibleEffects === true) {
      return { state, events: [], projections: [] }
    }
    throw new Error('Status copying requires eligible active statuses.')
  }
""",
)

replace_once(
    'packages/game-core/src/combat/actions-legacy.ts',
    """        const plan = planCombatStatusCopies(state, actorId, target.combatantId, copyEffect, content)
        return plan.copies.length === 0 && !plan.poison && !plan.burn && plan.bleed.length === 0
""",
    """        const plan = planCombatStatusCopies(state, actorId, target.combatantId, copyEffect, content)
        const empty =
          plan.copies.length === 0 && !plan.poison && !plan.burn && plan.bleed.length === 0
        return empty && copyEffect.allowNoEligibleEffects !== true
""",
)

replace_once(
    'packages/game-core/src/combat/combat-effect-provenance.ts',
    """  if (!evaluation.actorId) return after
  const copyEffect = action.effects[0]
  if (copyEffect?.type === 'copy-statuses') {
    if (!evaluation.primaryCombatantId) return after
    if (!content) throw new TypeError('Copied status provenance requires its pinned catalog.')
    return attachCombatStatusCopyProvenance(
      before,
      after,
      evaluation.actorId,
      evaluation.primaryCombatantId,
      copyEffect,
      content,
      context,
    )
  }

  const actorId = evaluation.actorId
  const createdRound = before.tactical.battle.round
  const createdTurn = before.tactical.battle.turnNumber
  const beforeEffects = normalizeCombatEffectState(before.effectState)
  const afterEffects = normalizeCombatEffectState(after.effectState)

  let statusState = after.statusState
""",
    """  if (!evaluation.actorId) return after
  const copyEffect = action.effects[0]
  let provenanceAfter = after
  if (copyEffect?.type === 'copy-statuses' && evaluation.primaryCombatantId) {
    if (!content) throw new TypeError('Copied status provenance requires its pinned catalog.')
    provenanceAfter = attachCombatStatusCopyProvenance(
      before,
      after,
      evaluation.actorId,
      evaluation.primaryCombatantId,
      copyEffect,
      content,
      context,
    )
  }

  const actorId = evaluation.actorId
  const createdRound = before.tactical.battle.round
  const createdTurn = before.tactical.battle.turnNumber
  const beforeEffects = normalizeCombatEffectState(before.effectState)
  const afterEffects = normalizeCombatEffectState(provenanceAfter.effectState)

  let statusState = provenanceAfter.statusState
""",
)

replace_once(
    'packages/game-core/src/combat/combat-effect-provenance.ts',
    """  if (!statusChanged && !effectStateChanged) return after

  return {
    ...after,
""",
    """  if (!statusChanged && !effectStateChanged) return provenanceAfter

  return {
    ...provenanceAfter,
""",
)

replace_once(
    'docs/COMBAT.md',
    """only when the replaced receiver row actually carried provenance at insertion time, never for an
unpersisted same-command transient copy. Amplify does not copy Bleed in this slice. Repeat-use,
publication, AI and broader composition remain separate gates; no published Skill is activated.
""",
    """only when the replaced receiver row actually carried provenance at insertion time, never for an
unpersisted same-command transient copy. Amplify does not copy Bleed in this slice. Repeat-use,
publication and AI remain separate gates; no published Skill is activated.

## Amplify / Curse copy-first composition boundary

One `copy-statuses` block may now be the first effect in an otherwise ordinary single-unit command.
The copy block keeps its existing Amplify/Curse donor direction, current-state clone rules, hit gating
and K3 copy ordinals. Later authored effects resolve in their normal order after the clone block and
retain their own authored effect ordinals for K3 provenance. Multiple copy blocks, copy blocks placed
later in the effect list, Basic Attack cloning and area/multi-source cloning remain rejected.

Pure copy commands still fail fast when their donor has no eligible effect. A composed command may
explicitly author `allowNoEligibleEffects: true` on its first copy block when later effects are
independently meaningful; in that case the empty clone step is a no-op and later effects still resolve.
The opt-in is boolean-only and invalid on a pure copy command. Consecutive-use scaling for cloning is
still staged because the approved repeat rule does not yet classify clone transfer as quantitative or
discrete; no half-copy behavior is invented here. No published Skill is activated by this boundary.
""",
)
