import { AUTHORABLE_EFFECT_TAGS } from './combat-effect-identities'
import type { AuthoredTag } from '../content/authored-content'

/** Defaults preserve the generated parameter-aware text until an Owner edits this tag. */
export function defaultCombatTagDefinitions(): readonly AuthoredTag[] {
  return AUTHORABLE_EFFECT_TAGS.map((tag) => {
    const tagId = tag.id.replace(/^status:/u, '')
    return {
      schemaVersion: 1,
      id: `tag.${tagId}`,
      tagId,
      contentVersion: 1,
      name: tag.label,
      description: '{summary}',
      explanation: '{details}',
      sortOrder: 0,
      enabled: true,
      media: {},
    }
  })
}

/** These tokens insert existing parameter-aware descriptions, never executable expressions. */
export function combatTagWordingIsValid(text: string, field: 'name' | 'full' | 'compact'): boolean {
  const tokens = field === 'name' ? [] : field === 'full' ? ['details', 'summary'] : ['summary']
  let count = 0
  const remainder = text.replace(/\{([a-z]+)\}/gu, (token, name: string) => {
    count++
    return tokens.includes(name) ? '' : token
  })
  return count <= 4 && !/[<>{}]/u.test(remainder)
}

export function renderCombatTagWording(
  template: string,
  generated: { readonly details: string; readonly summary: string },
): string {
  return template.replace(
    /\{(details|summary)\}/gu,
    (_token, name: 'details' | 'summary') => generated[name],
  )
}
