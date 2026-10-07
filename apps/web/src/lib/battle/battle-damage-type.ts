/** Never infer a hit's element from its Skill name or current content definition. */
export function battleDamageLabel(element: unknown): string {
  return element === 'fire' || element === 'water' || element === 'storm'
    ? `${element} damage`
    : 'damage'
}
