import { z } from 'zod'

const playerProfilePersistenceRowSchema = z
  .object({
    user_id: z.string().uuid(),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict()

export type PlayerProfilePersistenceRow = z.infer<typeof playerProfilePersistenceRowSchema>

export function parsePlayerProfilePersistenceRow(
  input: unknown,
): PlayerProfilePersistenceRow | null {
  const result = playerProfilePersistenceRowSchema.safeParse(input)
  return result.success ? result.data : null
}
