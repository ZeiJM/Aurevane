'use client'

import { useEffect, useRef } from 'react'
import { useAudioRuntime } from '@/components/audio/audio-provider'
import { BattleAudioCursor, type BattleAudioCue } from '@/media/battle-audio'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

export function BattleCommittedAudio({
  battleSessionId,
  initialVersion,
  mode,
}: {
  battleSessionId: string
  initialVersion: number
  mode: 'pve' | 'pvp'
}) {
  const { audioState, settings, playAsset, stopSfx } = useAudioRuntime()
  const cursor = useRef(new BattleAudioCursor(initialVersion))
  const enabled =
    audioState === 'ready' &&
    !settings.muted &&
    settings.volumes.master > 0 &&
    settings.volumes.sfx > 0

  useEffect(() => {
    let controller: AbortController | null = null
    let skipNext = document.hidden
    const stop = () => {
      controller?.abort()
      stopSfx()
    }
    const visibility = () => {
      skipNext = true
      stop()
    }
    const receive = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const battle = event.detail as BattleSessionView | undefined
      if (!battle || battle.battleSessionId !== battleSessionId) return
      if (battle.battleVersion <= cursor.current.currentVersion) return
      const fresh = cursor.current.advance(battle.battleVersion, battle.replayed)
      stop()
      if (!fresh) return
      if (!enabled || document.hidden || skipNext) {
        skipNext = false
        return
      }
      const requestController = new AbortController()
      controller = requestController
      const started = performance.now()
      void (async () => {
        try {
          const response = await fetch(
            `/api/battles/${encodeURIComponent(battleSessionId)}/audio?mode=${mode}&version=${battle.battleVersion}`,
            {
              cache: 'no-store',
              signal: requestController.signal,
            },
          )
          if (!response.ok) return
          const body = (await response.json()) as { battleVersion: number; cues: BattleAudioCue[] }
          if (
            requestController.signal.aborted ||
            document.hidden ||
            performance.now() - started > 2000 ||
            body.battleVersion !== battle.battleVersion
          )
            return
          for (const cue of body.cues.slice(0, 2)) {
            void playAsset(cue.assetId, cue.priority).catch(() => false)
          }
        } catch {
          // Optional media failure must never interrupt a committed battle action.
        }
      })()
    }
    window.addEventListener('aurevane:battle-state', receive)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      stop()
      window.removeEventListener('aurevane:battle-state', receive)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [battleSessionId, enabled, mode, playAsset, stopSfx])
  return null
}
