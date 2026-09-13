'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './battle-info-popover.module.css'

/** Small reading panels share outside-click, Escape, focus and combat-shortcut behavior. */
export function BattleInfoPopover({
  label,
  title = label,
  trigger,
  className,
  children,
}: {
  label: string
  title?: string
  trigger: ReactNode
  className?: string
  children: ReactNode
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 8, top: 8 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = buttonRef.current?.getBoundingClientRect()
      const panel = panelRef.current?.getBoundingClientRect()
      if (!anchor || !panel) return
      setPosition({
        left: Math.max(
          8,
          Math.min(anchor.right - panel.width, window.innerWidth - panel.width - 8),
        ),
        top:
          anchor.bottom + panel.height + 16 <= window.innerHeight
            ? anchor.bottom + 8
            : Math.max(8, anchor.top - panel.height - 8),
      })
    }
    place()
    panelRef.current?.focus()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && !panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className ?? styles.trigger}
        data-battle-info-trigger="true"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
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
            className={styles.panel}
            style={position}
          >
            <header>
              <strong>{title}</strong>
              <button
                type="button"
                aria-label={`Close ${title}`}
                onClick={() => {
                  setOpen(false)
                  buttonRef.current?.focus()
                }}
              >
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
