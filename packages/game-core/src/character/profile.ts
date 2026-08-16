import {
  CHARACTER_PRESENTATIONS,
  PRONOUN_PRESETS,
  type CharacterAttributes,
  type CharacterPortraitRef,
  type CharacterPresentationId,
  type PronounPresetId,
  type StarterAppearanceRef,
} from './creation'
import { calculateDerivedStats, type DerivedStatSnapshot } from './derived-stats'
import { getFoundationDiscipline, type FoundationDisciplineId } from './foundation-disciplines'
import type { PersistedCharacter } from './persistence'

export interface CharacterProfileReadModel {
  characterId: string
  slotIndex: number
  identity: {
    name: string
    presentationId: CharacterPresentationId
    presentationLabel: string
    pronounPresetId: PronounPresetId
    pronounLabel: string
    portraitRef: CharacterPortraitRef
    starterAppearanceRef: StarterAppearanceRef
  }
  foundationDiscipline: {
    id: FoundationDisciplineId
    name: string
    summary: string
  }
  progression: {
    level: number
    xp: number
    cycleNumber: number
  }
  attributes: CharacterAttributes
  derived: DerivedStatSnapshot
  timestamps: {
    createdAt: string
    cycleStartedAt: string
    lastActiveAt: string
  }
}

export function buildCharacterProfileReadModel(
  character: PersistedCharacter,
): CharacterProfileReadModel {
  const presentation = CHARACTER_PRESENTATIONS.find(
    (option) => option.id === character.presentationId,
  )
  const pronouns = PRONOUN_PRESETS.find((option) => option.id === character.pronounPresetId)
  const discipline = getFoundationDiscipline(character.foundationDisciplineId)

  if (!presentation || !pronouns || !discipline) {
    throw new Error('Character identity references are not available for profile rendering.')
  }

  return {
    characterId: character.id,
    slotIndex: character.slotIndex,
    identity: {
      name: character.name,
      presentationId: character.presentationId,
      presentationLabel: presentation.label,
      pronounPresetId: character.pronounPresetId,
      pronounLabel: pronouns.label,
      portraitRef: character.portraitRef,
      starterAppearanceRef: character.starterAppearanceRef,
    },
    foundationDiscipline: {
      id: discipline.id,
      name: discipline.name,
      summary: discipline.summary,
    },
    progression: {
      level: character.level,
      xp: character.xp,
      cycleNumber: character.progressionCycle.number,
    },
    attributes: { ...character.attributes },
    derived: calculateDerivedStats({
      attributes: character.attributes,
      level: character.level,
    }),
    timestamps: {
      createdAt: character.createdAt,
      cycleStartedAt: character.cycleStartedAt,
      lastActiveAt: character.lastActiveAt,
    },
  }
}
