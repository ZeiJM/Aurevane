import type { IdempotentCommandInput, TransactionalCommandResult } from './transactional-command'

export interface CharacterRecord {
  id: string
  userId: string
  slotIndex: number
  rulesVersion: number
  name: string
  nameKey: string
  presentationId: string
  pronounPresetId: string
  portraitRef: string
  starterAppearanceRef: string
  foundationDisciplineId: string
  might: number
  finesse: number
  vitality: number
  agility: number
  intellect: number
  resolve: number
  level: number
  xp: number
  progressionCycle: number
  createdAt: string
  cycleStartedAt: string
  lastActiveAt: string
}

export interface CreateBaseCharacterRecordInput extends IdempotentCommandInput {
  userId: string
  rulesVersion: number
  name: string
  nameKey: string
  presentationId: string
  pronounPresetId: string
  portraitRef: string
  starterAppearanceRef: string
  foundationDisciplineId: string
  might: number
  finesse: number
  vitality: number
  agility: number
  intellect: number
  resolve: number
}

export interface CharacterRepository {
  findByOwnerSlot(userId: string, slotIndex: number): Promise<CharacterRecord | null>
  /** Multi-slot lookup. Optional only for isolated legacy test doubles during the PV-1F migration. */
  findByOwnerId?(userId: string, characterId: string): Promise<CharacterRecord | null>
  createBaseCharacter(
    input: CreateBaseCharacterRecordInput,
  ): Promise<TransactionalCommandResult<CharacterRecord>>
}
