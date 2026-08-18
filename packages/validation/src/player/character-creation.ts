import { z } from 'zod'

const characterAttributeBonusesPayloadSchema = z
  .object({
    might: z.number().finite(),
    finesse: z.number().finite(),
    intellect: z.number().finite(),
    resolve: z.number().finite(),
    vitality: z.number().finite(),
    insight: z.number().finite(),
  })
  .strict()

export const characterCreationPayloadSchema = z
  .object({
    name: z.string(),
    presentationId: z.string(),
    pronounPresetId: z.string(),
    portraitRef: z.string(),
    starterAppearanceRef: z.string(),
    attributeBonuses: characterAttributeBonusesPayloadSchema,
    foundationDisciplineId: z.string(),
  })
  .strict()

export type CharacterCreationPayload = z.infer<typeof characterCreationPayloadSchema>

export function parseCharacterCreationPayload(input: unknown): CharacterCreationPayload | null {
  const parsed = characterCreationPayloadSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}
