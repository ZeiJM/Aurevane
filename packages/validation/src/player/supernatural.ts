import { z } from 'zod'

const stableId = z.string().regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/)
const positiveVersion = z.number().int().positive()

const supernaturalStateShape = {
  character_id: z.string().uuid(),
  schema_version: z.literal(1),
  state_version: positiveVersion,
  story_id: stableId,
  story_version: positiveVersion,
  node_id: stableId,
  path: z.enum(['unawakened', 'ascended', 'severed']),
  ascension_id: stableId.nullable(),
  ascension_content_version: positiveVersion.nullable(),
  severence_id: stableId.nullable(),
  severence_content_version: positiveVersion.nullable(),
  chosen_at: z.string().datetime({ offset: true }).nullable(),
  updated_at: z.string().datetime({ offset: true }),
} as const

function validIdentityShape(value: {
  path: 'unawakened' | 'ascended' | 'severed'
  ascension_id: string | null
  ascension_content_version: number | null
  severence_id: string | null
  severence_content_version: number | null
  chosen_at: string | null
}) {
  if (value.path === 'unawakened')
    return (
      value.ascension_id === null &&
      value.ascension_content_version === null &&
      value.severence_id === null &&
      value.severence_content_version === null &&
      value.chosen_at === null
    )

  if (value.path === 'ascended')
    return (
      value.ascension_id !== null &&
      value.ascension_content_version !== null &&
      value.severence_id === null &&
      value.severence_content_version === null &&
      value.chosen_at !== null
    )

  return (
    value.severence_id !== null &&
    value.severence_content_version !== null &&
    value.ascension_id === null &&
    value.ascension_content_version === null &&
    value.chosen_at !== null
  )
}

const supernaturalStoryStateRowSchema = z
  .object(supernaturalStateShape)
  .strict()
  .refine(validIdentityShape, { message: 'Invalid supernatural identity shape.' })

const supernaturalStoryTransitionRowSchema = z
  .object({
    ...supernaturalStateShape,
    replayed: z.boolean(),
  })
  .strict()
  .refine(validIdentityShape, { message: 'Invalid supernatural identity shape.' })

export type SupernaturalStoryStateRow = z.infer<typeof supernaturalStoryStateRowSchema>
export type SupernaturalStoryTransitionRow = z.infer<typeof supernaturalStoryTransitionRowSchema>

export function parseSupernaturalStoryStateRow(input: unknown): SupernaturalStoryStateRow | null {
  const parsed = supernaturalStoryStateRowSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

export function parseSupernaturalStoryTransitionRow(
  input: unknown,
): SupernaturalStoryTransitionRow | null {
  const parsed = supernaturalStoryTransitionRowSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

const authoredSupernaturalTransitionRequestSchema = z
  .object({
    expectedStateVersion: positiveVersion,
    idempotencyKey: z.string().uuid(),
    transitionId: stableId,
    transitionContentVersion: positiveVersion,
    confirmPermanentChoice: z.literal(true),
  })
  .strict()

export type AuthoredSupernaturalTransitionRequest = z.infer<
  typeof authoredSupernaturalTransitionRequestSchema
>

export function parseAuthoredSupernaturalTransitionRequest(
  input: unknown,
): AuthoredSupernaturalTransitionRequest | null {
  const parsed = authoredSupernaturalTransitionRequestSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}
