'use client'

import { classifyFacingRelation } from '@aurevane/game-core/combat/board'
import { useEffect, useMemo, useState } from 'react'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

import styles from './battle-facing-context.module.css'

interface BattleFacingContextProps {
  initialBattle: BattleSessionView
}

interface BattleResponse {
  battle?: BattleSessionView
}

function combatantLabel(combatantId: string): string {
  if (combatantId.startsWith('character:')) return 'Wayfarer'
  if (combatantId.startsWith('recruit:')) return 'Recruit'
  return 'Combatant'
}

export function BattleFacingContext({ initialBattle }: BattleFacingContextProps) {
  const [battle, setBattle] = useState(initialBattle)

  useEffect(() => {
    let disposed = false

    async function refresh() {
      try {
        const response = await fetch(`/api/battles/${initialBattle.battleSessionId}`, {
          method: 'GET',
          cache: 'no-store',
        })
        if (!response.ok) return
        const body = (await response.json()) as BattleResponse
        if (!disposed && body.battle) setBattle(body.battle)
      } catch {
        // Context is informational. The authoritative cockpit owns recovery messaging.
      }
    }

    const interval = window.setInterval(() => void refresh(), 2500)
    window.addEventListener('online', refresh)
    return () => {
      disposed = true
      window.clearInterval(interval)
      window.removeEventListener('online', refresh)
    }
  }, [initialBattle.battleSessionId])

  const context = useMemo(() => {
    const tactical = battle.snapshot.tactical
    const activeId = tactical.battle.currentTurn?.combatantId
    if (!activeId) return null

    const activePlacement = tactical.placements.find(
      (placement) => placement.combatantId === activeId,
    )
    const otherPlacement = tactical.placements.find(
      (placement) => placement.combatantId !== activeId,
    )
    if (!activePlacement || !otherPlacement) return null

    return {
      target: combatantLabel(otherPlacement.combatantId),
      relation: classifyFacingRelation(
        otherPlacement.position,
        otherPlacement.facing,
        activePlacement.position,
      ),
    }
  }, [battle])

  if (!context) return null

  return (
    <aside
      className={styles.context}
      data-testid="battle-facing-context"
      aria-label="Facing context"
    >
      <span>Facing context</span>
      <strong>
        {context.target}: {context.relation}
      </strong>
      <small>relative to active actor</small>
    </aside>
  )
}
