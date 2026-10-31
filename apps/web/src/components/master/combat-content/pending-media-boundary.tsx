'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  type ReactNode,
} from 'react'

type PendingMediaReport = (id: string, pending: boolean) => void
const PendingMediaContext = createContext<PendingMediaReport | null>(null)

/** One finished upload cannot clear another editor's unsaved-file guard. */
export function createPendingMediaTracker(onChange: (pending: boolean) => void) {
  const editors = new Set<string>()
  return {
    report(id: string, pending: boolean) {
      const before = editors.size > 0
      if (pending) editors.add(id)
      else editors.delete(id)
      if (before !== editors.size > 0) onChange(editors.size > 0)
    },
    clear() {
      if (editors.size) {
        editors.clear()
        onChange(false)
      }
    },
  }
}

export function PendingMediaBoundary({
  onChange,
  children,
}: {
  onChange: (pending: boolean) => void
  children: ReactNode
}) {
  const tracker = useMemo(() => createPendingMediaTracker(onChange), [onChange])
  useEffect(() => () => tracker.clear(), [tracker])
  return (
    <PendingMediaContext.Provider value={tracker.report}>{children}</PendingMediaContext.Provider>
  )
}

export function usePendingMediaReport(fallback?: (pending: boolean) => void) {
  const report = useContext(PendingMediaContext)
  const id = useId()
  return useCallback(
    (pending: boolean) => {
      if (report) report(id, pending)
      else fallback?.(pending)
    },
    [report, id, fallback],
  )
}
