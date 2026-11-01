/** Persisted editor provenance only; these links never infer runtime mechanics. */
export function isGeneratedCombatCompanionLink(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(?:(?:dot-damage|frozen-ground)\.[1-9][0-9]*|element-companion\.(?:frozen|wet|conductive|cleanse-chilled)\.(?:actor|primary-unit|affected-units)(?:\.[1-9][0-9]*)?)$/.test(
      value,
    )
  )
}
