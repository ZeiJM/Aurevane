'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { BattleInfoPopover } from './battle-info-popover'
import { BATTLE_MOBILE_LAYOUT_QUERY } from './battle-responsive-layout'

const subscribe = (listener: () => void) => {
  const media = window.matchMedia(BATTLE_MOBILE_LAYOUT_QUERY)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
const getMobile = () => window.matchMedia(BATTLE_MOBILE_LAYOUT_QUERY).matches
const getServerMobile = () => false
const PreviewInfoContext = createContext<{
  host: HTMLDivElement | null
  setHost: (host: HTMLDivElement | null) => void
  mobile: boolean
  selected: string | null
  setSelected: (key: string | null) => void
} | null>(null)

function selectionKey(target: Element): string | null {
  const reader = target.closest('[data-battle-preview-reader]')
  if (reader) return reader.getAttribute('data-battle-preview-reader')
  const card = target.closest(
    '[data-command-card], [data-battle-skill-slot], [data-battle-special]',
  )
  if (!card) return null
  const slot = card.getAttribute('data-battle-skill-slot')
  return slot
    ? `skill${slot}`
    : (card.getAttribute('data-command-card') ??
        (card.getAttribute('data-battle-special') === 'resonance'
          ? 'essence'
          : card.getAttribute('data-battle-special')))
}

export function BattleCockpitInfoProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const mobile = useSyncExternalStore(subscribe, getMobile, getServerMobile)
  useEffect(() => {
    if (!mobile) return
    const root = host?.closest('main')
    if (!root) return
    const select = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target || target.closest('[data-battle-info-panel]')) return
      // Reader dismissal consumes the gesture, so it cannot also select a command below it.
      if (
        document.querySelector('[data-battle-info-panel]') &&
        !target.closest('[data-battle-preview-reader]')
      )
        return
      const key = selectionKey(target)
      if (key) setSelected(key)
      else if (target.closest('footer')) setSelected(null)
    }
    const clear = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[data-battle-info-panel]'))
        setSelected(null)
    }
    root.addEventListener('pointerdown', select, true)
    root.addEventListener('click', select)
    root.addEventListener('keydown', clear)
    return () => {
      root.removeEventListener('pointerdown', select, true)
      root.removeEventListener('click', select)
      root.removeEventListener('keydown', clear)
    }
  }, [host, mobile])
  return (
    <PreviewInfoContext.Provider value={{ host, setHost, mobile, selected, setSelected }}>
      {children}
    </PreviewInfoContext.Provider>
  )
}

export function BattlePreviewInfoMenu({ actionKey = 'none' }: { actionKey?: string }) {
  const context = useContext(PreviewInfoContext)
  const { host, mobile, setSelected } = context ?? {}
  useEffect(() => {
    if (!mobile || !setSelected) return
    if (actionKey.startsWith('none')) {
      setSelected(null)
      return
    }
    const active = host
      ?.closest('main')
      ?.querySelector(
        '[data-battle-active="true"], [data-unified-command-deck] [aria-pressed="true"]',
      )
    setSelected(active ? selectionKey(active) : null)
  }, [actionKey, host, mobile, setSelected])
  return <div ref={context?.setHost} data-battle-preview-info="true" />
}

/** Keep each full report mounted for reader shortcuts; expose only the selected report on touch. */
export function BattleCockpitInfo({
  selectionKey: key,
  ...props
}: ComponentProps<typeof BattleInfoPopover> & { selectionKey: string }) {
  const context = useContext(PreviewInfoContext)
  if (context?.mobile)
    return context.host
      ? createPortal(
          <span data-battle-preview-reader={key} hidden={context.selected !== key}>
            <BattleInfoPopover {...props} />
          </span>,
          context.host,
        )
      : null
  return <BattleInfoPopover {...props} />
}
