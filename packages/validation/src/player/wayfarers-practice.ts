import { z } from 'zod'

export const plannedPracticeWindowSchema = z.enum(['short', 'overnight', 'extended'])
export const practiceSourceSchema = z.enum(['automatic_balanced', 'planned_balanced'])

export const setPracticePlanRequestSchema = z
  .object({
    version: z.literal(1),
    characterId: z.string().uuid(),
    plannedWindow: plannedPracticeWindowSchema,
    idempotencyKey: z.string().uuid(),
  })
  .strict()

export const trainingReportClaimRequestSchema = z
  .object({
    version: z.literal(1),
    characterId: z.string().uuid(),
    reportId: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
  })
  .strict()

export const trainingReportPersistenceRowSchema = z
  .object({
    report_id: z.string().uuid(),
    character_id: z.string().uuid(),
    user_id: z.string().uuid(),
    focus: z.literal('balanced'),
    config_version: z.number().int().positive(),
    practice_source: practiceSourceSchema,
    planned_window: plannedPracticeWindowSchema.nullable(),
    planned_window_config_version: z.number().int().positive().nullable(),
    planned_window_seconds: z.number().int().positive().nullable(),
    planned_elapsed_seconds: z.number().int().nonnegative(),
    balanced_fallback_seconds: z.number().int().nonnegative(),
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

export const wayfarersPracticeStatusPersistenceRowSchema = z
  .object({
    character_id: z.string().uuid(),
    user_id: z.string().uuid(),
    focus: z.literal('balanced'),
    config_version: z.number().int().positive(),
    minimum_offline_seconds: z.number().int().nonnegative(),
    rested_momentum_balance: z.number().int().nonnegative(),
    planned_window: plannedPracticeWindowSchema.nullable(),
    planned_window_config_version: z.number().int().positive().nullable(),
    planned_window_seconds: z.number().int().positive().nullable(),
    plan_set_at: z.string().datetime({ offset: true }).nullable(),
    short_window_seconds: z.number().int().positive(),
    overnight_window_seconds: z.number().int().positive(),
    extended_window_seconds: z.number().int().positive(),
    server_now: z.string().datetime({ offset: true }),
  })
  .strict()

export const setPracticePlanPersistenceRowSchema = z
  .object({
    character_id: z.string().uuid(),
    user_id: z.string().uuid(),
    planned_window: plannedPracticeWindowSchema,
    planned_window_config_version: z.number().int().positive(),
    planned_window_seconds: z.number().int().positive(),
    plan_set_at: z.string().datetime({ offset: true }),
    server_now: z.string().datetime({ offset: true }),
    replayed: z.boolean(),
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

export type SetPracticePlanRequest = z.infer<typeof setPracticePlanRequestSchema>
export type TrainingReportClaimRequest = z.infer<typeof trainingReportClaimRequestSchema>
export type TrainingReportPersistenceRow = z.infer<typeof trainingReportPersistenceRowSchema>
export type WayfarersPracticeStatusPersistenceRow = z.infer<
  typeof wayfarersPracticeStatusPersistenceRowSchema
>
export type SetPracticePlanPersistenceRow = z.infer<typeof setPracticePlanPersistenceRowSchema>
export type TrainingReportClaimPersistenceRow = z.infer<
  typeof trainingReportClaimPersistenceRowSchema
>

export function parseSetPracticePlanRequest(input: unknown): SetPracticePlanRequest | null {
  const parsed = setPracticePlanRequestSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parseTrainingReportClaimRequest(input: unknown): TrainingReportClaimRequest | null {
  const parsed = trainingReportClaimRequestSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parseTrainingReportPersistenceRow(
  input: unknown,
): TrainingReportPersistenceRow | null {
  const parsed = trainingReportPersistenceRowSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parseWayfarersPracticeStatusPersistenceRow(
  input: unknown,
): WayfarersPracticeStatusPersistenceRow | null {
  const parsed = wayfarersPracticeStatusPersistenceRowSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parseSetPracticePlanPersistenceRow(
  input: unknown,
): SetPracticePlanPersistenceRow | null {
  const parsed = setPracticePlanPersistenceRowSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parseTrainingReportClaimPersistenceRow(
  input: unknown,
): TrainingReportClaimPersistenceRow | null {
  const parsed = trainingReportClaimPersistenceRowSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}
