import type {
  CombatOrdinaryTargetSelection,
  CombatTargetSelection,
  CombatTargetSpec,
} from './actions'

/** Planning only: callers quote the combined set again through their authoritative adapter. */
export function buildCombatAiPluralSelection(
  target: CombatTargetSpec,
  candidates: readonly { target: CombatTargetSelection; utility: number; stableKey: string }[],
): CombatTargetSelection | null {
  if (target.shape.kind !== 'single' || (target.maximumSelections ?? 1) <= 1) return null
  const ordinary = candidates
    .filter(
      (candidate): candidate is typeof candidate & { target: CombatOrdinaryTargetSelection } =>
        ['unit', 'self', 'tile'].includes(candidate.target.kind) && candidate.utility > 0,
    )
    .sort(
      (a, b) =>
        b.utility - a.utility ||
        (a.stableKey < b.stableKey ? -1 : a.stableKey > b.stableKey ? 1 : 0),
    )
  const selections = ordinary
    .slice(0, target.maximumSelections)
    .map((candidate) => candidate.target)
  return selections.length > 1 ? { kind: 'selections', selections } : null
}
