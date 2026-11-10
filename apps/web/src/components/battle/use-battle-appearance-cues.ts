'use client'

import { useCallback, useState } from 'react'
import type { BattleLogView } from '@/server/battle/battle-log-service'
import { battleAppearanceCues } from './battle-appearance-cues'

export function useBattleAppearanceCues(battleSessionId: string, version: number) {
  const [initial] = useState({ battleSessionId, version })
  const [log, setLog] = useState<BattleLogView | null>(null)
  const onLogLoaded = useCallback((next: BattleLogView) => setLog(next), [])
  const cues =
    log?.battleSessionId === battleSessionId &&
    (battleSessionId !== initial.battleSessionId || version > initial.version)
      ? battleAppearanceCues(log.entries, version)
      : null
  return { cues, onLogLoaded }
}
