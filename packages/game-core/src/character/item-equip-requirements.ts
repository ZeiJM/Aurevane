import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributeId,
  type CharacterAttributes,
} from './creation'
export interface ItemEquipRequirements {
  readonly minimumLevel?: number
  readonly disciplineIds?: readonly string[]
  readonly minimumCoreStats?: Readonly<Partial<Record<CharacterAttributeId, number>>>
}
/** These facts come from the character/build, before equipment stat bonuses. */
export interface ItemEquipContext {
  readonly level: number
  readonly disciplineIds: readonly string[]
  readonly baseCoreStats: Readonly<CharacterAttributes>
  readonly disciplineNames?: Readonly<Record<string, string>>
}
const label = (id: string) => id.charAt(0).toUpperCase() + id.slice(1)
export function parseItemEquipRequirements(value: unknown): ItemEquipRequirements {
  const bad = (): never => {
    throw new TypeError(
      'equipRequirements: Choose valid optional minimum level, disciplines and base Core stats.',
    )
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad()
  const row = value as Record<string, unknown>
  if (
    Object.keys(row).some(
      (key) => !['minimumLevel', 'disciplineIds', 'minimumCoreStats'].includes(key),
    )
  )
    bad()
  const minimum = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 1
  if (row.minimumLevel !== undefined && !minimum(row.minimumLevel)) bad()
  if (
    row.disciplineIds !== undefined &&
    (!Array.isArray(row.disciplineIds) ||
      !row.disciplineIds.length ||
      new Set(row.disciplineIds).size !== row.disciplineIds.length ||
      row.disciplineIds.some(
        (id) =>
          typeof id !== 'string' || id.length > 160 || !/^[a-z0-9]+([._-][a-z0-9]+)*$/u.test(id),
      ))
  )
    bad()
  if (row.minimumCoreStats !== undefined) {
    if (
      !row.minimumCoreStats ||
      typeof row.minimumCoreStats !== 'object' ||
      Array.isArray(row.minimumCoreStats)
    )
      bad()
    if (
      Object.entries(row.minimumCoreStats as object).some(
        ([key, n]) => !CHARACTER_ATTRIBUTE_IDS.includes(key as CharacterAttributeId) || !minimum(n),
      )
    )
      bad()
  }
  return structuredClone(row) as ItemEquipRequirements
}
export function itemEquipRequirementSummaries(
  requirements?: ItemEquipRequirements,
  disciplineNames: Readonly<Record<string, string>> = {},
): readonly string[] {
  if (!requirements) return []
  return [
    ...(requirements.minimumLevel === undefined ? [] : [`Level ${requirements.minimumLevel}`]),
    ...(requirements.disciplineIds?.length
      ? [
          `Discipline: ${requirements.disciplineIds.map((id) => disciplineNames[id] ?? id.split(/[._-]/u).map(label).join(' ')).join(' or ')}`,
        ]
      : []),
    ...Object.entries(requirements.minimumCoreStats ?? {}).map(
      ([id, n]) => `Base ${label(id)} ${n}`,
    ),
  ]
}
export function evaluateItemEquipRequirements(
  requirements?: ItemEquipRequirements,
  context?: ItemEquipContext,
): readonly string[] {
  if (!requirements || !itemEquipRequirementSummaries(requirements).length) return []
  if (!context) return ['Character requirements could not be verified.']
  const issues: string[] = []
  if (
    requirements.minimumLevel !== undefined &&
    (!Number.isSafeInteger(context.level) || context.level < requirements.minimumLevel)
  )
    issues.push(`Level ${requirements.minimumLevel} required (current ${context.level}).`)
  if (
    requirements.disciplineIds?.length &&
    !requirements.disciplineIds.some((id) => context.disciplineIds.includes(id))
  )
    issues.push(
      `Equip discipline ${requirements.disciplineIds.map((id) => context.disciplineNames?.[id] ?? id.split(/[._-]/u).map(label).join(' ')).join(' or ')}.`,
    )
  for (const [id, n] of Object.entries(requirements.minimumCoreStats ?? {})) {
    const current = context.baseCoreStats[id as CharacterAttributeId]
    if (!Number.isSafeInteger(current) || current < n)
      issues.push(`Base ${label(id)} ${n} required (current ${current}).`)
  }
  return issues
}
