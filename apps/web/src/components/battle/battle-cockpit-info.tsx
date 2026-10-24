'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { BattleInfoPopover } from './battle-info-popover'
import { BATTLE_MOBILE_LAYOUT_QUERY } from './battle-responsive-layout'

const mobileQuery = BATTLE_MOBILE_LAYOUT_QUERY
const subscribe = (listener: () => void) => {
  const media = window.matchMedia(mobileQuery)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
const getMobile = () => window.matchMedia(mobileQuery).matches
const getServerMobile = () => false
const PreviewInfoContext = createContext<{
  host: HTMLDivElement | null
  setHost: (host: HTMLDivElement | null) => void
  mobile: boolean
} | null>(null)

export function BattleCockpitInfoProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const mobile = useSyncExternalStore(subscribe, getMobile, getServerMobile)
  return (
    <PreviewInfoContext.Provider value={{ host, setHost, mobile }}>
      {children}
    </PreviewInfoContext.Provider>
  )
}

export function BattlePreviewInfoMenu() {
  const context = useContext(PreviewInfoContext)
  const menuRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (!context?.mobile && menuRef.current) menuRef.current.open = false
  }, [context?.mobile])
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuRef.current) menuRef.current.open = false
    }
    const closeOutside = (event: MouseEvent) => {
      const menu = menuRef.current
      const target = event.target instanceof Element ? event.target : null
      if (
        !menu?.open ||
        !target ||
        menu.contains(target) ||
        target.closest('[data-battle-info-panel]')
      )
        return
      menu.open = false
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener('keydown', closeOnEscape, true)
    document.addEventListener('click', closeOutside, true)
    return () => {
      document.removeEventListener('keydown', closeOnEscape, true)
      document.removeEventListener('click', closeOutside, true)
    }
  }, [])
  return (
    <details ref={menuRef} data-battle-preview-info="true">
      <summary aria-label="Skill information">i</summary>
      <div ref={context?.setHost} data-battle-preview-info-options="true" />
    </details>
  )
}

/** Keep the complete existing readers available from one mobile preview menu. */
export function BattleCockpitInfo(props: ComponentProps<typeof BattleInfoPopover>) {
  const context = useContext(PreviewInfoContext)
  if (context?.mobile)
    return context.host
      ? createPortal(
          <BattleInfoPopover {...props} trigger={props.title ?? props.label} />,
          context.host,
        )
      : null
  return <BattleInfoPopover {...props} />
}
