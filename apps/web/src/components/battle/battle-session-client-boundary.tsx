'use client'

import { useEffect } from 'react'

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
  useEffect(() => {
    const originalFetch = window.fetch
    const abortPath = `/api/battles/${battleSessionId}/abort`

    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init)
      const requestUrl = readRequestUrl(input)
      const requestMethod = readRequestMethod(input, init)
      const pathname = new URL(requestUrl, window.location.origin).pathname

      if (requestMethod === 'POST' && pathname === abortPath && response.ok) {
        try {
          const body = (await response.clone().json()) as BattleStateResponse
          if (body.battle?.snapshot.tactical.battle.lifecycle === 'abandoned') {
            window.location.replace('/game/battle')
          }
        } catch {
          // The normal battle UI remains responsible for surfacing malformed abort responses.
        }
      }

      return response
    }

    window.fetch = wrappedFetch
    return () => {
      if (window.fetch === wrappedFetch) window.fetch = originalFetch
    }
  }, [battleSessionId])

  return null
}

function readRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function readRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase()
  if (input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}
