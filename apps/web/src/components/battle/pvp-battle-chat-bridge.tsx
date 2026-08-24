'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'

import type { PvpSpectatorPresenceView } from '@/server/battle/pvp-battle-communication-service'
import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'

import { PvpBattleChat } from './pvp-battle-chat'
import styles from './pvp-battle-chat-bridge.module.css'

const DESKTOP_QUERY = '(min-width: 821px)'
const VIEWPORT_MARGIN = 4
const MIN_WINDOW_WIDTH = 256
const MIN_WINDOW_HEIGHT = 160

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? ''
}

function battleRoot(): HTMLElement | Document {
  return document.querySelector<HTMLElement>('main[data-pvp-battle="true"]') ?? document
}

function findChatButton(): HTMLButtonElement | null {
  return (
    Array.from(battleRoot().querySelectorAll<HTMLButtonElement>('footer button')).find((button) =>
      /^chat\b/i.test(textOf(button)),
    ) ?? null
  )
}

function findLogButton(): HTMLButtonElement | null {
  return (
    Array.from(battleRoot().querySelectorAll<HTMLButtonElement>('header button')).find((button) =>
      /combat log/i.test(textOf(button)),
    ) ?? null
  )
}

function findFooter(): HTMLElement | null {
  return battleRoot().querySelector<HTMLElement>('footer')
}

function lockWindowToCurrentRect(panel: HTMLElement) {
  const rect = panel.getBoundingClientRect()
  panel.style.left = `${rect.left}px`
  panel.style.top = `${rect.top}px`
  panel.style.width = `${rect.width}px`
  panel.style.height = `${rect.height}px`
  panel.style.right = 'auto'
  panel.style.bottom = 'auto'
  return rect
}

function SpectatorFooterControl({
  spectatorCount,
  spectators,
}: {
  spectatorCount: number
  spectators: readonly PvpSpectatorPresenceView[]
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function closeOutside(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (wrapRef.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside, true)
    return () => document.removeEventListener('pointerdown', closeOutside, true)
  }, [open])

  return (
    <div ref={wrapRef} className={styles.footerPresence} data-pvp-footer-presence="true">
      <button
        type="button"
        className={styles.footerPresenceButton}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>◉</span>
        <strong>{spectatorCount}</strong>
        <small>Spectators</small>
      </button>
      {open ? (
        <div className={styles.footerPresenceList} role="dialog" aria-label="Current spectators">
          <strong>Spectators</strong>
          {spectators.length > 0 ? (
            spectators.map((spectator, index) => (
              <span key={`${spectator.name}:${spectator.lastSeenAt}:${index}`}>
                {spectator.name}
              </span>
            ))
          ) : (
            <span>No spectators</span>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function PvpBattleChatBridge({
  battleSessionId,
  metadata,
}: {
  battleSessionId: string
  metadata: PvpBattleMetadata
}) {
  const [open, setOpen] = useState(false)
  const [requestedTab, setRequestedTab] = useState<'chat' | 'log'>('chat')
  const [unread, setUnread] = useState(0)
  const [desktop, setDesktop] = useState(false)
  const [spectatorCount, setSpectatorCount] = useState(0)
  const [spectators, setSpectators] = useState<PvpSpectatorPresenceView[]>([])
  const [footerTarget, setFooterTarget] = useState<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const combatantNames = useMemo(
    () =>
      Object.fromEntries(
        metadata.participants.map((participant) => [
          participant.combatantId,
          participant.characterName,
        ]),
      ),
    [metadata.participants],
  )

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const sync = () => setDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    let frame = 0
    const locate = () => setFooterTarget((current) => findFooter() ?? current)
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(locate)
    }
    locate()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    let attachedChat: HTMLButtonElement | null = null
    let attachedLog: HTMLButtonElement | null = null
    let badge: HTMLSpanElement | null = null

    const openChat = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      setRequestedTab('chat')
      setUnread(0)
      setOpen((current) => (requestedTab === 'chat' ? !current : true))
    }

    const openLog = (event: Event) => {
      if (desktop) return
      event.preventDefault()
      event.stopPropagation()
      setRequestedTab('log')
      setOpen(true)
    }

    const sync = () => {
      const chatButton = findChatButton()
      if (chatButton && attachedChat !== chatButton) {
        attachedChat?.removeEventListener('click', openChat, true)
        attachedChat = chatButton
        attachedChat.addEventListener('click', openChat, true)
        attachedChat.setAttribute('aria-controls', 'pvp-battle-chat-panel')
      }

      const logButton = findLogButton()
      if (!desktop && logButton && attachedLog !== logButton) {
        attachedLog?.removeEventListener('click', openLog, true)
        attachedLog = logButton
        attachedLog.addEventListener('click', openLog, true)
        attachedLog.setAttribute('aria-controls', 'pvp-battle-chat-panel')
      } else if (desktop && attachedLog) {
        attachedLog.removeEventListener('click', openLog, true)
        attachedLog = null
      }

      if (chatButton) {
        badge = chatButton.querySelector<HTMLSpanElement>('[data-pvp-chat-badge]')
        if (unread > 0) {
          if (!badge) {
            badge = document.createElement('span')
            badge.dataset.pvpChatBadge = 'true'
            badge.className = styles.triggerBadge
            chatButton.appendChild(badge)
          }
          badge.textContent = 'NEW'
        } else {
          badge?.remove()
          badge = null
        }
        chatButton.setAttribute('aria-expanded', open && requestedTab === 'chat' ? 'true' : 'false')
        chatButton.dataset.hasUnread = unread > 0 ? 'true' : ''
      }

      if (!desktop && logButton) {
        logButton.setAttribute('aria-expanded', open && requestedTab === 'log' ? 'true' : 'false')
      }
    }

    sync()
    const observer = new MutationObserver(() => window.requestAnimationFrame(sync))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      attachedChat?.removeEventListener('click', openChat, true)
      attachedLog?.removeEventListener('click', openLog, true)
      badge?.remove()
    }
  }, [desktop, open, requestedTab, unread])

  useEffect(() => {
    if (!desktop || open) return
    const panel = panelRef.current
    if (!panel) return
    panel.style.removeProperty('left')
    panel.style.removeProperty('top')
    panel.style.removeProperty('right')
    panel.style.removeProperty('bottom')
    panel.style.removeProperty('width')
    panel.style.removeProperty('height')
  }, [desktop, open])

  useEffect(() => {
    if (!desktop || !open) return
    function closeOutside(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (panelRef.current?.contains(event.target)) return
      if (findChatButton()?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside, true)
    return () => document.removeEventListener('pointerdown', closeOutside, true)
  }, [desktop, open])

  function beginDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!desktop || event.button !== 0) return
    if ((event.target as Element | null)?.closest('button, input, textarea, select, a')) return
    const panel = panelRef.current
    if (!panel) return
    const rect = lockWindowToCurrentRect(panel)
    const startX = event.clientX
    const startY = event.clientY

    function move(moveEvent: PointerEvent) {
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(
          window.innerWidth - rect.width - VIEWPORT_MARGIN,
          rect.left + moveEvent.clientX - startX,
        ),
      )
      const top = Math.max(
        VIEWPORT_MARGIN,
        Math.min(
          window.innerHeight - rect.height - VIEWPORT_MARGIN,
          rect.top + moveEvent.clientY - startY,
        ),
      )
      panel.style.left = `${left}px`
      panel.style.top = `${top}px`
    }

    const finish = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  function beginResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!desktop || event.button !== 0) return
    const panel = panelRef.current
    if (!panel) return
    event.preventDefault()
    event.stopPropagation()
    const rect = lockWindowToCurrentRect(panel)
    const startX = event.clientX
    const startY = event.clientY

    function move(moveEvent: PointerEvent) {
      const maxWidth = Math.max(MIN_WINDOW_WIDTH, window.innerWidth - rect.left - VIEWPORT_MARGIN)
      const maxHeight = Math.max(MIN_WINDOW_HEIGHT, window.innerHeight - rect.top - VIEWPORT_MARGIN)
      panel.style.width = `${Math.max(MIN_WINDOW_WIDTH, Math.min(maxWidth, rect.width + moveEvent.clientX - startX))}px`
      panel.style.height = `${Math.max(MIN_WINDOW_HEIGHT, Math.min(maxHeight, rect.height + moveEvent.clientY - startY))}px`
    }

    const finish = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  return (
    <>
      <div
        ref={panelRef}
        id="pvp-battle-chat-panel"
        className={styles.panel}
        data-open={open || undefined}
        data-desktop={desktop || undefined}
        aria-hidden={!open}
      >
        <div className={styles.panelTop} onPointerDown={beginDrag}>
          <div>
            <strong>Battle Chat</strong>
            <small>{desktop ? 'Drag header · resize corner' : 'Shared battle communication'}</small>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setOpen(false)}
            aria-label="Close battle communication"
          >
            ×
          </button>
        </div>
        <PvpBattleChat
          battleSessionId={battleSessionId}
          readOnly={false}
          open={open}
          localCharacterId={metadata.localCharacterId}
          showBattleLog={!desktop}
          showSpectatorPresence={false}
          requestedTab={desktop ? 'chat' : requestedTab}
          onRequestedTabChange={setRequestedTab}
          onUnreadChange={setUnread}
          onSpectatorCountChange={setSpectatorCount}
          onSpectatorsChange={setSpectators}
          combatantNames={combatantNames}
        />
        <button
          type="button"
          className={styles.resizeGrip}
          aria-label="Resize battle chat"
          onPointerDown={beginResize}
        >
          <span aria-hidden="true">⌟</span>
        </button>
      </div>
      {footerTarget
        ? createPortal(
            <SpectatorFooterControl spectatorCount={spectatorCount} spectators={spectators} />,
            footerTarget,
          )
        : null}
    </>
  )
}
