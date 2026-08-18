import { z } from 'zod'

import { characterCreationPayloadSchema } from './character-creation'

export const characterCreationRequestSchema = z
  .object({
    version: z.literal(1),
    slotIndex: z.number().int().min(0).max(2),
    idempotencyKey: z.string().uuid(),
    intent: characterCreationPayloadSchema,
  })
  .strict()

const characterPersistenceRowSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    slot_index: z.number().int().nonnegative(),
    rules_version: z.number().int().positive(),
    name: z.string().min(1),
    name_key: z.string().min(1),
    presentation_id: z.string().min(1),
    pronoun_preset_id: z.string().min(1),
    portrait_ref: z.string().min(1),
    starter_appearance_ref: z.string().min(1),
    foundation_discipline_id: z.string().min(1),
    might: z.number().int().positive(),
    finesse: z.number().int().positive(),
    intellect: z.number().int().positive(),
    resolve: z.number().int().positive(),
    level: z.number().int().positive(),
    xp: z.number().int().nonnegative(),
    progression_cycle: z.number().int().positive(),
    created_at: z.string().datetime({ offset: true }),
    cycle_started_at: z.string().datetime({ offset: true }),
    last_active_at: z.string().datetime({ offset: true }),
  })
  .strict()

const characterCreationPersistenceRowSchema = characterPersistenceRowSchema.extend({
  replayed: z.boolean(),
})

export type CharacterCreationRequest = z.infer<typeof characterCreationRequestSchema>
export type CharacterPersistenceRow = z.infer<typeof characterPersistenceRowSchema>
export type CharacterCreationPersistenceRow = z.infer<typeof characterCreationPersistenceRowSchema>

export function parseCharacterCreationRequest(input: unknown): CharacterCreationRequest | null {
  const parsed = characterCreationRequestSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parseCharacterPersistenceRow(input: unknown): CharacterPersistenceRow | null {
  const parsed = characterPersistenceRowSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parseCharacterCreationPersistenceRow(
  input: unknown,
): CharacterCreationPersistenceRow | null {
  const parsed = characterCreationPersistenceRowSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}
