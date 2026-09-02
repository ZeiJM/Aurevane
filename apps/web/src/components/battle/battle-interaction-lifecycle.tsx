'use client'

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'

type InspectCloseHandler = () => void

type BattleInteractionLifecycleValue = {
  registerInspectCloseHandler: (handler: InspectCloseHandler) => () => void
  closeInspectMode: () => void
}

const EMPTY_LIFECYCLE: BattleInteractionLifecycleValue = {
  registerInspectCloseHandler: () => () => undefined,
  closeInspectMode: () => undefined,
}

const BattleInteractionLifecycleContext =
  createContext<BattleInteractionLifecycleValue>(EMPTY_LIFECYCLE)

export function BattleInteractionLifecycleProvider({ children }: { children: ReactNode }) {
  const inspectCloseHandlerRef = useRef<InspectCloseHandler | null>(null)

  const registerInspectCloseHandler = useCallback((handler: InspectCloseHandler) => {
    inspectCloseHandlerRef.current = handler
    return () => {
      if (inspectCloseHandlerRef.current === handler) inspectCloseHandlerRef.current = null
    }
  }, [])

  const closeInspectMode = useCallback(() => {
    inspectCloseHandlerRef.current?.()
  }, [])

  const value = useMemo(
    () => ({ registerInspectCloseHandler, closeInspectMode }),
    [closeInspectMode, registerInspectCloseHandler],
  )

  return (
    <BattleInteractionLifecycleContext.Provider value={value}>
      {children}
    </BattleInteractionLifecycleContext.Provider>
  )
}

export function useBattleInteractionLifecycle(): BattleInteractionLifecycleValue {
  return useContext(BattleInteractionLifecycleContext)
}
