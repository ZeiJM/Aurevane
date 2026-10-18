import {
  isMechanicTag,
  plainMechanicText,
  type MechanicTextPart,
} from '@/components/character/mechanic-text'
import type { CompactSkillEffectSummaryParts } from '@/components/character/skill-detail-presentation'
import type { BattleAbilityBehaviorReport } from '@/lib/battle/battle-basic-actions'

export type ManualInlinePart =
  | string
  | { readonly kind: 'references'; readonly parts: readonly MechanicTextPart[] }
  | { readonly kind: 'effect'; readonly parts: CompactSkillEffectSummaryParts }

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function references(value: unknown): value is readonly MechanicTextPart[] {
  return (
    Array.isArray(value) &&
    value.every(
      (part) =>
        typeof part === 'string' ||
        (record(part) &&
          typeof part.tag === 'string' &&
          isMechanicTag(part.tag) &&
          typeof part.label === 'string' &&
          part.label.length > 0 &&
          (part.explanation === undefined || typeof part.explanation === 'string')),
    )
  )
}
function effect(value: unknown): value is CompactSkillEffectSummaryParts {
  return (
    record(value) &&
    typeof value.label === 'string' &&
    (value.magnitude === null || typeof value.magnitude === 'string') &&
    (value.duration === null || typeof value.duration === 'string') &&
    (value.timing === undefined ||
      (typeof value.timing === 'string' &&
        ['Instant', 'Delayed', 'Controlled'].includes(value.timing))) &&
    (value.details === undefined ||
      (Array.isArray(value.details) &&
        value.details.every(
          (detail) =>
            record(detail) &&
            typeof detail.label === 'string' &&
            typeof detail.value === 'string' &&
            (detail.labelParts === undefined || references(detail.labelParts)),
        )))
  )
}
function effectText(parts: CompactSkillEffectSummaryParts): string {
  return (
    parts.label +
    (parts.magnitude ? ' [' + parts.magnitude + ']' : '') +
    (parts.duration ? ' [' + parts.duration + ']' : '') +
    (parts.timing ? ' [' + parts.timing + ']' : '') +
    (parts.details?.map((detail) => ' [' + detail.label + ': ' + detail.value + ']').join('') ?? '')
  )
}
/** Reject stale or unsupported optional metadata before rendering any part of its bullet. */
export function plainManualInlineParts(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  const result: string[] = []
  for (const part of value) {
    if (typeof part === 'string') result.push(part)
    else if (record(part) && part.kind === 'references' && references(part.parts))
      result.push(plainMechanicText(part.parts))
    else if (record(part) && part.kind === 'effect' && effect(part.parts))
      result.push(effectText(part.parts))
    else return null
  }
  return result.join('')
}
function linked(text: string, parts?: readonly MechanicTextPart[]): ManualInlinePart[] {
  return parts && references(parts) && plainMechanicText(parts) === text
    ? [{ kind: 'references', parts }]
    : [text]
}
/** Preserve the existing compact article grammar using only the shared typed report. */
export function abilityManualInlineParts(
  report: BattleAbilityBehaviorReport,
  label: string,
  selfOnly: boolean,
): ManualInlinePart[] {
  const result: ManualInlinePart[] = [label + '. ']
  report.rows.forEach(([key, value], index) => {
    if (index) result.push('. ')
    result.push(key + ': ')
    if (key === 'Requirements') result.push(...linked(value, report.requirementParts))
    else if (key === 'Effects') {
      const effects: ManualInlinePart[] = []
      report.effects.forEach((entry, index) => {
        if (index) effects.push(', ')
        if (entry.condition)
          effects.push('If ', ...linked(entry.condition, entry.conditionParts), ': ')
        effects.push({ kind: 'effect', parts: entry.parts })
        if (!(selfOnly && entry.recipient === 'Self')) effects.push(' → ' + entry.recipient)
        if (entry.repeatsOnEntry) effects.push(' · Repeats on entry')
      })
      result.push(...(plainManualInlineParts(effects) === value ? effects : [value]))
    } else result.push(value)
  })
  result.push('. ')
  const tail: ManualInlinePart[][] = [
    ...report.limits.map((limit) => [limit]),
    ...(report.maintenance ? [[report.maintenance]] : []),
    ...report.effectDescriptions.map((text, index) =>
      linked(text, report.effects[index]?.explanationParts),
    ),
  ]
  tail.forEach((parts, index) => {
    if (index) result.push(' ')
    result.push(...parts)
  })
  return result
}
