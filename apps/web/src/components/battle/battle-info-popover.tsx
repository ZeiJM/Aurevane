'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { battleInfoPopoverPosition } from './battle-info-popover-position'
import { battleInfoPopoverSession } from './battle-info-popover-session'
import styles from './battle-info-popover.module.css'

/** Small reading panels share outside-click, Escape, focus and combat-shortcut behavior. */
export function BattleInfoPopover({
  label,
  description,
  title = label,
  trigger,
  className,
  children,
  hover = false,
  consumeOutsideClick = false,
  placement = 'auto',
}: {
  label: string
  description?: string
  title?: string
  trigger: ReactNode
  className?: string
  children: ReactNode
  hover?: boolean
  consumeOutsideClick?: boolean
  placement?: 'auto' | 'above'
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [wideReport, setWideReport] = useState(false)
  const [pageReport, setPageReport] = useState(false)
  const [position, setPosition] = useState({ left: 8, top: 8 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(false)
  const focusOnOpen = useRef(true)
  const suppressFocus = useRef(false)
  const suppressHover = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])
  const close = useCallback(() => {
    cancelClose()
    pinned.current = false
    battleInfoPopoverSession.close(id)
    setOpen(false)
  }, [cancelClose, id])
  const show = () => {
    battleInfoPopoverSession.open(id, () => {
      suppressHover.current = true
      close()
    })
    setOpen(true)
  }
  const queueClose = () => {
    cancelClose()
    if (!pinned.current) closeTimer.current = setTimeout(close, 150)
  }
  const restoreFocus = useCallback(() => {
    suppressFocus.current = document.activeElement !== buttonRef.current
    suppressHover.current = true
    close()
    buttonRef.current?.focus()
  }, [close])
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      battleInfoPopoverSession.close(id)
    },
    [id],
  )

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = buttonRef.current?.getBoundingClientRect()
      const panel = panelRef.current?.getBoundingClientRect()
      if (!anchor || !panel) return
      if (wideReport && window.innerWidth < 720) {
        setWideReport(false)
        return
      }
      if (!wideReport && panel.height > window.innerHeight - 16 && window.innerWidth >= 720) {
        setWideReport(true)
        return
      }
      const needsPage = panel.height > window.innerHeight - 16
      if (pageReport !== needsPage) {
        setPageReport(needsPage)
        return
      }
      const pagePositioned = getComputedStyle(panelRef.current!).position === 'absolute'
      setPosition(
        battleInfoPopoverPosition(
          anchor,
          panel,
          {
            width: Math.min(window.innerWidth, document.documentElement.clientWidth),
            height: window.innerHeight,
          },
          pagePositioned ? { x: window.scrollX, y: window.scrollY } : undefined,
          placement,
        ),
      )
    }
    place()
    if (focusOnOpen.current) panelRef.current?.focus()
    const placeOnScroll = () => {
      const panel = panelRef.current
      if (
        panel &&
        getComputedStyle(panel).position === 'absolute' &&
        panel.scrollHeight > window.innerHeight - 16
      )
        return
      place()
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', placeOnScroll, true)
    const observer = new ResizeObserver(place)
    if (panelRef.current) observer.observe(panelRef.current)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', placeOnScroll, true)
    }
  }, [open, wideReport, pageReport, placement])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (consumeOutsideClick || !battleInfoPopoverSession.isActive(id)) return
      const target = event.target as Node | null
      if (target && !panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        close()
      }
    }
    const dismissClick = (event: MouseEvent) => {
      if (!consumeOutsideClick || !battleInfoPopoverSession.isActive(id)) return
      const target = event.target as Node | null
      if (target && !panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        // An information trigger owns the next reader; battlefield commands remain consumed.
        if (target instanceof Element && target.closest('[data-battle-info-trigger]')) {
          close()
          return
        }
        event.preventDefault()
        event.stopPropagation()
        restoreFocus()
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !battleInfoPopoverSession.isActive(id)) return
      event.preventDefault()
      restoreFocus()
    }
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('click', dismissClick, true)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('click', dismissClick, true)
      document.removeEventListener('keydown', escape)
    }
  }, [close, consumeOutsideClick, id, open, restoreFocus])

  const openHover = () => {
    cancelClose()
    focusOnOpen.current = false
    if (!open) {
      setWideReport(false)
      setPageReport(false)
    }
    show()
  }

  return (
    <>
      {description ? (
        <span id={`${id}-description`} hidden>
          {description}
        </span>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        className={className ?? styles.trigger}
        data-battle-info-trigger="true"
        aria-label={label}
        aria-describedby={description ? `${id}-description` : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onMouseEnter={
          hover
            ? () => {
                if (!suppressHover.current) openHover()
              }
            : undefined
        }
        onMouseMove={
          hover
            ? () => {
                // Removing the panel can expose its trigger under a stationary pointer.
                // A new pointer movement is a deliberate hover; layout-induced entry is not.
                if (suppressHover.current) {
                  suppressHover.current = false
                  openHover()
                }
              }
            : undefined
        }
        onMouseLeave={
          hover
            ? () => {
                suppressHover.current = false
                queueClose()
              }
            : undefined
        }
        onFocus={
          hover
            ? () => {
                if (suppressFocus.current) {
                  suppressFocus.current = false
                  return
                }
                suppressHover.current = false
                openHover()
              }
            : undefined
        }
        onBlur={
          hover
            ? (event) => {
                if (!panelRef.current?.contains(event.relatedTarget as Node | null)) queueClose()
              }
            : undefined
        }
        onClick={() => {
          suppressHover.current = false
          cancelClose()
          focusOnOpen.current = true
          const next = hover && !pinned.current ? true : !open
          pinned.current = next
          if (next && !open) {
            setWideReport(false)
            setPageReport(false)
          }
          if (next) show()
          else close()
          if (next && open) panelRef.current?.focus()
        }}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            role="dialog"
            aria-label={title}
            tabIndex={-1}
            data-battle-info-panel="true"
            data-battle-info-layout={wideReport ? 'wide' : 'compact'}
            data-battle-info-page={pageReport}
            onMouseEnter={hover ? cancelClose : undefined}
            onMouseLeave={hover ? queueClose : undefined}
            className={styles.panel}
            style={
              { '--battle-info-left': `${position.left}px`, top: position.top } as CSSProperties
            }
          >
            <header>
              <strong>{title}</strong>
            </header>
            {children}
          </div>,
          document.body,
        )}
    </>
  )
}
