import type { CharacterAttributeId } from './creation'
import type { DerivedStatId } from './derived-stats'

export const ATTRIBUTE_PROFILE_HELP: Readonly<Record<CharacterAttributeId, string>> = {
  might:
    'Physical force. Might contributes only to Physical Power. Relative Character Level modifies combat damage separately rather than changing this rating.',
  finesse: 'Precision and technique. Finesse contributes only to Accuracy and Critical Chance.',
  vitality: 'Endurance and bodily resilience. Vitality contributes only to Maximum HP and Armor.',
  agility:
    'Reflexes, footwork, and mobility. Agility contributes only to Initiative, Movement, Jump, and Evasion.',
  intellect:
    'Mystic understanding and supernatural potency. Intellect contributes only to Maximum MP and Mystic Power. Relative Character Level modifies combat damage separately rather than changing this rating.',
  resolve:
    'Willpower and supernatural steadiness. Resolve contributes only to Ward and Status Resistance.',
}

export const DERIVED_STAT_PROFILE_HELP: Readonly<Record<DerivedStatId, string>> = {
  maxHp: 'Your current maximum health before temporary battle effects.',
  maxMp: 'Your current maximum MP before temporary battle effects.',
  physicalPower:
    'Physical damage rating from Might. Basic Attack and physical damaging Skills read this rating; relative Character Level then modifies direct combat damage separately.',
  mysticPower:
    'Mystic damage rating from Intellect. Mystic damaging Skills read this rating; relative Character Level then modifies direct combat damage separately.',
  armor:
    'Baseline physical defense rating before equipment, Disciplines, statuses, and battle effects.',
  ward: 'Baseline mystic defense rating before equipment, Disciplines, statuses, and battle effects.',
  accuracy:
    'Baseline hit reliability before target, terrain, facing, Art, and battle-specific modifiers.',
  evasion: 'Baseline ability to avoid eligible attacks before battle-specific modifiers.',
  criticalChance:
    'Baseline critical chance before Arts, equipment, statuses, and other authored modifiers.',
  initiative: 'Baseline turn-order influence before battle-specific timing effects.',
  movement:
    'Baseline Movement stat. Combat converts this into the normal Movement Budget before terrain and temporary modifiers.',
  jump: 'Baseline vertical movement capability before movement-profile, terrain, and temporary modifiers.',
  statusResistance:
    'Baseline resistance to hostile status effects before specific status and battle modifiers.',
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
