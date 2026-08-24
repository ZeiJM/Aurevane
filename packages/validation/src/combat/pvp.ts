import { z } from 'zod'

export const pvpModeSchema = z.enum(['1v1', '2v2', '3v3', '1v1v1', 'flex-teams'])
export type PvpMode = z.infer<typeof pvpModeSchema>

export const pvpMapSizeSchema = z.enum(['medium', 'large'])
export type PvpMapSize = z.infer<typeof pvpMapSizeSchema>

export const pvpMapBiasSchema = z.enum(['less', 'neutral', 'more'])
export type PvpMapBias = z.infer<typeof pvpMapBiasSchema>

export const pvpTurnTimerSecondsSchema = z.union([z.literal(60), z.literal(120), z.null()])
export type PvpTurnTimerSeconds = z.infer<typeof pvpTurnTimerSecondsSchema>

export const pvpLobbyIdSchema = z.string().uuid()
export const pvpLobbyKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^AVL-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
export const pvpBattleKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^AVB-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

const teamSizeSchema = z.number().int().min(1).max(3)

const createLobbyRequestSchema = z
  .object({
    characterId: z.string().uuid(),
    mode: pvpModeSchema,
    teamASize: teamSizeSchema.optional(),
    teamBSize: teamSizeSchema.optional(),
    mapSize: pvpMapSizeSchema.default('medium'),
    elevationBias: pvpMapBiasSchema.default('neutral'),
    terrainBias: pvpMapBiasSchema.default('neutral'),
    turnTimerSeconds: pvpTurnTimerSecondsSchema.default(60),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.mode === 'flex-teams') {
      if (!value.teamASize || !value.teamBSize) {
        context.addIssue({
          code: 'custom',
          message: 'Flexible teams require a size for both sides.',
        })
      }
      return
    }
    if (value.teamASize !== undefined || value.teamBSize !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Fixed PvP modes do not accept custom team sizes.',
      })
    }
  })

const joinLobbyRequestSchema = z
  .object({
    characterId: z.string().uuid(),
    lobbyKey: pvpLobbyKeySchema,
  })
  .strict()

const readyLobbyRequestSchema = z.object({ ready: z.boolean() }).strict()

const lobbySettingsRequestSchema = z
  .object({
    mapSize: pvpMapSizeSchema,
    elevationBias: pvpMapBiasSchema,
    terrainBias: pvpMapBiasSchema,
    turnTimerSeconds: pvpTurnTimerSecondsSchema,
  })
  .strict()

const lobbySeatCoordinateSchema = z.number().int().min(0).max(2)
const lobbySeatMoveRequestSchema = z
  .object({
    targetTeamIndex: lobbySeatCoordinateSchema.nullable(),
    targetSeatIndex: lobbySeatCoordinateSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.targetTeamIndex === null) !== (value.targetSeatIndex === null)) {
      context.addIssue({
        code: 'custom',
        message: 'PvP seat coordinates must both be supplied or both be null.',
      })
    }
  })

export type PvpCreateLobbyRequest = z.infer<typeof createLobbyRequestSchema>
export type PvpJoinLobbyRequest = z.infer<typeof joinLobbyRequestSchema>
export type PvpReadyLobbyRequest = z.infer<typeof readyLobbyRequestSchema>
export type PvpLobbySettingsRequest = z.infer<typeof lobbySettingsRequestSchema>
export type PvpLobbySeatMoveRequest = z.infer<typeof lobbySeatMoveRequestSchema>

export function parsePvpCreateLobbyRequest(input: unknown): PvpCreateLobbyRequest | null {
  const parsed = createLobbyRequestSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parsePvpJoinLobbyRequest(input: unknown): PvpJoinLobbyRequest | null {
  const parsed = joinLobbyRequestSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parsePvpReadyLobbyRequest(input: unknown): PvpReadyLobbyRequest | null {
  const parsed = readyLobbyRequestSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parsePvpLobbySettingsRequest(input: unknown): PvpLobbySettingsRequest | null {
  const parsed = lobbySettingsRequestSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parsePvpLobbySeatMoveRequest(input: unknown): PvpLobbySeatMoveRequest | null {
  const parsed = lobbySeatMoveRequestSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parsePvpLobbyId(input: unknown): string | null {
  const parsed = pvpLobbyIdSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parsePvpLobbyKey(input: unknown): string | null {
  const parsed = pvpLobbyKeySchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parsePvpBattleKey(input: unknown): string | null {
  const parsed = pvpBattleKeySchema.safeParse(input)
  return parsed.success ? parsed.data : null
}
