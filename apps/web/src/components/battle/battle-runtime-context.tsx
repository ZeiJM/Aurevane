'use client'

import { createContext, useContext, type ReactNode } from 'react'

interface BattleRuntimeContextValue {
  playerName: string
}

const BattleRuntimeContext = createContext<BattleRuntimeContextValue | null>(null)

export function BattleRuntimeProvider({
  playerName,
  children,
}: {
  playerName: string
  children: ReactNode
}) {
  return (
    <BattleRuntimeContext.Provider value={{ playerName }}>{children}</BattleRuntimeContext.Provider>
  )
}

export function useBattlePlayerName(): string | null {
  return useContext(BattleRuntimeContext)?.playerName ?? null
}
