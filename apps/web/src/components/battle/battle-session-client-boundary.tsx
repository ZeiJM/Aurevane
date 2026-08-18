'use client'

import { useEffect, useRef } from 'react'

import type { ImageAssetId } from '@/media/registry'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleExperienceV2 } from './battle-experience-v2'
import { BattleKeyboardAssist } from './battle-keyboard-assist'
import { BattleRuntimeProvider } from './battle-runtime-context'

interface BattleSessionClientBoundaryProps {
  initialBattle: BattleSessionView
  playerName: string
  playerPortraitAssetId: ImageAssetId
}

interface BattleStateResponse {
  battle?: BattleSessionView
}

const ABORT_CONFIRMATION_DELAYS_MS = [150, 250, 450, 750, 1_200] as const

export function BattleSessionClientBoundary({
  initialBattle,
  playerName,
  playerPortraitAssetId,
}: BattleSessionClientBoundaryProps) {
  return (
    <BattleRuntimeProvider playerName={playerName}>
      <AuthoritativeAbortNavigation battleSessionId={initialBattle.battleSessionId} />
      <BattleExperienceV2
        initialBattle={initialBattle}
        playerName={playerName}
        playerPortraitAssetId={playerPortraitAssetId}
      />
      <BattleKeyboardAssist />
    </BattleRuntimeProvider>
  )
}

function AuthoritativeAbortNavigation({ battleSessionId }: { battleSessionId: string }) {
  const checking = useRef(false)

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest('button')
      if (!button || button.textContent?.trim() !== 'Confirm Abort' || checking.current) return

      checking.current = true
      void confirmAuthoritativeAbort(battleSessionId).finally(() => {
        checking.current = false
      })
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [battleSessionId])

  return null
}

async function confirmAuthoritativeAbort(battleSessionId: string): Promise<void> {
  for (const delayMs of ABORT_CONFIRMATION_DELAYS_MS) {
    await delay(delayMs)

    try {
      const response = await fetch(`/api/battles/${battleSessionId}`, {
        method: 'GET',
        cache: 'no-store',
      })
      if (!response.ok) continue

      const body = (await response.json()) as BattleStateResponse
      if (body.battle?.snapshot.tactical.battle.lifecycle === 'abandoned') {
        window.location.replace('/game/battle')
        return
      }
    } catch {
      // The normal battle UI remains responsible for surfacing abort/network failures.
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}
