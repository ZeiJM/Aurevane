'use client'

import type { PropsWithChildren } from 'react'

import { useAudioRuntime } from '@/components/audio/audio-provider'

export function BattleAudioGate({ children }: PropsWithChildren) {
  const { unlock } = useAudioRuntime()

  return (
    <div
      style={{ display: 'contents' }}
      onClickCapture={() => {
        void unlock().catch(() => undefined)
      }}
    >
      {children}
    </div>
  )
}
