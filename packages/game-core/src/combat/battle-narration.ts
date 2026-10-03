import { PRONOUN_PRESETS, type PronounPresetId } from '../character/creation'

export interface SkillNarrationTemplate {
  hit?: string
  miss?: string
  critical?: string
}

export const SKILL_NARRATION_TOKENS = ['actor', 'target', 'ability', 'damage'] as const
export type SkillNarrationToken = (typeof SKILL_NARRATION_TOKENS)[number]

const TOKEN_PATTERN = /\{([a-zA-Z][a-zA-Z0-9_.-]*)\}/gu
const MAX_NARRATION_LENGTH = 180

export function skillNarrationVariantIssues(template: string): readonly string[] {
  const value = template.trim()
  const issues: string[] = []
  if (!value) issues.push('Narration cannot be blank.')
  if (value.length > MAX_NARRATION_LENGTH) {
    issues.push(`Narration must be ${MAX_NARRATION_LENGTH} characters or fewer.`)
  }

  const allowed = new Set<string>(SKILL_NARRATION_TOKENS)
  for (const match of value.matchAll(TOKEN_PATTERN)) {
    const token = match[1]
    if (token && !allowed.has(token)) issues.push(`Unknown narration token: {${token}}.`)
  }
  return issues
}

export function isSkillNarrationVariantValid(template: string | undefined): boolean {
  return template !== undefined && skillNarrationVariantIssues(template).length === 0
}

export function validateSkillNarrationTemplate(
  narration: SkillNarrationTemplate | undefined,
): readonly string[] {
  if (!narration) return []
  return (['hit', 'miss', 'critical'] as const).flatMap((variant) => {
    const template = narration[variant]
    return template === undefined
      ? []
      : skillNarrationVariantIssues(template).map((issue) => `${variant}: ${issue}`)
  })
}

/** Flavor is a short story, independent of hit/miss and recorded mechanical quantities. */
export const BATTLE_FLAVOR_TOKENS = [
  'actor',
  'target',
  'ability',
  'actor.subject',
  'actor.object',
  'actor.possessive',
  'actor.reflexive',
  'target.subject',
  'target.object',
  'target.possessive',
  'target.reflexive',
] as const

export interface BattleNarratorIdentity {
  readonly name?: string
  readonly pronounPresetId?: PronounPresetId
  /** Explicit narrative identity only; never derive this from portrait or appearance. */
  readonly gender?: 'masculine' | 'feminine' | 'neutral'
}

export interface BattleFlavorTemplateContext {
  readonly actor?: BattleNarratorIdentity
  readonly target?: BattleNarratorIdentity
  readonly ability: string
}

const FLAVOR_TOKEN_PATTERN = /\{([^{}]+)\}/gu
const GENDER_TOKEN_PATTERN = /^(actor|target)\.gender:([^{}|]+)\|([^{}|]+)\|([^{}|]+)$/u

export function battleFlavorTemplateIssues(template: unknown): readonly string[] {
  if (typeof template !== 'string') return ['Narration must be text.']
  const issues: string[] = []
  if (!template.trim()) issues.push('Narration cannot be blank.')
  if (template.length > 160) issues.push('Narration must be 160 characters or fewer.')
  if (/[<>]/u.test(template) || [...template].some((character) => character.charCodeAt(0) < 32))
    issues.push('Narration must be one plain-text line.')
  const allowed = new Set<string>(BATTLE_FLAVOR_TOKENS)
  for (const match of template.matchAll(FLAVOR_TOKEN_PATTERN)) {
    const token = match[1]!
    if (!allowed.has(token) && !GENDER_TOKEN_PATTERN.test(token)) {
      issues.push(`Unknown narration token: {${token}}.`)
    }
  }
  if (/[{}]/u.test(template.replace(FLAVOR_TOKEN_PATTERN, '')))
    issues.push('Malformed narration token.')
  return issues
}

/** Missing immutable identity metadata is deliberately neutral. No current profile lookup. */
export function renderBattleFlavorTemplate(
  template: string | null | undefined,
  context: BattleFlavorTemplateContext,
): string | null {
  if (battleFlavorTemplateIssues(template).length > 0 || typeof template !== 'string') return null
  return template.replace(FLAVOR_TOKEN_PATTERN, (_match, token: string) => {
    if (token === 'ability') return context.ability
    const gender = token.match(GENDER_TOKEN_PATTERN)
    if (gender) {
      const identity = gender[1] === 'actor' ? context.actor : context.target
      return gender[identity?.gender === 'masculine' ? 2 : identity?.gender === 'feminine' ? 3 : 4]!
    }
    const [role, field] = token.split('.')
    const identity = role === 'actor' ? context.actor : context.target
    if (!field) return identity?.name?.trim() || 'Combatant'
    const pronouns =
      PRONOUN_PRESETS.find((preset) => preset.id === identity?.pronounPresetId) ??
      PRONOUN_PRESETS.find((preset) => preset.id === 'they_them')!
    switch (field) {
      case 'subject':
        return pronouns.subject
      case 'object':
        return pronouns.object
      case 'possessive':
        return pronouns.possessiveAdjective
      case 'reflexive':
        return pronouns.reflexive
      default:
        return '' // Validation admits only the fields above.
    }
  })
}
