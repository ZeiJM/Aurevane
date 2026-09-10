export type FoundationAttributeId =
  'might' | 'finesse' | 'vitality' | 'agility' | 'intellect' | 'resolve'

export type FoundationBaseAttributes = Readonly<Record<FoundationAttributeId, number>>
export type FoundationStartingAttributeBonuses = Readonly<Record<FoundationAttributeId, number>>

/**
 * Primary Disciplines own 31 fixed core-stat points. Five additional creation points are personal
 * to the character, keeping the established Level-1 effective total at 36.
 */
export const FOUNDATION_DISCIPLINE_BASE_ATTRIBUTE_TOTAL = 31 as const

export const FOUNDATION_DISCIPLINES = [
  {
    id: 'vanguard',
    name: 'Vanguard',
    summary: 'Balanced armed combat. Focus: Might, Vitality, and Resolve.',
    focusAttributes: ['might', 'vitality', 'resolve'],
    baseAttributes: {
      might: 7,
      finesse: 4,
      vitality: 7,
      agility: 4,
      intellect: 3,
      resolve: 6,
    },
    startingAttributeBonuses: {
      might: 2,
      finesse: 0,
      vitality: 2,
      agility: 0,
      intellect: 0,
      resolve: 1,
    },
  },
  {
    id: 'farstrider',
    name: 'Farstrider',
    summary: 'Ranged combat and battlefield awareness. Focus: Finesse and Agility.',
    focusAttributes: ['finesse', 'agility'],
    baseAttributes: {
      might: 3,
      finesse: 8,
      vitality: 4,
      agility: 8,
      intellect: 4,
      resolve: 4,
    },
    startingAttributeBonuses: {
      might: 0,
      finesse: 3,
      vitality: 0,
      agility: 2,
      intellect: 0,
      resolve: 0,
    },
  },
  {
    id: 'shadehand',
    name: 'Shadehand',
    summary: 'Mobility, trickery, and opportunism. Focus: Finesse, Agility, and Intellect.',
    focusAttributes: ['finesse', 'agility', 'intellect'],
    baseAttributes: {
      might: 3,
      finesse: 7,
      vitality: 3,
      agility: 8,
      intellect: 6,
      resolve: 4,
    },
    startingAttributeBonuses: {
      might: 0,
      finesse: 2,
      vitality: 0,
      agility: 2,
      intellect: 1,
      resolve: 0,
    },
  },
  {
    id: 'ironfist',
    name: 'Ironfist',
    summary: 'Unarmed martial combat. Focus: Might and Agility.',
    focusAttributes: ['might', 'agility'],
    baseAttributes: {
      might: 8,
      finesse: 4,
      vitality: 5,
      agility: 8,
      intellect: 2,
      resolve: 4,
    },
    startingAttributeBonuses: {
      might: 3,
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
    baseAttributes: {
      might: 2,
      finesse: 3,
      vitality: 4,
      agility: 3,
      intellect: 10,
      resolve: 9,
    },
    startingAttributeBonuses: {
      might: 0,
      finesse: 0,
      vitality: 0,
      agility: 0,
      intellect: 3,
      resolve: 2,
    },
  },
  {
    id: 'lifebinder',
    name: 'Lifebinder',
    summary: 'Foundation healing and support magic. Focus: Intellect, Resolve, and Vitality.',
    focusAttributes: ['intellect', 'resolve', 'vitality'],
    baseAttributes: {
      might: 2,
      finesse: 3,
      vitality: 6,
      agility: 3,
      intellect: 8,
      resolve: 9,
    },
    startingAttributeBonuses: {
      might: 0,
      finesse: 0,
      vitality: 1,
      agility: 0,
      intellect: 2,
      resolve: 2,
    },
  },
] as const satisfies readonly {
  id: string
  name: string
  summary: string
  focusAttributes: readonly FoundationAttributeId[]
  baseAttributes: FoundationBaseAttributes
  /** Recommended placement of the five personal creation points; never part of the fixed base. */
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
