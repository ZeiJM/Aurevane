import { z } from 'zod'
import { battleAiDifficultySchema } from './battle-session'

export const NPC_ARENA_LORE_LIMIT = 700
export const NPC_GREETING_LIMIT = 900
export const NPC_UNIFORM_REASON_LIMIT = 240
export const NPC_ARENA_IDS = ['duel-yard', 'crossroads-court', 'terraced-yard'] as const
export const NPC_USES = ['arena', 'world', 'story'] as const

const npcId = z.uuid()
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER)
const portraitRef = z
  .string()
  .regex(/^portrait\.[a-z0-9.-]{1,90}$/u)
  .nullable()
const name = z.string().trim().max(60)
const imageUrl = z
  .string()
  .regex(/^\/api\/media\/appearance\/1\/[a-z0-9.]{1,140}\/neutral\.svg$/u)
  .nullable()
  .optional()
const world = z
  .object({
    sectorId: z.string().regex(/^[a-z0-9:-]{1,100}$/u),
    x: z.number().int().min(0).max(12),
    y: z.number().int().min(0).max(8),
    radius: z.number().int().min(1).max(3),
    greeting: z.string().trim().max(NPC_GREETING_LIMIT),
  })
  .strict()
const publishedIdentity = z
  .object({ id: npcId, name: name.min(1), portraitRef, imageUrl, revision })
  .strict()
const publishedWorld = world
  .extend(publishedIdentity.shape)
  .extend({ greeting: z.string().trim().min(1).max(NPC_GREETING_LIMIT) })

const arena = z
  .object({
    arenaId: z.enum(NPC_ARENA_IDS),
    aiDifficulty: battleAiDifficultySchema,
    lore: z.string().trim().max(NPC_ARENA_LORE_LIMIT),
  })
  .strict()
const npcDraft = z
  .object({
    name,
    portraitRef,
    imageUrl,
    uses: z
      .array(z.enum(NPC_USES))
      .min(1)
      .max(3)
      .refine((uses) => new Set(uses).size === uses.length),
    arena: arena.nullable(),
    world: world.nullable().optional(),
  })
  .strict()
  .refine((draft) => !draft.uses.includes('arena') || draft.arena !== null)

const arenaNpc = arena.extend(publishedIdentity.shape)
const npcDesignRecord = z
  .object({
    id: npcId,
    revision,
    draft: npcDraft,
    arena: arenaNpc.nullable(),
    world: publishedWorld.nullable().optional(),
    story: publishedIdentity.nullable().optional(),
  })
  .strict()
  .refine((record) =>
    [record.arena, record.world, record.story].every(
      (use) => !use || (use.id === record.id && use.revision <= record.revision),
    ),
  )
const npcDesignCommand = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('save'),
      id: npcId,
      revision: revision.or(z.literal(0)),
      draft: npcDraft,
    })
    .strict(),
  z
    .object({
      kind: z.enum([
        'commit-arena',
        'retire-arena',
        'commit-world',
        'retire-world',
        'commit-story',
        'retire-story',
      ]),
      id: npcId,
      revision,
    })
    .strict(),
  z
    .object({
      kind: z.literal('commit-uniform'),
      id: npcId,
      revision,
      use: z.enum(NPC_USES),
      reason: z.string().trim().min(1).max(NPC_UNIFORM_REASON_LIMIT),
    })
    .strict(),
])

export type NpcUse = z.infer<typeof npcDraft>['uses'][number]
export type NpcDesignDraft = z.infer<typeof npcDraft>
export type NpcDesignRecord = z.infer<typeof npcDesignRecord>
export type NpcDesignCommand = z.infer<typeof npcDesignCommand>
export type ArenaNpc = z.infer<typeof arenaNpc>
export type ArenaNpcIdentity = z.infer<typeof publishedIdentity>
export type PublishedWorldNpc = z.infer<typeof publishedWorld>
export type PublishedStoryNpc = z.infer<typeof publishedIdentity>

export function parsePublishedWorldNpc(value: unknown) {
  return publishedWorld.safeParse(value).data ?? null
}

export function parsePublishedStoryNpc(value: unknown) {
  return publishedIdentity.safeParse(value).data ?? null
}

const npcArenaRehearsalRequest = z.object({ id: npcId, revision }).strict()

export function parseNpcArenaRehearsalRequest(value: unknown) {
  return npcArenaRehearsalRequest.safeParse(value).data ?? null
}

export function parseNpcDesignCommand(value: unknown) {
  return npcDesignCommand.safeParse(value).data ?? null
}

export function parseNpcDesignRecord(value: unknown) {
  return npcDesignRecord.safeParse(value).data ?? null
}

export function parseArenaNpc(value: unknown) {
  return arenaNpc.safeParse(value).data ?? null
}
