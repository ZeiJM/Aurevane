'use client'

import { useEffect, useState } from 'react'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleCompletionPanel } from './battle-completion-panel'

interface PveBattleCompletionBridgeProps {
  initialBattle: BattleSessionView
}

function completedBattle(battle: BattleSessionView): BattleSessionView | null {
  return battle.snapshot.tactical.battle.lifecycle === 'completed' ? battle : null
}

export function PveBattleCompletionBridge({ initialBattle }: PveBattleCompletionBridgeProps) {
  const [battle, setBattle] = useState<BattleSessionView | null>(() => completedBattle(initialBattle))

  useEffect(() => {
    const handleBattleState = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const next = event.detail as BattleSessionView | undefined
      if (!next || next.battleSessionId !== initialBattle.battleSessionId) return
      setBattle(completedBattle(next))
    }

    window.addEventListener('aurevane:battle-state', handleBattleState)
    return () => window.removeEventListener('aurevane:battle-state', handleBattleState)
  }, [initialBattle.battleSessionId])

  return battle ? <BattleCompletionPanel battle={battle} /> : null
}
