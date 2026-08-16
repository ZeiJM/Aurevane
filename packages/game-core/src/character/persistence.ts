import type {
  CharacterAttributes,
  CharacterPortraitRef,
  CharacterPresentationId,
  PronounPresetId,
  StarterAppearanceRef,
} from './creation'
import type { FoundationDisciplineId } from './foundation-disciplines'

export const BASE_CHARACTER_SLOT_INDEX = 0 as const

export interface PersistedCharacter {
  id: string
  userId: string
  slotIndex: number
  rulesVersion: number
  name: string
  nameKey: string
  presentationId: CharacterPresentationId
  pronounPresetId: PronounPresetId
  portraitRef: CharacterPortraitRef
  starterAppearanceRef: StarterAppearanceRef
  foundationDisciplineId: FoundationDisciplineId
  attributes: CharacterAttributes
  level: number
  xp: number
  progressionCycle: {
    number: number
  }
  createdAt: string
  cycleStartedAt: string
  lastActiveAt: string
}
