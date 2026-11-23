import type { ManualCombatModifierSelection } from '@aurevane/game-core/combat/combat-ability-command'
import type { BattleControlledActionAvailability } from './battle-preview-selection'

export interface BattleModifierContext {
  readonly battleSessionId: string
  readonly battleVersion: number
  readonly actorId: string
  readonly actionId: string
  readonly behaviorId?: string
  readonly rootContentVersion: number | null
  readonly rootFingerprint: string
}
export interface BattleModifierPinnedSelection extends ManualCombatModifierSelection {
  readonly abilityId: string
  readonly contentVersion: number
  readonly fingerprint: string
}
export interface BattleModifierDraft {
  readonly context: BattleModifierContext
  readonly selected: readonly BattleModifierPinnedSelection[]
}

function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}
export function battleManualModifierReferences(
  references: readonly ManualCombatModifierSelection[],
): ManualCombatModifierSelection[] {
  return references
    .map(({ sourceInstanceId, behaviorId }) => ({ sourceInstanceId, behaviorId }))
    .sort(
      (a, b) =>
        compare(a.sourceInstanceId, b.sourceInstanceId) || compare(a.behaviorId, b.behaviorId),
    )
}
function sameReference(a: ManualCombatModifierSelection, b: ManualCombatModifierSelection) {
  return a.sourceInstanceId === b.sourceInstanceId && a.behaviorId === b.behaviorId
}
function validPin(pin: BattleModifierPinnedSelection) {
  return (
    [pin.sourceInstanceId, pin.behaviorId, pin.abilityId, pin.fingerprint].every(
      (value) => typeof value === 'string' && value.length > 0 && value.trim() === value,
    ) &&
    Number.isSafeInteger(pin.contentVersion) &&
    pin.contentVersion > 0
  )
}
export function prepareBattleModifierDraft(context: BattleModifierContext): BattleModifierDraft {
  return { context: { ...context }, selected: [] }
}
export function toggleBattleModifierDraft(
  draft: BattleModifierDraft,
  choice: BattleModifierPinnedSelection,
): BattleModifierDraft {
  const selected = draft.selected.some((row) => sameReference(row, choice))
    ? draft.selected.filter((row) => !sameReference(row, choice))
    : draft.selected.length < 15 && validPin(choice)
      ? [...draft.selected, { ...choice }]
      : draft.selected
  return {
    context: draft.context,
    selected: [...selected].sort(
      (a, b) =>
        compare(a.sourceInstanceId, b.sourceInstanceId) || compare(a.behaviorId, b.behaviorId),
    ),
  }
}
export function resolveBattleModifierDraft(
  draft: BattleModifierDraft | null,
  context: BattleModifierContext,
  choices: readonly BattleModifierPinnedSelection[],
  controlled: BattleControlledActionAvailability | undefined,
): { manualModifiers: readonly ManualCombatModifierSelection[]; stale: boolean; locked: boolean } {
  if (controlled && controlled.phase !== 'unprimed')
    return {
      manualModifiers: battleManualModifierReferences(controlled.manualModifiers ?? []),
      stale: false,
      locked: true,
    }
  if (!draft) return { manualModifiers: [], stale: false, locked: false }
  const previous = draft.context
  const matches =
    previous.battleSessionId === context.battleSessionId &&
    previous.battleVersion === context.battleVersion &&
    previous.actorId === context.actorId &&
    previous.actionId === context.actionId &&
    previous.behaviorId === context.behaviorId &&
    previous.rootContentVersion === context.rootContentVersion &&
    previous.rootFingerprint === context.rootFingerprint
  const pinsCurrent =
    draft.selected.length <= 15 &&
    draft.selected.every(
      (pin) =>
        validPin(pin) &&
        choices.some(
          (choice) =>
            sameReference(pin, choice) &&
            pin.abilityId === choice.abilityId &&
            pin.contentVersion === choice.contentVersion &&
            pin.fingerprint === choice.fingerprint,
        ),
    )
  return {
    manualModifiers: battleManualModifierReferences(draft.selected),
    stale: !matches || !pinsCurrent,
    locked: false,
  }
}
