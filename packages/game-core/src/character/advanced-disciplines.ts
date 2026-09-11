import type { FoundationAttributeId, FoundationBaseAttributes } from './foundation-disciplines'

export interface AdvancedDiscipline {
  id: string
  name: string
  summary: string
  focusAttributes: readonly FoundationAttributeId[]
  baseAttributes: FoundationBaseAttributes
  prerequisites: readonly { disciplineId: string; minimumStage: number }[]
}
function discipline(
  id: string,
  name: string,
  summary: string,
  focusAttributes: readonly FoundationAttributeId[],
  attributes: readonly [number, number, number, number, number, number],
  prerequisites: AdvancedDiscipline['prerequisites'],
): AdvancedDiscipline {
  const [might, finesse, vitality, agility, intellect, resolve] = attributes
  return {
    id,
    name,
    summary,
    focusAttributes,
    baseAttributes: { might, finesse, vitality, agility, intellect, resolve },
    prerequisites,
  }
}
const requires = (disciplineId: string, minimumStage: number) => ({ disciplineId, minimumStage })
/** Mastery stages: Initiate 1, Practiced 2, Adept 3, Expert 4, Master 5. */
export const ADVANCED_DISCIPLINES: readonly AdvancedDiscipline[] = [
  discipline(
    'bastion',
    'Bastion',
    'Protect allies and limit enemy pressure. Focus: Vitality and Resolve.',
    ['vitality', 'resolve'],
    [5, 3, 10, 3, 2, 8],
    [requires('vanguard', 3)],
  ),
  discipline(
    'ravager',
    'Ravager',
    'Bleeding pressure and dangerous offensive commitment. Focus: Might and Vitality.',
    ['might', 'vitality'],
    [10, 4, 8, 4, 2, 3],
    [requires('vanguard', 3)],
  ),
  discipline(
    'edgedancer',
    'Edgedancer',
    'Precise melee, facing and openings. Focus: Finesse and Agility.',
    ['finesse', 'agility'],
    [5, 9, 4, 8, 2, 3],
    [requires('vanguard', 2), requires('shadehand', 2)],
  ),
  discipline(
    'wildwarden',
    'Wildwarden',
    'Control a quarry through snares, marks and attrition. Focus: Finesse, Agility and Resolve.',
    ['finesse', 'agility', 'resolve'],
    [3, 8, 5, 7, 2, 6],
    [requires('farstrider', 3)],
  ),
  discipline(
    'runeblade',
    'Runeblade',
    'Mix melee with mystic pressure and resource control. Focus: Might and Intellect.',
    ['might', 'intellect'],
    [8, 4, 5, 3, 8, 3],
    [requires('vanguard', 2), requires('aetherist', 2)],
  ),
  discipline(
    'dawnshield',
    'Dawnshield',
    'Guard, cleanse and restore nearby allies. Focus: Vitality, Intellect and Resolve.',
    ['vitality', 'intellect', 'resolve'],
    [4, 2, 8, 3, 7, 7],
    [requires('vanguard', 3), requires('lifebinder', 3)],
  ),
  discipline(
    'cinderweaver',
    'Cinderweaver',
    'Burn enemies and exploit their exposure to fire. Focus: Intellect and Resolve.',
    ['intellect', 'resolve'],
    [2, 3, 4, 4, 11, 7],
    [requires('aetherist', 2)],
  ),
  discipline(
    'frostweaver',
    'Frostweaver',
    'Restrict movement and shatter rooted targets. Focus: Intellect and Resolve.',
    ['intellect', 'resolve'],
    [2, 3, 5, 3, 10, 8],
    [requires('aetherist', 2)],
  ),
  discipline(
    'stormsinger',
    'Stormsinger',
    'Control lanes and disrupt enemy resources. Focus: Agility and Intellect.',
    ['agility', 'intellect'],
    [2, 4, 4, 8, 9, 4],
    [requires('aetherist', 2), requires('farstrider', 1)],
  ),
  discipline(
    'tidecaller',
    'Tidecaller',
    'Combine cleansing and restoration with movement control. Focus: Intellect and Resolve.',
    ['intellect', 'resolve'],
    [2, 3, 5, 3, 9, 9],
    [requires('aetherist', 2), requires('lifebinder', 1)],
  ),
]
