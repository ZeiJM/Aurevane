import { z } from 'zod'

import {
  DEFAULT_COMBAT_KEYBINDS,
  combatKeybindMapSchema,
  parseCombatKeybindMap,
} from './combat-controls'

const playerProfilePersistenceRowSchema = z
  .object({
    user_id: z.string().uuid(),
    created_at: z.string().datetime({ offset: true }),
    combat_keybinds: z.preprocess(
      (value) => (value === undefined ? DEFAULT_COMBAT_KEYBINDS : parseCombatKeybindMap(value)),
      combatKeybindMapSchema,
    ),
  })
  .strict()

export type PlayerProfilePersistenceRow = z.infer<typeof playerProfilePersistenceRowSchema>

export function parsePlayerProfilePersistenceRow(
  input: unknown,
): PlayerProfilePersistenceRow | null {
  const result = playerProfilePersistenceRowSchema.safeParse(input)
  return result.success ? result.data : null
}
