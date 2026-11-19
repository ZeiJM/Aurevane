import { z } from 'zod'
import { battleAiDifficultySchema } from './battle-session'

export const NPC_ARENA_LORE_LIMIT = 700
export const NPC_GREETING_LIMIT = 900
export const NPC_UNIFORM_REASON_LIMIT = 240
export const NPC_ARENA_IDS = ['duel-yard', 'crossroads-court', 'terraced-yard'] as const
export const NPC_USES = ['arena', 'world', 'story'] as const
export const NPC_GREETING_EXPRESSIONS = ['neutral', 'happy', 'angry', 'sad', 'surprised'] as const

export const NPC_DIALOGUE_MAX_DEPTH = 4
export const NPC_DIALOGUE_MAX_REPLIES = 4
export const NPC_DIALOGUE_MAX_NODES = 16
export const NPC_DIALOGUE_LABEL_LIMIT = 100

export interface NpcDialogueReply {
  label: string
  body: string
  expression?: (typeof NPC_GREETING_EXPRESSIONS)[number]
  replies: NpcDialogueReply[]
}

const dialogueLabel = z.string().trim().max(NPC_DIALOGUE_LABEL_LIMIT)
const dialogueBody = z.string().trim().max(NPC_GREETING_LIMIT)
const dialogueExpression = z.enum(NPC_GREETING_EXPRESSIONS)
const dialoguePath = z
  .array(
    z
      .number()
      .int()
      .min(0)
      .max(NPC_DIALOGUE_MAX_REPLIES - 1),
  )
  .min(1)
  .max(NPC_DIALOGUE_MAX_DEPTH)

function dialogueDraft(depth: number): z.ZodType<NpcDialogueReply[]> {
  return z
    .array(
      z
        .object({
          label: dialogueLabel,
          body: dialogueBody,
          expression: dialogueExpression.optional(),
          replies: depth === 1 ? z.array(z.never()).max(0) : dialogueDraft(depth - 1),
        })
        .strict(),
    )
    .max(NPC_DIALOGUE_MAX_REPLIES)
}

export function npcDialogueNodeCount(replies: readonly NpcDialogueReply[]): number {
  return replies.reduce((count, reply) => count + 1 + npcDialogueNodeCount(reply.replies), 0)
}

export function npcDialogueReady(replies: readonly NpcDialogueReply[]): boolean {
  return replies.every(
    ({ label, body, replies: next }) =>
      Boolean(label.trim() && body.trim()) && npcDialogueReady(next),
  )
}

const npcDialogue = dialogueDraft(NPC_DIALOGUE_MAX_DEPTH).refine(
  (replies) => npcDialogueNodeCount(replies) <= NPC_DIALOGUE_MAX_NODES,
)

const dialoguePage = z
  .object({
    body: dialogueBody.min(1),
    expression: dialogueExpression.optional(),
    replies: z.array(dialogueLabel.min(1)).max(NPC_DIALOGUE_MAX_REPLIES),
  })
  .strict()

export type NpcDialoguePage = z.infer<typeof dialoguePage>
export function parseNpcDialoguePage(value: unknown) {
  return dialoguePage.safeParse(value).data ?? null
}

export function npcDialogueReplyPage(
  replies: readonly NpcDialogueReply[],
  path: readonly number[],
): NpcDialoguePage | null {
  let selected: NpcDialogueReply | undefined
  for (const choice of path) {
    selected = replies[choice]
    if (!selected) return null
    replies = selected.replies
  }
  return selected
    ? {
        body: selected.body,
        ...(selected.expression ? { expression: selected.expression } : {}),
        replies: selected.replies.map(({ label }) => label),
      }
    : null
}

const npcId = z.uuid()
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER)
const portraitRef = z
  .string()
  .regex(/^portrait\.[a-z0-9.-]{1,90}$/u)
  .nullable()
const name = z.string().trim().max(60)
const dye =
  '(?:natural|charcoal|ocean|teal|ice|cobalt|plum|rose|crimson|ember|amber|ochre|pine|sage|ivory)'
const paintedRecipe = [
  '(?:scout|ranger|guard|elder)',
  '(?:none|compass|pine|hawkmantle|shearling|scarf)',
  dye,
  '(?:none|utility|mapcase|potions|bedroll)',
  dye,
  '(?:none|arcanist|bandana)',
  dye,
  '(?:none|eyepatch|goggles)',
  dye,
].join('\\.')
const imageUrl = z
  .string()
  .regex(
    new RegExp(
      String.raw`^/api/media/appearance/(?:1/[a-z0-9.]{1,140}|2/[a-z]+(?:\.[a-z]+){12}|3/[a-z]+(?:\.[a-z]+){13}|4/${paintedRecipe})/neutral\.svg$`,
      'u',
    ),
  )
  .refine((url) => {
    if (!url.startsWith('/api/media/appearance/4/')) return true
    const [, clothing, clothColor, accessory, gearColor, headwear, headColor, facewear, faceColor] =
      url.split('/')[5]!.split('.')
    return (
      (clothing !== 'none' || clothColor === 'natural') &&
      (accessory !== 'none' || gearColor === 'natural') &&
      (headwear !== 'none' || headColor === 'natural') &&
      (facewear !== 'none' || faceColor === 'natural')
    )
  })
  .nullable()
  .optional()
const worldEncounter = z
  .object({
    arenaId: z.enum(NPC_ARENA_IDS),
    aiDifficulty: battleAiDifficultySchema,
    tags: z
      .array(z.string().regex(/^[a-z][a-z0-9-]{1,31}$/u))
      .max(8)
      .refine((tags) => new Set(tags).size === tags.length),
  })
  .strict()
const world = z
  .object({
    sectorId: z.string().regex(/^[a-z0-9:-]{1,100}$/u),
    x: z.number().int().min(0).max(12),
    y: z.number().int().min(0).max(8),
    radius: z.number().int().min(1).max(3),
    greeting: z.string().trim().max(NPC_GREETING_LIMIT),
    greetingExpression: dialogueExpression.optional(),
    dialogue: npcDialogue.optional(),
    encounter: worldEncounter.nullable().optional(),
  })
  .strict()
const publishedIdentity = z
  .object({ id: npcId, name: name.min(1), portraitRef, imageUrl, revision })
  .strict()
const publishedWorld = world
  .extend(publishedIdentity.shape)
  .extend({ greeting: z.string().trim().min(1).max(NPC_GREETING_LIMIT) })
  .refine(({ dialogue }) => npcDialogueReady(dialogue ?? []))

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

const dialogueRequest = z
  .object({
    characterId: npcId,
    npcId,
    revision,
    path: dialoguePath,
  })
  .strict()
export type NpcDialogueRequest = z.infer<typeof dialogueRequest>
export function parseNpcDialogueRequest(value: unknown) {
  return dialogueRequest.safeParse(value).data ?? null
}

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
