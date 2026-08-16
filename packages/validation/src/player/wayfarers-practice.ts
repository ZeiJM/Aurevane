import { z } from 'zod'

export const trainingReportPersistenceRowSchema = z
  .object({
    report_id: z.string().uuid(),
    character_id: z.string().uuid(),
    user_id: z.string().uuid(),
    focus: z.literal('balanced'),
    config_version: z.number().int().positive(),
    window_started_at: z.string().datetime({ offset: true }),
    window_ended_at: z.string().datetime({ offset: true }),
    elapsed_seconds: z.number().int().nonnegative(),
    credited_direct_seconds: z.number().int().nonnegative(),
    full_rate_seconds: z.number().int().nonnegative(),
    reduced_rate_seconds: z.number().int().nonnegative(),
    requested_character_xp: z.number().int().nonnegative(),
    direct_xp_cap_reached: z.boolean(),
    rested_momentum_seconds: z.number().int().nonnegative(),
    rested_momentum_gain: z.number().int().nonnegative(),
    rested_momentum_cap_reached: z.boolean(),
    status: z.enum(['pending', 'claimed']),
    created_at: z.string().datetime({ offset: true }),
    claimed_at: z.string().datetime({ offset: true }).nullable(),
  })
  .strict()

export const trainingReportClaimPersistenceRowSchema = z
  .object({
    report_id: z.string().uuid(),
    character_id: z.string().uuid(),
    user_id: z.string().uuid(),
    progression_cycle: z.number().int().positive(),
    curve_version: z.number().int().positive(),
    xp_grant_id: z.string().uuid().nullable(),
    requested_character_xp: z.number().int().nonnegative(),
    applied_character_xp: z.number().int().nonnegative(),
    xp_before: z.number().int().nonnegative(),
    xp_after: z.number().int().nonnegative(),
    level_before: z.number().int().min(1).max(100),
    level_after: z.number().int().min(1).max(100),
    reached_level: z.number().int().min(1).max(100).nullable(),
    rested_momentum_before: z.number().int().nonnegative(),
    rested_momentum_applied: z.number().int().nonnegative(),
    rested_momentum_after: z.number().int().nonnegative(),
    claimed_at: z.string().datetime({ offset: true }),
    replayed: z.boolean(),
  })
  .strict()

export type TrainingReportPersistenceRow = z.infer<typeof trainingReportPersistenceRowSchema>
export type TrainingReportClaimPersistenceRow = z.infer<
  typeof trainingReportClaimPersistenceRowSchema
>

export function parseTrainingReportPersistenceRow(
  input: unknown,
): TrainingReportPersistenceRow | null {
  const parsed = trainingReportPersistenceRowSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parseTrainingReportClaimPersistenceRow(
  input: unknown,
): TrainingReportClaimPersistenceRow | null {
  const parsed = trainingReportClaimPersistenceRowSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}
