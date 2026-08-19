'use client'

import type { ImageAssetId } from '@/media/registry'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleExperienceV2 } from './battle-experience-v2'
import { BattleKeyboardAssist } from './battle-keyboard-assist'
import { BattleRuntimeProvider } from './battle-runtime-context'

interface BattleSessionClientBoundaryProps {
  initialBattle: BattleSessionView
  playerName: string
  playerPortraitAssetId: ImageAssetId
  playerProfileImageUrl?: string | null
}

export function BattleSessionClientBoundary({
  initialBattle,
  playerName,
  playerPortraitAssetId,
  playerProfileImageUrl = null,
}: BattleSessionClientBoundaryProps) {
  return (
    <BattleRuntimeProvider playerName={playerName}>
      <BattleExperienceV2
        initialBattle={initialBattle}
        playerName={playerName}
        playerPortraitAssetId={playerPortraitAssetId}
        playerProfileImageUrl={playerProfileImageUrl}
      />
      <BattleKeyboardAssist />
    </BattleRuntimeProvider>
  )
}
