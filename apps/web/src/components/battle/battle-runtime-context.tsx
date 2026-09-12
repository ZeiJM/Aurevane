'use client'

import { createContext, useContext, type ReactNode } from 'react'

interface BattleRuntimeContextValue {
  playerName: string
  combatantAccents: Readonly<Record<string, string>>
  opponentNames: readonly string[] | null
}

const BattleRuntimeContext = createContext<BattleRuntimeContextValue | null>(null)

export function BattleRuntimeProvider({
  playerName,
  combatantAccents = {},
  opponentNames = null,
  children,
}: {
  playerName: string
  combatantAccents?: Readonly<Record<string, string>>
  opponentNames?: readonly string[] | null
  children: ReactNode
}) {
  return (
    <BattleRuntimeContext.Provider value={{ playerName, combatantAccents, opponentNames }}>
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

export function useBattleOpponentNames(): readonly string[] | null {
  return useContext(BattleRuntimeContext)?.opponentNames ?? null
}
