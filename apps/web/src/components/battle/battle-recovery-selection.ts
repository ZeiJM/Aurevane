interface RecoverySelectionTechnique {
  tags: readonly string[]
  definition?: {
    effects: readonly { type: string; delta?: number }[]
  }
}

/** Recovery color follows every effect/tag, including mixed defensive Skills and MP recovery. */
export function battleActionUsesRecoverySelection(
  actionId: string | null,
  technique: RecoverySelectionTechnique | null | undefined,
): boolean {
  if (actionId === 'basic.recover' || actionId === 'basic.recover.mp') return true
  if (
    technique?.tags.some((tag) =>
      /^(?:heal(?:ing)?|(?:hp |mp )?recovery|mp restore)(?:$|\s*\[)/i.test(tag),
    )
  )
    return true
  return (
    technique?.definition?.effects.some(
      (effect) =>
        effect.type === 'healing' ||
        (effect.type === 'resource-change' && typeof effect.delta === 'number' && effect.delta > 0),
    ) ?? false
  )
}
