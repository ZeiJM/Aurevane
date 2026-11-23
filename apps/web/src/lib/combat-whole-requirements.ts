const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const fingerprint = (value: unknown): string =>
  JSON.stringify(value, (_key, entry) =>
    record(entry)
      ? Object.fromEntries(
          Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)),
        )
      : entry,
  )

/** Finds authored packet predicates, not native recipient/defense/removal eligibility. */
export function currentEffectRequirementIssues(value: unknown) {
  const issues: { path: string; code: string; message: string }[] = []
  function visit(entry: unknown, path: string) {
    if (Array.isArray(entry)) entry.forEach((child, index) => visit(child, `${path}[${index}]`))
    else if (record(entry)) {
      if (record(entry.payload) && entry.requirements != null)
        issues.push({
          path: `${path}.requirements`,
          code: 'EFFECT_REQUIREMENT',
          message:
            'Requirements must gate the whole ability. Commit a compatible correction or resolve the retained effect conditions in Details before saving.',
        })
      for (const [key, child] of Object.entries(entry)) visit(child, path ? `${path}.${key}` : key)
    }
  }
  visit(value, '')
  return issues
}

export function effectInflictsOwnPrerequisite(value: unknown): boolean {
  if (!record(value)) return false
  const effect = value
  const requirement = effect.requirements
  const payload = effect.payload
  if (
    record(requirement) &&
    ['all', 'any'].includes(String(requirement.kind)) &&
    Array.isArray(requirement.children)
  )
    return requirement.children.some((child) =>
      effectInflictsOwnPrerequisite({ ...effect, requirements: child }),
    )
  if (
    !record(requirement) ||
    !record(payload) ||
    requirement.kind !== 'status-presence' ||
    requirement.present !== true
  )
    return false
  const status =
    payload.type === 'apply-status'
      ? payload.statusId
      : ['bleed', 'poison', 'burn'].includes(String(payload.type))
        ? payload.type
        : null
  const sameSubject =
    payload.recipient === 'actor'
      ? requirement.subject === 'owner'
      : payload.recipient === 'primary-unit'
        ? ['selected', 'affected'].includes(String(requirement.subject))
        : payload.recipient === 'affected-units' && requirement.subject === 'affected'
  return !!status && status === requirement.statusId && sameSubject
}

/** Deliberately conservative; unsupported frames remain blocked for explicit review. */
function bindsWholeRequirement(node: unknown, behavior: Record<string, unknown>): boolean {
  if (!record(node)) return false
  if (node.kind === 'all' || node.kind === 'any')
    return (
      Array.isArray(node.children) &&
      node.children.length > 0 &&
      node.children.every((child) => bindsWholeRequirement(child, behavior))
    )
  const target = behavior.targeting
  const selected =
    behavior.mode === 'modifier' ||
    (behavior.activation === 'manual' &&
      record(target) &&
      target.kind === 'unit' &&
      record(target.shape) &&
      target.shape.kind === 'single')
  const allowed = (subject: unknown) => subject === 'owner' || (selected && subject === 'selected')
  return (
    (!Object.hasOwn(node, 'subject') || allowed(node.subject)) &&
    (!Object.hasOwn(node, 'otherSubject') || allowed(node.otherSubject))
  )
}

function reviewedCombination(id: string, existing: unknown, conditional: unknown): boolean {
  if (!record(existing) || !record(conditional)) return false
  const subject =
    id === 'shadehand.execution-cut'
      ? 'selected'
      : id === 'ravager.desperate-execution'
        ? 'owner'
        : null
  return (
    !!subject &&
    existing.kind === 'resource-state' &&
    existing.subject === subject &&
    existing.resource === 'hp' &&
    existing.comparison === 'less-than' &&
    existing.basisPoints === 3500 &&
    conditional.kind === 'status-presence' &&
    conditional.subject === subject &&
    conditional.present === true &&
    conditional.statusId === (subject === 'selected' ? 'exposed' : 'reckless')
  )
}

/** Current authoring/release correction only. Captured and exact historical readers never call it. */
export function normalizeWholeAbilityRequirements<T>(input: T): {
  definition: T
  corrections: string[]
  issues: ReturnType<typeof currentEffectRequirementIssues>
} {
  const definition = structuredClone(input)
  const corrections: string[] = []
  function visit(value: unknown, sourceId = '') {
    if (Array.isArray(value)) {
      value.forEach((child) => visit(child, sourceId))
      return
    }
    if (!record(value)) return
    const identity = value.id ?? value.essenceId
    const id = typeof identity === 'string' && record(value.ability) ? identity : sourceId
    if (record(value.ability) && Array.isArray(value.ability.behaviors)) {
      for (const group of value.ability.behaviors) {
        if (!record(group) || !Array.isArray(group.effects)) continue
        for (const effect of group.effects) {
          if (
            record(effect) &&
            record(effect.requirements) &&
            effect.requirements.kind === 'status-presence' &&
            effectInflictsOwnPrerequisite(effect)
          ) {
            delete effect.requirements
            corrections.push(
              `${id}: removed the prerequisite requiring the status inflicted by the same effect.`,
            )
          }
        }
        const retained = group.effects.filter(
          (effect): effect is Record<string, unknown> =>
            record(effect) && effect.requirements != null,
        )
        if (!retained.length || retained.some(effectInflictsOwnPrerequisite)) continue
        const conditions = [
          ...new Map(
            retained.map((effect) => [fingerprint(effect.requirements), effect.requirements]),
          ).values(),
        ]
        if (conditions.length !== 1) continue
        const requirement = conditions[0]
        // Reviewed Close Quarry repair gives its existing selected-unit predicate a real aim.
        if (
          id === 'wildwarden.close-quarry' &&
          record(requirement) &&
          requirement.kind === 'status-presence' &&
          requirement.subject === 'selected' &&
          requirement.statusId === 'mark' &&
          requirement.present === true &&
          record(group.targeting) &&
          group.targeting.kind === 'ground-tile' &&
          group.targeting.maximumRange === 1 &&
          record(group.targeting.shape) &&
          group.targeting.shape.kind === 'single'
        ) {
          group.targeting = {
            ...group.targeting,
            kind: 'unit',
            categories: ['enemy'],
            teamPolicy: 'enemy',
            friendlyFire: 'enemies-only',
          }
          for (const effect of group.effects)
            if (record(effect) && record(effect.payload) && effect.payload.type === 'damage')
              effect.payload.recipient = 'primary-unit'
          value.target = structuredClone(group.targeting)
          if (Array.isArray(value.effects))
            for (const effect of value.effects)
              if (record(effect) && effect.type === 'damage') effect.recipient = 'primary-unit'
          corrections.push(`${id}: restored Enemy Single aim for its selected-target requirement.`)
        }
        if (!bindsWholeRequirement(requirement, group)) continue
        const existing = group.requirements
        if (existing == null || fingerprint(existing) === fingerprint(requirement))
          group.requirements = structuredClone(requirement)
        else if (reviewedCombination(id, existing, requirement)) {
          group.requirements = { kind: 'all', children: [existing, structuredClone(requirement)] }
          delete group.requirementMode
        } else continue
        for (const effect of retained) delete effect.requirements
        corrections.push(`${id}: applied the retained prerequisite to the whole ability.`)
      }
    }
    for (const child of Object.values(value)) visit(child, id)
  }
  visit(definition)
  return { definition, corrections, issues: currentEffectRequirementIssues(definition) }
}
