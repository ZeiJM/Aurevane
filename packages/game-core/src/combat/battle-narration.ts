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
