import { z } from 'zod'

const authorityProbeRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
  })
  .strict()

const authorityProbePersistenceRowSchema = z
  .object({
    receipt_id: z.string().uuid(),
    accepted_at: z.string().datetime({ offset: true }),
    replayed: z.boolean(),
  })
  .strict()

const authorityProbePersistenceRowsSchema = z.array(authorityProbePersistenceRowSchema).length(1)

export type AuthorityProbeRequest = z.infer<typeof authorityProbeRequestSchema>
export type AuthorityProbePersistenceRow = z.infer<typeof authorityProbePersistenceRowSchema>

export function parseAuthorityProbeRequest(input: unknown): AuthorityProbeRequest | null {
  const result = authorityProbeRequestSchema.safeParse(input)
  return result.success ? result.data : null
}

export function parseAuthorityProbePersistenceRows(
  input: unknown,
): AuthorityProbePersistenceRow | null {
  const result = authorityProbePersistenceRowsSchema.safeParse(input)
  return result.success ? result.data[0] : null
}
