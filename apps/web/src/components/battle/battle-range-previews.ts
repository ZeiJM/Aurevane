import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import type { BattleActionPreview, BattlePreviewView } from '@/server/battle/battle-preview-service'
import type { BattleSkillForecastPresentation } from './battle-runtime'
import { selectBattleSkillPreviewIntent } from './battle-preview-selection'

export type BattleRangePreviewSkill = Pick<
  BattleSkillForecastPresentation,
  'id' | 'targetKind' | 'targetTeamPolicy' | 'minimumRange' | 'maximumRange'
>
export interface BattleRangePreviewCombatant {
  combatantId: string
  teamIndex: number
  hp: number
  position: { x: number; y: number }
}
type ActionIntent = Extract<BattleIntent, { kind: 'action' }>

/** Range/team filtering only narrows requests; every outcome still requires server legality. */
export function battleRangePreviewIntents(
  skill: BattleRangePreviewSkill | null,
  actorId: string | null,
  combatants: readonly BattleRangePreviewCombatant[],
): ActionIntent[] {
  if (!skill || skill.targetKind !== 'unit') return []
  return combatants.flatMap((combatant) => {
    const intent = selectBattleSkillPreviewIntent(skill, {
      actorId,
      selectedCombatantId: combatant.combatantId,
      selectedTile: null,
      combatants,
    })
    return intent?.kind === 'action' ? [intent] : []
  })
}

export async function requestBattleRangePreviews({
  battleSessionId,
  battleVersion,
  actorId,
  intents,
  signal,
  fetchPreview = fetch,
}: {
  battleSessionId: string
  battleVersion: number
  actorId: string | null
  intents: readonly ActionIntent[]
  signal: AbortSignal
  fetchPreview?: typeof fetch
}): Promise<BattleActionPreview[]> {
  const results = await Promise.all(
    intents.map(async (intent): Promise<BattleActionPreview | null> => {
      try {
        const response = await fetchPreview(`/api/battles/${battleSessionId}/preview`, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedBattleVersion: battleVersion, intent }),
        })
        const body = (await response.json()) as { battlePreview?: BattlePreviewView }
        const view = body.battlePreview
        const preview = view?.preview
        return !signal.aborted &&
          response.ok &&
          view?.battleSessionId === battleSessionId &&
          view.battleVersion === battleVersion &&
          preview?.kind === 'action' &&
          preview.legal &&
          preview.actorId === actorId &&
          preview.actionId === intent.actionId &&
          intent.target.kind === 'unit' &&
          preview.primaryCombatantId === intent.target.combatantId
          ? preview
          : null
      } catch {
        // Informational comparisons must never interrupt command execution or replace it.
        return null
      }
    }),
  )
  return results.filter((preview): preview is BattleActionPreview => preview !== null)
}
