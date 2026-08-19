import type { CharacterAttributeId } from './creation'
import type { DerivedStatId } from './derived-stats'

export const ATTRIBUTE_PROFILE_HELP: Readonly<Record<CharacterAttributeId, string>> = {
  might:
    'Physical strength and force. It currently contributes to physical power, maximum HP, armor, and jump capability.',
  finesse:
    'Precision and weapon control. It currently contributes to physical power, accuracy, and critical chance.',
  vitality:
    'Endurance and bodily resilience. It currently contributes strongly to maximum HP and armor.',
  agility:
    'Reflexes, footwork, and mobility. It currently contributes to evasion, initiative, movement, and jump capability.',
  intellect:
    'Magical potency, healing, and supernatural control. It currently contributes to MP, mystic power, ward, and a smaller part of accuracy.',
  resolve:
    'Mental steadiness and resistance. It currently contributes to MP, mystic power, ward, evasion, initiative, and status resistance.',
}

export const DERIVED_STAT_PROFILE_HELP: Readonly<Record<DerivedStatId, string>> = {
  maxHp: 'Your current maximum health before temporary battle effects.',
  maxMp: 'Your current maximum MP before temporary battle effects.',
  physicalPower: 'Baseline rating for physical effectiveness before authored combat modifiers.',
  mysticPower:
    'Baseline rating for magical and supernatural effectiveness before authored combat modifiers.',
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
