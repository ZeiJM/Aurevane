from pathlib import Path
import re


def sub(path: str, pattern: str, replacement: str) -> None:
    file = Path(path)
    text = file.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement for {pattern!r}, got {count}')
    file.write_text(updated)


runtime = 'apps/web/src/components/battle/battle-runtime.ts'
sub(
    runtime,
    r"export type BattleRuntime =",
    """export interface BattleResonancePresentation {
  id: string
  contentVersion: number
  name: string
  description: string
}

export type BattleRuntime =""",
)
sub(runtime, r"(kind: 'pve'\n)", r"\1      resonance?: BattleResonancePresentation | null\n")
sub(runtime, r"(kind: 'pvp'\n)", r"\1      resonance?: BattleResonancePresentation | null\n")

boundary = 'apps/web/src/components/battle/battle-client-boundary.tsx'
sub(
    boundary,
    r"(import \{ BattlePresentationPolish \} from './battle-presentation-polish'\n)",
    r"\1import { BattleResonanceIndicator } from './battle-resonance-indicator'\n",
)
sub(
    boundary,
    r"(        <BattleStatusEffectAssist />\n)",
    r"\1        {runtime.resonance ? <BattleResonanceIndicator resonance={runtime.resonance} /> : null}\n",
)

page = 'apps/web/src/app/game/battle/[battleSessionId]/page.tsx'
sub(
    page,
    r"(import \{ isStarterCharacterPortraitRef \} from '@aurevane/game-core/character/starter-options'\n)",
    r"\1import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'\n",
)
sub(
    page,
    r"(import \{ createSupabaseBattleSessionRepository \} from '@/server/battle/supabase-battle-session-repository'\n)",
    r"\1import { loadCharacterCommittedBuildSnapshot } from '@/server/character/character-build-service'\n",
)
sub(
    page,
    r"(import \{ createSupabaseCharacterRepository \} from '@/server/character/supabase-character-repository'\n)",
    r"import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'\n\1",
)
sub(
    page,
    r"(export const dynamic = 'force-dynamic'\n)",
    r"""\1
async function loadBattleResonance(userId: string, characterId: string) {
  try {
    const snapshot = await loadCharacterCommittedBuildSnapshot(
      userId,
      characterId,
      createSupabaseCharacterBuildRepository(),
    )
    const reference = snapshot.extensions.resonance
    if (!reference) return null
    const definition = resolveResonanceForPair(
      snapshot.primary.disciplineId,
      snapshot.secondary?.disciplineId ?? null,
      reference.contentVersion,
    )
    if (!definition || definition.id !== reference.resonanceId) return null
    return {
      id: definition.id,
      contentVersion: definition.contentVersion,
      name: definition.name,
      description: definition.description,
    }
  } catch {
    return null
  }
}
""",
)
sub(
    page,
    r"(kind: 'pvp',\n\s*playerName: character\.name,\n)",
    r"\1            resonance: await loadBattleResonance(actor.userId, character.id),\n",
)
sub(
    page,
    r"(kind: 'pve',\n\s*playerName: character\.name,\n)",
    r"\1          resonance: await loadBattleResonance(actor.userId, character.id),\n",
)
