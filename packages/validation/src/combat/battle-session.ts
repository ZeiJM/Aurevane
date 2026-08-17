import { z } from 'zod'

const safeInteger = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER)
const safePositiveInteger = safeInteger.positive()
const battleSessionIdSchema = z.string().uuid()
const combatantIdSchema = z.string().trim().min(1).max(160)
const gridPositionSchema = z.object({ x: safeInteger, y: safeInteger }).strict()

const combatTargetSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('self') }).strict(),
  z
    .object({
      kind: z.literal('unit'),
      combatantId: combatantIdSchema,
    })
    .strict(),
  z.object({ kind: z.literal('tile'), position: gridPositionSchema }).strict(),
])

export const battleIntentSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('move'),
      path: z.array(gridPositionSchema).min(2).max(128),
    })
    .strict(),
  z
    .object({
      kind: z.literal('action'),
      actionId: z.string().trim().min(1).max(160),
      target: combatTargetSelectionSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('face'),
      facing: z.enum(['north', 'east', 'south', 'west']),
    })
    .strict(),
  z.object({ kind: z.literal('end-turn') }).strict(),
])

const battleSessionCreateRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    characterId: z.string().uuid(),
  })
  .strict()

const battleIntentRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    expectedBattleVersion: safePositiveInteger,
    intent: battleIntentSchema,
  })
  .strict()

const battlePreviewRequestSchema = z
  .object({
    expectedBattleVersion: safePositiveInteger,
    intent: battleIntentSchema,
  })
  .strict()

const battleRecruitTurnRequestSchema = z
  .object({
    expectedBattleVersion: safePositiveInteger,
  })
  .strict()

const snapshotSchema = z.record(z.string(), z.unknown())
const lifecycleSchema = z.enum(['pending', 'active', 'completed', 'abandoned'])

const battleSessionCreationRowSchema = z
  .object({
    battle_session_id: z.string().uuid(),
    battle_version: safePositiveInteger,
    snapshot: snapshotSchema,
    created_at: z.string().datetime({ offset: true }),
    replayed: z.boolean(),
  })
  .strict()

const battleSessionRowSchema = z
  .object({
    battle_session_id: z.string().uuid(),
    battle_id: z.string().min(1).max(160),
    battle_version: safePositiveInteger,
    rules_version: safePositiveInteger,
    content_version: safePositiveInteger,
    lifecycle: lifecycleSchema,
    snapshot: snapshotSchema,
    controlled_combatant_ids: z.array(combatantIdSchema).min(1),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strict()

const battleSessionCommitRowSchema = z
  .object({
    battle_session_id: z.string().uuid(),
    battle_version: safePositiveInteger,
    snapshot: snapshotSchema,
    committed_at: z.string().datetime({ offset: true }),
    replayed: z.boolean(),
  })
  .strict()

const battleEventRowSchema = z
  .object({
    battle_version: safePositiveInteger,
    event_index: safeInteger.nonnegative(),
    event: z.record(z.string(), z.unknown()),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict()

const oneCreationRowSchema = z.array(battleSessionCreationRowSchema).length(1)
const optionalSessionRowSchema = z.array(battleSessionRowSchema).max(1)
const oneCommitRowSchema = z.array(battleSessionCommitRowSchema).length(1)
const battleEventRowsSchema = z.array(battleEventRowSchema).max(100)

export type BattleIntent = z.infer<typeof battleIntentSchema>
export type BattleSessionCreateRequest = z.infer<typeof battleSessionCreateRequestSchema>
export type BattleIntentRequest = z.infer<typeof battleIntentRequestSchema>
export type BattlePreviewRequest = z.infer<typeof battlePreviewRequestSchema>
export type BattleRecruitTurnRequest = z.infer<typeof battleRecruitTurnRequestSchema>
export type BattleSessionCreationPersistenceRow = z.infer<typeof battleSessionCreationRowSchema>
export type BattleSessionPersistenceRow = z.infer<typeof battleSessionRowSchema>
export type BattleSessionCommitPersistenceRow = z.infer<typeof battleSessionCommitRowSchema>
export type BattleEventPersistenceRow = z.infer<typeof battleEventRowSchema>

export function parseBattleSessionId(input: unknown): string | null {
  const result = battleSessionIdSchema.safeParse(input)
  return result.success ? result.data : null
}

export function parseBattleSessionCreateRequest(input: unknown): BattleSessionCreateRequest | null {
  const result = battleSessionCreateRequestSchema.safeParse(input)
  return result.success ? result.data : null
}

export function parseBattleIntentRequest(input: unknown): BattleIntentRequest | null {
  const result = battleIntentRequestSchema.safeParse(input)
  return result.success ? result.data : null
}

export function parseBattlePreviewRequest(input: unknown): BattlePreviewRequest | null {
  const result = battlePreviewRequestSchema.safeParse(input)
  return result.success ? result.data : null
}

export function parseBattleRecruitTurnRequest(input: unknown): BattleRecruitTurnRequest | null {
  const result = battleRecruitTurnRequestSchema.safeParse(input)
  return result.success ? result.data : null
}

export function parseBattleSessionCreationPersistenceRow(
  input: unknown,
): BattleSessionCreationPersistenceRow | null {
  const result = oneCreationRowSchema.safeParse(input)
  return result.success ? result.data[0] : null
}

export function parseBattleSessionPersistenceRow(
  input: unknown,
): BattleSessionPersistenceRow | null {
  const result = optionalSessionRowSchema.safeParse(input)
  return result.success ? (result.data[0] ?? null) : null
}

export function parseBattleSessionCommitPersistenceRow(
  input: unknown,
): BattleSessionCommitPersistenceRow | null {
  const result = oneCommitRowSchema.safeParse(input)
  return result.success ? result.data[0] : null
}

export function parseBattleEventPersistenceRows(
  input: unknown,
): readonly BattleEventPersistenceRow[] | null {
  const result = battleEventRowsSchema.safeParse(input)
  return result.success ? result.data : null
}
