import { z } from 'zod'

export const levelProgressionCurvePersistenceRowSchema = z
  .object({
    curve_version: z.number().int().positive(),
    max_level: z.number().int().min(1).max(100),
    cumulative_xp_by_level: z.array(z.number().int().nonnegative()).min(1).max(100),
  })
  .strict()

export const characterXpGrantPersistenceRowSchema = z
  .object({
    grant_id: z.string().uuid(),
    character_id: z.string().uuid(),
    progression_cycle: z.number().int().positive(),
    curve_version: z.number().int().positive(),
    authority_key: z.string().min(1).max(160),
    source_kind: z.enum(['system', 'gameplay', 'support', 'owner']),
    source_id: z.string().min(1).max(160),
    reason_tag: z.string().min(1).max(120),
    requested_amount: z.number().int().positive(),
    applied_amount: z.number().int().nonnegative(),
    xp_before: z.number().int().nonnegative(),
    xp_after: z.number().int().nonnegative(),
    level_before: z.number().int().min(1).max(100),
    level_after: z.number().int().min(1).max(100),
    reached_level: z.number().int().min(1).max(100).nullable(),
    seconds_since_cycle_start: z.number().int().nonnegative(),
    created_at: z.string().datetime({ offset: true }),
    replayed: z.boolean(),
  })
  .strict()

export type LevelProgressionCurvePersistenceRow = z.infer<
  typeof levelProgressionCurvePersistenceRowSchema
>
export type CharacterXpGrantPersistenceRow = z.infer<typeof characterXpGrantPersistenceRowSchema>

export function parseLevelProgressionCurvePersistenceRow(
  input: unknown,
): LevelProgressionCurvePersistenceRow | null {
  const parsed = levelProgressionCurvePersistenceRowSchema.safeParse(input)
  if (!parsed.success || parsed.data.cumulative_xp_by_level.length !== parsed.data.max_level) {
    return null
  }
  return parsed.data
}

export function parseCharacterXpGrantPersistenceRow(
  input: unknown,
): CharacterXpGrantPersistenceRow | null {
  const parsed = characterXpGrantPersistenceRowSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}
