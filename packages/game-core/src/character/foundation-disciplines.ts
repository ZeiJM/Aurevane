export const FOUNDATION_DISCIPLINES = [
  {
    id: 'vanguard',
    name: 'Vanguard',
    summary: 'Balanced armed combat.',
  },
  {
    id: 'farstrider',
    name: 'Farstrider',
    summary: 'Ranged combat and battlefield awareness.',
  },
  {
    id: 'shadehand',
    name: 'Shadehand',
    summary: 'Mobility, trickery, and opportunism.',
  },
  {
    id: 'ironfist',
    name: 'Ironfist',
    summary: 'Unarmed martial combat.',
  },
  {
    id: 'aetherist',
    name: 'Aetherist',
    summary: 'Foundation offensive magic.',
  },
  {
    id: 'lifebinder',
    name: 'Lifebinder',
    summary: 'Foundation healing and support magic.',
  },
] as const

export type FoundationDiscipline = (typeof FOUNDATION_DISCIPLINES)[number]
export type FoundationDisciplineId = FoundationDiscipline['id']

const foundationDisciplineIds = new Set<string>(
  FOUNDATION_DISCIPLINES.map((discipline) => discipline.id),
)

export function isFoundationDisciplineId(value: string): value is FoundationDisciplineId {
  return foundationDisciplineIds.has(value)
}

export function getFoundationDiscipline(value: string): FoundationDiscipline | null {
  return FOUNDATION_DISCIPLINES.find((discipline) => discipline.id === value) ?? null
}
