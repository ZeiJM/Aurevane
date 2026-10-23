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

  if (
    /[<>]/u.test(template) ||
    [...template].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    issues.push('Narration must be one plain-text line.')
  if (/[{}]/u.test(template.replace(TOKEN_PATTERN, ''))) issues.push('Malformed narration token.')
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
  /** Viewer-authorized recipients only; omission is distinct from an empty result. */
  readonly affectedTargets?: readonly BattleNarratorIdentity[]
  readonly triggeringActor?: BattleNarratorIdentity
  /** Values extracted from the exact definition, never client-supplied combat outcomes. */
  readonly values?: Readonly<Record<string, number>>
  readonly outcomes?: { readonly damage?: number; readonly healing?: number }
}

export type BattleTextField = 'public' | 'compact' | 'activation' | 'result'
export interface BattleTextReferenceContext {
  readonly field: BattleTextField
  readonly values?: Readonly<Record<string, number>>
  readonly triggeringActor?: boolean
  readonly affectedTargets?: boolean
  readonly outcomes?: readonly ('damage' | 'healing')[]
}
export interface BattleTextReferenceChoice {
  readonly token: string
  readonly label: string
}
const VALUE_TOKEN =
  /^value\.([0-9]{1,2})\.(power|duration|tiles|percentage|stacks|applications|resource)$/u
const CONTEXT_TOKENS = [
  'targets',
  'targets.count',
  'targets.subject',
  'targets.object',
  'targets.possessive',
  'targets.reflexive',
  'targets.be',
  'trigger',
  'trigger.subject',
  'trigger.object',
  'trigger.possessive',
  'trigger.reflexive',
  'outcome.damage',
  'outcome.healing',
] as const

/** Human labels are UI guidance; token identities are interpreted only in this module. */
export function battleTextReferenceChoices(
  context: BattleTextReferenceContext,
): readonly BattleTextReferenceChoice[] {
  const choices: BattleTextReferenceChoice[] = BATTLE_FLAVOR_TOKENS.map((token) => ({
    token,
    label: token
      .replace(/^actor/u, 'User')
      .replace(/^target/u, 'Selected Target')
      .replace(/^ability$/u, 'Ability')
      .replace('.', ' · '),
  }))
  if (context.affectedTargets)
    choices.push(
      ...CONTEXT_TOKENS.filter((token) => token.startsWith('targets')).map((token) => ({
        token,
        label: token.replace('targets', 'Affected Targets').replace('.', ' · '),
      })),
    )
  if (context.triggeringActor)
    choices.push(
      ...CONTEXT_TOKENS.filter((token) => token.startsWith('trigger')).map((token) => ({
        token,
        label: token.replace('trigger', 'Triggering actor').replace('.', ' · '),
      })),
    )
  for (const [key, value] of Object.entries(context.values ?? {})) {
    const match = `value.${key}`.match(VALUE_TOKEN)
    if (match && Number.isFinite(value))
      choices.push({ token: `value.${key}`, label: `Effect ${Number(match[1]) + 1} · ${match[2]}` })
  }
  if (context.field === 'result')
    for (const outcome of context.outcomes ?? [])
      choices.push({ token: `outcome.${outcome}`, label: `Actual ${outcome}` })
  return choices
}

/** Context validity is separate from syntax and never claims to verify arbitrary English. */
export function battleTextContextIssues(
  template: string,
  context: BattleTextReferenceContext,
  maximum = 160,
): readonly string[] {
  const issues = [...battleFlavorTemplateIssues(template, maximum)]
  const allowed = new Set(battleTextReferenceChoices(context).map((choice) => choice.token))
  for (const match of template.matchAll(FLAVOR_TOKEN_PATTERN)) {
    if (!allowed.has(match[1]!) && !GENDER_TOKEN_PATTERN.test(match[1]!))
      issues.push(`Reference {${match[1]}} is unavailable in this ${context.field} context.`)
  }
  return [...new Set(issues)]
}

const FLAVOR_TOKEN_PATTERN = /\{([^{}]+)\}/gu
const GENDER_TOKEN_PATTERN = /^(actor|target)\.gender:([^{}|]+)\|([^{}|]+)\|([^{}|]+)$/u

export function battleFlavorTemplateIssues(template: unknown, maximum = 160): readonly string[] {
  if (typeof template !== 'string') return ['Narration must be text.']
  const issues: string[] = []
  if (!template.trim()) issues.push('Narration cannot be blank.')
  if (template.length > maximum) issues.push(`Narration must be ${maximum} characters or fewer.`)
  if (
    /[<>]/u.test(template) ||
    [...template].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    issues.push('Narration must be one plain-text line.')
  const allowed = new Set<string>(BATTLE_FLAVOR_TOKENS)
  for (const match of template.matchAll(FLAVOR_TOKEN_PATTERN)) {
    const token = match[1]!
    if (
      !allowed.has(token) &&
      !CONTEXT_TOKENS.includes(token as (typeof CONTEXT_TOKENS)[number]) &&
      !VALUE_TOKEN.test(token) &&
      !GENDER_TOKEN_PATTERN.test(token)
    ) {
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
  maximum = 160,
): string | null {
  if (battleFlavorTemplateIssues(template, maximum).length > 0 || typeof template !== 'string')
    return null
  // Refuse the whole message when a required fact is absent. Never substitute fabricated zeros.
  for (const match of template.matchAll(FLAVOR_TOKEN_PATTERN)) {
    const token = match[1]!
    if (token.startsWith('trigger') && !context.triggeringActor) return null
    if (token.startsWith('targets') && !context.affectedTargets) return null
    if (token.startsWith('value.') && !Number.isFinite(context.values?.[token.slice(6)]))
      return null
    if (token.startsWith('outcome.')) {
      const value = context.outcomes?.[token.slice(8) as 'damage' | 'healing']
      if (value === undefined || !Number.isFinite(value) || value < 0) return null
    }
  }
  return template.replace(FLAVOR_TOKEN_PATTERN, (_match, token: string) => {
    if (token.startsWith('value.')) return String(context.values![token.slice(6)])
    if (token.startsWith('outcome.'))
      return String(context.outcomes![token.slice(8) as 'damage' | 'healing'])
    if (token.startsWith('targets')) {
      const targets = context.affectedTargets!
      if (token === 'targets.count') return String(targets.length)
      if (token === 'targets') {
        const names = targets.map((target) => target.name?.trim() || 'Combatant')
        return names.length === 0
          ? 'no targets'
          : names.length === 1
            ? names[0]!
            : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
      }
      const singular = targets.length === 1 ? targets[0] : undefined
      const pronouns = PRONOUN_PRESETS.find((preset) => preset.id === singular?.pronounPresetId)
      const field = token.slice(8)
      if (field === 'be') return singular && pronouns && pronouns.subject !== 'they' ? 'is' : 'are'
      if (!singular)
        return (
          {
            subject: 'they',
            object: 'them',
            possessive: 'their',
            reflexive: 'themselves',
          } as Record<string, string>
        )[field]!
      token = `target.${field}`
      return renderBattleFlavorTemplate(`{${token}}`, {
        ability: context.ability,
        target: singular,
      })!
    }

    if (token === 'ability') return context.ability
    const gender = token.match(GENDER_TOKEN_PATTERN)
    if (gender) {
      const identity = gender[1] === 'actor' ? context.actor : context.target
      return gender[identity?.gender === 'masculine' ? 2 : identity?.gender === 'feminine' ? 3 : 4]!
    }
    const [role, field] = token.split('.')
    const identity =
      role === 'actor'
        ? context.actor
        : role === 'trigger'
          ? context.triggeringActor
          : context.target
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

/** Action prose derived only from the exact pinned definition; amounts stay in recorded outcomes. */
export function defaultSkillBattleText(definition: {
  readonly sourceDisciplineId?: string
  readonly effects: readonly { readonly type: string }[]
  readonly summonProfile?: { readonly name: string }
}): string {
  if (Object.hasOwn(definition, 'ability')) return '{actor} uses {ability}.'
  if (definition.summonProfile)
    return definition.sourceDisciplineId === 'wildwarden'
      ? `{actor} calls upon {actor.possessive} bond with nature to bring forth ${definition.summonProfile.name}.`
      : `{actor} calls upon ${definition.summonProfile.name}.`
  const discipline = definition.sourceDisciplineId?.replace(/[._-]/gu, ' ')
  const force = discipline ? `${discipline} power` : '{actor.possessive} strength'
  if (definition.effects.some((effect) => effect.type === 'damage'))
    return `{actor} channels ${force} into {ability}.`
  if (
    definition.effects.some(
      (effect) =>
        effect.type === 'healing' ||
        (effect.type === 'percentage-recovery' && 'resource' in effect && effect.resource === 'hp'),
    )
  )
    return `{actor} draws on ${force} to weave {ability}.`
  return '{actor} calls upon {ability}.'
}

export type AbilityPresentationText = Readonly<Partial<Record<BattleTextField, string>>>
export const ABILITY_PRESENTATION_TEXT_LIMITS = {
  public: 2000,
  compact: 240,
  activation: 160,
  result: 160,
} as const
const presentationRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
function presentationPayloads(value: unknown): readonly Record<string, unknown>[] {
  const row = presentationRecord(value)
  if (!row) return []
  const ability = presentationRecord(row.ability) ?? row
  if (Array.isArray(ability.behaviors))
    return ability.behaviors.flatMap((group) => {
      const effects = presentationRecord(group)?.effects
      return Array.isArray(effects)
        ? effects.flatMap((effect) => {
            const payload = presentationRecord(presentationRecord(effect)?.payload)
            return payload ? [payload] : []
          })
        : []
    })
  const effects = row.effects ?? presentationRecord(row.trigger)?.resultEffects
  return Array.isArray(effects)
    ? effects.flatMap((effect) => (presentationRecord(effect) ? [presentationRecord(effect)!] : []))
    : []
}
/** Finite public payload fields only. No recursive numeric scan or Accuracy-derived values. */
export function abilityPresentationValues(value: unknown): Readonly<Record<string, number>> {
  const values: Record<string, number> = {}
  for (const [index, effect] of presentationPayloads(value).slice(0, 100).entries()) {
    const put = (unit: string, candidate: unknown, divisor = 1) => {
      if (typeof candidate === 'number' && Number.isFinite(candidate))
        values[`${index}.${unit}`] = candidate / divisor
    }
    if (['damage', 'pierce', 'healing'].includes(String(effect.type)))
      put('power', effect.power ?? effect.amount)
    if (effect.type === 'barrier-change')
      put(effect.basis === 'maximum-hp-percent' ? 'percentage' : 'power', effect.amount)
    put('duration', effect.durationTurns)
    if (effect.type === 'move') put('tiles', effect.maximumTiles)
    if (effect.type === 'displace') put('tiles', effect.distance)
    put('applications', effect.ticks)
    if (effect.type === 'percentage-recovery')
      put(
        'percentage',
        effect.percentageBasisPoints ??
          (typeof effect.percent === 'number' ? effect.percent * 100 : undefined),
        100,
      )
    if (effect.type === 'apply-status') {
      put('stacks', effect.stacks)
      put('percentage', effect.potencyBasisPoints, 100)
    }
    if (effect.type === 'resource-change') put('resource', effect.delta)
  }
  return values
}
export function abilityPresentationContext(
  value: unknown,
  field: BattleTextField,
): BattleTextReferenceContext {
  const payloads = presentationPayloads(value)
  const types = payloads.map((effect) => effect.type)
  const row = presentationRecord(value)
  const behaviors = presentationRecord(row?.ability)?.behaviors
  const triggeringActor =
    field === 'activation' &&
    Array.isArray(behaviors) &&
    behaviors.some((group) => presentationRecord(group)?.activation === 'automatic')
  return {
    field,
    triggeringActor,
    values: abilityPresentationValues(value),
    affectedTargets: field === 'result',
    outcomes:
      field === 'result'
        ? [
            ...(types.some((type) => type === 'damage' || type === 'pierce')
              ? ['damage' as const]
              : []),
            ...(payloads.some(
              (effect) =>
                effect.type === 'healing' ||
                (effect.type === 'percentage-recovery' && effect.resource === 'hp'),
            )
              ? ['healing' as const]
              : []),
          ]
        : [],
  }
}
export function abilityPresentationTextIssues(value: unknown): readonly string[] {
  const row = presentationRecord(value)
  if (!row || row.presentation === undefined) return []
  const text = presentationRecord(row.presentation)
  if (!text) return ['presentation']
  return Object.entries(text).flatMap(([field, template]) => {
    if (!Object.hasOwn(ABILITY_PRESENTATION_TEXT_LIMITS, field)) return [`presentation.${field}`]
    return typeof template !== 'string' ||
      battleTextContextIssues(
        template,
        abilityPresentationContext(value, field as BattleTextField),
        ABILITY_PRESENTATION_TEXT_LIMITS[field as BattleTextField],
      ).length
      ? [`presentation.${field}`]
      : []
  })
}
/** The same exact definition feeds full/compact readers and contextual recorded messages. */
export function renderAbilityPresentationText(
  value: unknown,
  field: BattleTextField,
  context: BattleFlavorTemplateContext,
): string | null {
  const template = presentationRecord(presentationRecord(value)?.presentation)?.[field]
  if (
    typeof template !== 'string' ||
    battleTextContextIssues(
      template,
      abilityPresentationContext(value, field),
      ABILITY_PRESENTATION_TEXT_LIMITS[field],
    ).length
  )
    return null
  return renderBattleFlavorTemplate(
    template,
    { ...context, values: abilityPresentationValues(value) },
    ABILITY_PRESENTATION_TEXT_LIMITS[field],
  )
}
