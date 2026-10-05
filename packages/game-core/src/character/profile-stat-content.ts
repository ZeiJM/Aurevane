import type { CharacterAttributeId } from './creation'
import type { DerivedStatId } from './derived-stats'

export const ATTRIBUTE_PROFILE_HELP: Readonly<Record<CharacterAttributeId, string>> = {
  might:
    'Physical force. Might contributes only to Physical Power. Relative Character Level modifies combat damage separately rather than changing this rating.',
  finesse: 'Precision and technique. Finesse contributes only to Accuracy and Critical Chance.',
  vitality:
    'Endurance and bodily resilience. Vitality contributes only to Maximum HP and Physical Defense.',
  agility:
    'Reflexes, footwork, and mobility. Agility contributes only to Initiative, Movement, Jump, and Evasion.',
  intellect:
    'Mystic understanding and supernatural potency. Intellect contributes only to Maximum MP and Mystic Power. Relative Character Level modifies combat damage separately rather than changing this rating.',
  resolve:
    'Willpower and supernatural steadiness. Resolve contributes only to Mystic Defense and Status Resistance.',
}

export const DERIVED_STAT_PROFILE_HELP: Readonly<Record<DerivedStatId, string>> = {
  maxHp: 'Your current maximum health before temporary battle effects.',
  maxMp: 'Your current maximum MP before temporary battle effects.',
  physicalPower:
    'Physical damage rating from Might. Basic Attack and physical damaging Skills read this rating; relative Character Level then modifies direct combat damage separately.',
  mysticPower:
    'Mystic damage rating from Intellect. Mystic damaging Skills read this rating; relative Character Level then modifies direct combat damage separately.',
  armor: 'Physical Defense rating from Vitality before equipment, statuses, and battle effects.',
  ward: 'Mystic Defense rating from Resolve before equipment, statuses, and battle effects.',
  accuracy:
    'Accuracy rating from Finesse, up to 140%. Subtract target Evasion before clamping the final hit chance to 0–100%; terrain, facing, Skills, and battle effects may modify it.',
  evasion: 'Baseline ability to avoid eligible attacks before battle-specific modifiers.',
  criticalChance:
    'Baseline critical chance from Finesse, capped at 20%, before temporary battle effects.',
  initiative: 'Baseline turn-order influence before battle-specific timing effects.',
  movement:
    'Baseline Movement allowance from Agility, from 2 to 4 entered tiles per turn before temporary modifiers. Terrain changes AP costs rather than the number of entered tiles.',
  jump: 'Baseline elevation reach from Agility, from 0 to 3, before temporary modifiers.',
  statusResistance:
    'Chance from Resolve, up to 15%, to cancel an ordinary Skill’s harmful debuffs on a successful hit while preserving its damage. Essence, Resonance, Ascension, and Severance bypass this resistance.',
}

export const DERIVED_STAT_PROFILE_GROUPS = [
  {
    id: 'vitals',
    label: 'Vitals',
    statIds: ['maxHp', 'maxMp'] as const,
  },
  {
    id: 'offense',
    label: 'Power & Precision',
    statIds: ['physicalPower', 'mysticPower', 'accuracy', 'criticalChance'] as const,
  },
  {
    id: 'defense',
    label: 'Defense',
    statIds: ['armor', 'ward', 'evasion', 'statusResistance'] as const,
  },
  {
    id: 'tempo',
    label: 'Tempo & Mobility',
    statIds: ['initiative', 'movement', 'jump'] as const,
  },
] as const
