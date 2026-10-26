import type { ContentReference } from './content-definition-fields'

export function readableContentReference(
  key: string,
  choices: readonly ContentReference[],
  kind?: string,
): string {
  const name = choices.find((entry) => entry.contentKey === key)?.name
  if (name && name !== key) return name
  if (/^[a-f\d]{8}-[a-f\d-]{27,}$/i.test(key))
    return kind?.includes('discipline') ? 'Character using this Discipline' : 'Character build'
  if (key.endsWith('.linked-sequence')) {
    const pair = key.replace(/^resonance\./, '').replace(/\.linked-sequence$/, '')
    return `${pair.split('-').map(title).join(' + ')} Resonance`
  }
  return key
    .replace(/^(?:essence|resonance|definition-current)\./, '')
    .split(/[._-]/u)
    .filter(Boolean)
    .map(title)
    .join(' ')
}
function title(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function settingLabel(key: string): string {
  return key
    .replace(/BasisPoints$/, ' (%)')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^./, (first) => first.toUpperCase())
}
