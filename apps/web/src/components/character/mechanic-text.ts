/** Explicit reference nodes are authored with the sentence, never inferred from its words. */
const labels = {
  'frozen-ground': 'Frozen Ground',
  steam: 'Steam',
  airborne: 'Airborne',
  rooted: 'Rooted',
  slow: 'Slow',
  fire: 'Fire',
  exposed: 'Vulnerable',
  mark: 'Marked',
  guarded: 'Guard',
  burn: 'Burn',
  frozen: 'Chilled',
  covert: 'Covert',
  primed: 'Primed',
  trigger: 'Trigger',
  'resource-threshold': 'Resource Threshold',
  'hp-less-than': 'HP less than',
  'hp-more-than': 'HP more than',
  'mp-less-than': 'MP less than',
  'mp-more-than': 'MP more than',
  fortified: 'Fortified',
  reckless: 'Reckless',
  bleed: 'Bleed',
  poison: 'Poison',
  challenged: 'Taunt',
  suppress: 'Suppress',
  conductive: 'Conductive',
  wet: 'Drenched',
  inspired: 'Damage Up',
  blindside: 'Blindside',
  hexed: 'Healing Down',
  invisible: 'Invisible',
  haste: 'Haste',
  warded: 'Burn Ward',
  revealed: 'Revealed',
  'lowered-guard': 'Defenseless',
} as const
/** Only identities with supported status rules become prerequisite links. */
export function mechanicStatusTag(statusId: string): MechanicTag | undefined {
  if (statusId === 'root') return 'rooted'
  switch (statusId) {
    case 'airborne':
    case 'slow':
    case 'exposed':
    case 'mark':
    case 'guarded':
    case 'burn':
    case 'frozen':
    case 'covert':
    case 'fortified':
    case 'reckless':
    case 'bleed':
    case 'poison':
    case 'challenged':
    case 'suppress':
    case 'conductive':
    case 'wet':
    case 'inspired':
    case 'blindside':
    case 'hexed':
    case 'invisible':
    case 'haste':
    case 'warded':
    case 'revealed':
    case 'lowered-guard':
      return statusId
    default:
      return undefined
  }
}
export type MechanicTag = keyof typeof labels
export type MechanicTextPart =
  | string
  | {
      readonly tag: MechanicTag
      readonly label: string
      readonly explanation?: string
    }
export function isMechanicTag(value: string): value is MechanicTag {
  return Object.hasOwn(labels, value)
}
export function mechanicTag(tag: MechanicTag): Exclude<MechanicTextPart, string> {
  return { tag, label: labels[tag] }
}
export function plainMechanicText(parts: readonly MechanicTextPart[]): string {
  return parts.map((part) => (typeof part === 'string' ? part : part.label)).join('')
}
export function mechanicText(
  strings: TemplateStringsArray,
  ...values: readonly MechanicTextPart[]
) {
  const descriptionParts: MechanicTextPart[] = []
  strings.forEach((text, index) => {
    if (text) descriptionParts.push(text)
    if (index < values.length) descriptionParts.push(values[index]!)
  })
  return { description: plainMechanicText(descriptionParts), descriptionParts }
}
