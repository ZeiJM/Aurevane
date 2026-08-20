'use client'

import type { ImageAssetId } from '@/media/registry'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleExperienceV2 } from './battle-experience-v2'
import { BattleFeedbackAssist } from './battle-feedback-assist'
import { BattleKeyboardAssist } from './battle-keyboard-assist'
import { BattleLessonCoach } from './battle-lesson-coach'
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
      />
      <BattleLessonCoach battleSessionId={initialBattle.battleSessionId} />
      <BattleKeyboardAssist playerName={playerName} />
      <BattleFeedbackAssist playerName={playerName} playerProfileImageUrl={playerProfileImageUrl} />
    </BattleRuntimeProvider>
  )
}
