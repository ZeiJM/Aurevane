'use client'

import { createContext, useContext, type ReactNode } from 'react'

interface BattleRuntimeContextValue {
  playerName: string
  combatantAccents: Readonly<Record<string, string>>
}

const BattleRuntimeContext = createContext<BattleRuntimeContextValue | null>(null)

export function BattleRuntimeProvider({
  playerName,
  combatantAccents = {},
  children,
}: {
  playerName: string
  combatantAccents?: Readonly<Record<string, string>>
  children: ReactNode
}) {
  return (
    <BattleRuntimeContext.Provider value={{ playerName, combatantAccents }}>
      {children}
    </BattleRuntimeContext.Provider>
  )
}

export function useBattlePlayerName(): string | null {
  return useContext(BattleRuntimeContext)?.playerName ?? null
}

export function useBattleCombatantAccents(): Readonly<Record<string, string>> {
  return useContext(BattleRuntimeContext)?.combatantAccents ?? {}
}
