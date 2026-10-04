'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BattleActionPreview } from '@/server/battle/battle-preview-service'
import {
  battleRangePreviewIntents,
  requestBattleRangePreviews,
  type BattleRangePreviewCombatant,
  type BattleRangePreviewSkill,
} from './battle-range-previews'

/** Independent read-only forecasts never arm, select or authorize a battle command. */
export function useBattleRangePreviews({
  battleSessionId,
  battleVersion,
  actorId,
  skill,
  combatants,
  enabled,
}: {
  battleSessionId: string
  battleVersion: number
  actorId: string | null
  skill: BattleRangePreviewSkill | null
  combatants: readonly BattleRangePreviewCombatant[]
  enabled: boolean
}) {
  const id = skill?.id
  const targetKind = skill?.targetKind
  const targetTeamPolicy = skill?.targetTeamPolicy
  const minimumRange = skill?.minimumRange
  const maximumRange = skill?.maximumRange
  const request = useMemo(() => {
    const descriptor =
      id &&
      targetKind &&
      targetTeamPolicy &&
      minimumRange !== undefined &&
      maximumRange !== undefined
        ? { id, targetKind, targetTeamPolicy, minimumRange, maximumRange }
        : null
    const intents = enabled ? battleRangePreviewIntents(descriptor, actorId, combatants) : []
    return {
      key: JSON.stringify([battleSessionId, battleVersion, actorId, id, enabled, intents]),
      intents,
      battleSessionId,
      battleVersion,
      actorId,
    }
  }, [
    actorId,
    battleSessionId,
    battleVersion,
    combatants,
    enabled,
    id,
    maximumRange,
    minimumRange,
    targetKind,
    targetTeamPolicy,
  ])
  const [result, setResult] = useState<{
    key: string
    previews: BattleActionPreview[]
  } | null>(null)

  useEffect(() => {
    if (request.intents.length === 0) return
    let current = true
    const controller = new AbortController()
    void requestBattleRangePreviews({ ...request, signal: controller.signal }).then((previews) => {
      if (current && !controller.signal.aborted) setResult({ key: request.key, previews })
    })
    return () => {
      current = false
      controller.abort()
    }
  }, [request])

  const current = result?.key === request.key ? result : null
  return {
    rangePreviews: enabled ? (current?.previews ?? []) : [],
    rangePreviewsPending: request.intents.length > 0 && current === null,
    rangePreviewActionId: enabled ? (id ?? null) : null,
  }
}
