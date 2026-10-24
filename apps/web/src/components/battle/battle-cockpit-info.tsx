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
import { restoreBattleKeyboardFocus } from './battle-keyboard-scope'
import { battleInfoPopoverSession } from './battle-info-popover-session'

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
    const hasChildReader = () => {
      const reader = menuRef.current
        ?.querySelector('[data-battle-info-trigger][aria-expanded="true"]')
        ?.getAttribute('aria-controls')
      return Boolean(reader && battleInfoPopoverSession.hasChild(reader))
    }
    const placeMenu = () => {
      const menu = menuRef.current
      if (!menu?.open) return
      const options = menu.querySelector<HTMLElement>('[data-battle-preview-info-options]')
      const content = menu.closest('[data-unified-battle-content]')?.getBoundingClientRect()
      if (!options || !content) return
      // Keep every choice above the real Chronicle/footer boundary, including two-row PvP.
      options.style.bottom = `${window.innerHeight - content.bottom + 8}px`
      options.style.maxHeight = `min(14rem, ${Math.max(32, content.height - 16)}px)`
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      const menu = menuRef.current
      if (event.key !== 'Escape' || !menu?.open || hasChildReader()) return
      menu.open = false
      // Closing the menu hides the reader's trigger; restore focus after its dismissal.
      restoreBattleKeyboardFocus()
    }
    const closeOutside = (event: MouseEvent) => {
      const menu = menuRef.current
      const target = event.target instanceof Element ? event.target : null
      if (
        !menu?.open ||
        !target ||
        menu.contains(target) ||
        target.closest('[data-battle-info-panel]') ||
        hasChildReader()
      )
        return
      menu.open = false
      restoreBattleKeyboardFocus()
      event.preventDefault()
      event.stopPropagation()
    }
    const menu = menuRef.current
    menu?.addEventListener('toggle', placeMenu)
    window.addEventListener('resize', placeMenu)
    document.addEventListener('keydown', closeOnEscape, true)
    document.addEventListener('click', closeOutside, true)
    return () => {
      menu?.removeEventListener('toggle', placeMenu)
      window.removeEventListener('resize', placeMenu)
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
