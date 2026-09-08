export type FoundationAttributeId =
  'might' | 'finesse' | 'vitality' | 'agility' | 'intellect' | 'resolve'

export type FoundationStartingAttributeBonuses = Readonly<Record<FoundationAttributeId, number>>

export const FOUNDATION_DISCIPLINES = [
  {
    id: 'vanguard',
    name: 'Vanguard',
    summary: 'Balanced armed combat. Focus: Might and Vitality.',
    focusAttributes: ['might', 'vitality'],
    startingAttributeBonuses: {
      might: 3,
      finesse: 0,
      vitality: 3,
      agility: 0,
      intellect: 0,
      resolve: 0,
    },
  },
  {
    id: 'farstrider',
    name: 'Farstrider',
    summary: 'Ranged combat and battlefield awareness. Focus: Finesse and Agility.',
    focusAttributes: ['finesse', 'agility'],
    startingAttributeBonuses: {
      might: 0,
      finesse: 4,
      vitality: 0,
      agility: 2,
      intellect: 0,
      resolve: 0,
    },
  },
  {
    id: 'shadehand',
    name: 'Shadehand',
    summary: 'Mobility, trickery, and opportunism. Focus: Finesse and Agility.',
    focusAttributes: ['finesse', 'agility'],
    startingAttributeBonuses: {
      might: 0,
      finesse: 2,
      vitality: 0,
      agility: 4,
      intellect: 0,
      resolve: 0,
    },
  },
  {
    id: 'ironfist',
    name: 'Ironfist',
    summary: 'Unarmed martial combat. Focus: Might and Agility.',
    focusAttributes: ['might', 'agility'],
    startingAttributeBonuses: {
      might: 4,
      finesse: 0,
      vitality: 0,
      agility: 2,
      intellect: 0,
      resolve: 0,
    },
  },
  {
    id: 'aetherist',
    name: 'Aetherist',
    summary: 'Foundation offensive magic. Focus: Intellect and Resolve.',
    focusAttributes: ['intellect', 'resolve'],
    startingAttributeBonuses: {
      might: 0,
      finesse: 0,
      vitality: 0,
      agility: 0,
      intellect: 4,
      resolve: 2,
    },
  },
  {
    id: 'lifebinder',
    name: 'Lifebinder',
    summary: 'Foundation healing and support magic. Focus: Intellect and Resolve.',
    focusAttributes: ['intellect', 'resolve'],
    startingAttributeBonuses: {
      might: 0,
      finesse: 0,
      vitality: 0,
      agility: 0,
      intellect: 2,
      resolve: 4,
    },
  },
] as const satisfies readonly {
  id: string
  name: string
  summary: string
  focusAttributes: readonly FoundationAttributeId[]
  startingAttributeBonuses: FoundationStartingAttributeBonuses
}[]

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
