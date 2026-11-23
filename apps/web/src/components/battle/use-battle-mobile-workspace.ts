'use client'

import { useCallback } from 'react'
import { useBattleSessionUiBoolean } from './battle-session-ui-state'

export type BattleMobileWorkspace = 'actions' | 'log' | 'chat'

/** The playable battle and its transport bridge share one mobile reading surface. */
export function useBattleMobileWorkspace(battleSessionId: string) {
  const [logOpen, setLogOpen] = useBattleSessionUiBoolean(battleSessionId, 'mobileLogOpen')
  const [chatOpen, setChatOpen] = useBattleSessionUiBoolean(battleSessionId, 'mobileChatOpen')
  const workspace: BattleMobileWorkspace = chatOpen ? 'chat' : logOpen ? 'log' : 'actions'
  const selectWorkspace = useCallback(
    (next: BattleMobileWorkspace) => {
      setLogOpen(next === 'log')
      setChatOpen(next === 'chat')
      window.dispatchEvent(
        new CustomEvent('aurevane:battle-mobile-workspace-change', {
          detail: { battleSessionId, workspace: next },
        }),
      )
    },
    [battleSessionId, setChatOpen, setLogOpen],
  )
  return [workspace, selectWorkspace] as const
}
