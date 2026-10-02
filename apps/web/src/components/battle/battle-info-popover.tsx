'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
}: {
  label: string
  description?: string
  title?: string
  trigger: ReactNode
  className?: string
  children: ReactNode
  hover?: boolean
  consumeOutsideClick?: boolean
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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }
  const queueClose = () => {
    cancelClose()
    if (!pinned.current) closeTimer.current = setTimeout(() => setOpen(false), 150)
  }
  const restoreFocus = () => {
    pinned.current = false
    suppressFocus.current = true
    setOpen(false)
    buttonRef.current?.focus()
  }
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    [],
  )

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = buttonRef.current?.getBoundingClientRect()
      const panel = panelRef.current?.getBoundingClientRect()
      if (!anchor || !panel) return
      if (wideReport && window.innerWidth < 640) {
        setWideReport(false)
        return
      }
      if (!wideReport && panel.height > window.innerHeight - 16 && window.innerWidth >= 640) {
        setWideReport(true)
        return
      }
      const needsPage = panel.height > window.innerHeight - 16
      if (pageReport !== needsPage) {
        setPageReport(needsPage)
        return
      }
      const pagePositioned = getComputedStyle(panelRef.current!).position === 'absolute'
      setPosition({
        left:
          Math.max(8, Math.min(anchor.right - panel.width, window.innerWidth - panel.width - 8)) +
          (pagePositioned ? window.scrollX : 0),
        top:
          (panel.height > window.innerHeight - 16
            ? 8
            : anchor.bottom + panel.height + 16 <= window.innerHeight
              ? anchor.bottom + 8
              : Math.max(8, anchor.top - panel.height - 8)) + (pagePositioned ? window.scrollY : 0),
      })
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
  }, [open, wideReport, pageReport])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (consumeOutsideClick) return
      const target = event.target as Node | null
      if (target && !panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    const dismissClick = (event: MouseEvent) => {
      if (!consumeOutsideClick) return
      const target = event.target as Node | null
      if (target && !panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        event.preventDefault()
        event.stopPropagation()
        pinned.current = false
        suppressFocus.current = true
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      pinned.current = false
      suppressFocus.current = true
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('click', dismissClick, true)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('click', dismissClick, true)
      document.removeEventListener('keydown', escape)
    }
  }, [open, consumeOutsideClick])

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
                cancelClose()
                focusOnOpen.current = false
                if (!open) {
                  setWideReport(false)
                  setPageReport(false)
                }
                setOpen(true)
              }
            : undefined
        }
        onMouseLeave={hover ? queueClose : undefined}
        onFocus={
          hover
            ? () => {
                if (suppressFocus.current) {
                  suppressFocus.current = false
                  return
                }
                cancelClose()
                focusOnOpen.current = false
                if (!open) {
                  setWideReport(false)
                  setPageReport(false)
                }
                setOpen(true)
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
          cancelClose()
          focusOnOpen.current = true
          const next = hover && !pinned.current ? true : !open
          pinned.current = next
          if (next && !open) {
            setWideReport(false)
            setPageReport(false)
          }
          setOpen(next)
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
            style={position}
          >
            <header>
              <strong>{title}</strong>
              <button type="button" aria-label={`Close ${title}`} onClick={restoreFocus}>
                ×
              </button>
            </header>
            {children}
          </div>,
          document.body,
        )}
    </>
  )
}
