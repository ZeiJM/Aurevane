import 'server-only'

import type { PlayerProfileRepository } from '@aurevane/db/player-profile'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  DEFAULT_COMBAT_KEYBINDS,
  parseCombatKeybindMap,
  type CombatKeybindMap,
} from '@aurevane/validation/player/combat-controls'
import { parsePlayerProfilePersistenceRow } from '@aurevane/validation/player/profile'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function loadPlayerCombatControls(
  actor: AuthenticatedActor,
  repository: PlayerProfileRepository,
): Promise<CombatKeybindMap> {
  const profile = await repository.findByUserId(actor.userId)
  if (!profile || profile.userId !== actor.userId) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Account controls are unavailable.')
  }

  return parseCombatKeybindMap(profile.combatKeybinds) ?? DEFAULT_COMBAT_KEYBINDS
}

export async function savePlayerCombatControls(
  actor: AuthenticatedActor,
  input: unknown,
): Promise<CombatKeybindMap> {
  const bindings = parseCombatKeybindMap(input)
  if (!bindings) {
    throw new AurevaneError('INVALID_REQUEST', 'Combat keybinds are invalid or contain conflicts.')
  }

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('player_profiles')
    .update({ combat_keybinds: bindings })
    .eq('user_id', actor.userId)
    .select('user_id, created_at, combat_keybinds')
    .maybeSingle()

  if (error || !data) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Account controls could not be saved.')
  }

  const persisted = parsePlayerProfilePersistenceRow(data)
  if (!persisted || persisted.user_id !== actor.userId) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Account controls could not be verified.')
  }

  return persisted.combat_keybinds
}
