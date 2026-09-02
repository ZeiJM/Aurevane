'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type InspectCloseHandler = () => void
type FinishTurnHandler = () => boolean

type BattleInteractionLifecycleValue = {
  registerInspectCloseHandler: (handler: InspectCloseHandler) => () => void
  closeInspectMode: () => void
  registerFinishTurnHandler: (handler: FinishTurnHandler) => () => void
  requestFinishTurn: () => boolean
  finishTurnReady: boolean
}

const EMPTY_LIFECYCLE: BattleInteractionLifecycleValue = {
  registerInspectCloseHandler: () => () => undefined,
  closeInspectMode: () => undefined,
  registerFinishTurnHandler: () => () => undefined,
  requestFinishTurn: () => false,
  finishTurnReady: false,
}

const BattleInteractionLifecycleContext =
  createContext<BattleInteractionLifecycleValue>(EMPTY_LIFECYCLE)

export function BattleInteractionLifecycleProvider({ children }: { children: ReactNode }) {
  const inspectCloseHandlerRef = useRef<InspectCloseHandler | null>(null)
  const finishTurnHandlerRef = useRef<FinishTurnHandler | null>(null)
  const [finishTurnReady, setFinishTurnReady] = useState(false)

  const registerInspectCloseHandler = useCallback((handler: InspectCloseHandler) => {
    inspectCloseHandlerRef.current = handler
    return () => {
      if (inspectCloseHandlerRef.current === handler) inspectCloseHandlerRef.current = null
    }
  }, [])

  const closeInspectMode = useCallback(() => {
    inspectCloseHandlerRef.current?.()
  }, [])

  const registerFinishTurnHandler = useCallback((handler: FinishTurnHandler) => {
    // Readiness follows the live BattleExperience handler rather than DOM/hydration timing.
    finishTurnHandlerRef.current = handler
    setFinishTurnReady(true)
    return () => {
      if (finishTurnHandlerRef.current !== handler) return
      finishTurnHandlerRef.current = null
      setFinishTurnReady(false)
    }
  }, [])

  const requestFinishTurn = useCallback(() => finishTurnHandlerRef.current?.() ?? false, [])

  const value = useMemo(
    () => ({
      registerInspectCloseHandler,
      closeInspectMode,
      registerFinishTurnHandler,
      requestFinishTurn,
      finishTurnReady,
    }),
    [
      closeInspectMode,
      finishTurnReady,
      registerFinishTurnHandler,
      registerInspectCloseHandler,
      requestFinishTurn,
    ],
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
