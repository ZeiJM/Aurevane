/** Current authoring restrictions only; captured definitions retain their own grammar. */
export function currentEffectSourceAllowed(type: string, contentId?: string): boolean {
  return type === 'summon'
    ? contentId === 'basic.invocation'
    : type === 'loot'
      ? contentId === 'basic.pilfer'
      : true
}
