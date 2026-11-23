'use client'

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { battleInfoPopoverPosition } from './battle-info-popover-position'
import { battleInfoPopoverSession } from './battle-info-popover-session'
import styles from './battle-info-popover.module.css'

type ReaderOwner = {
  id: string
  layer: 'battle' | 'inspect'
  cancelClose: () => void
  resumeClose: () => void
  contains: (target: Node) => boolean
  portalHost?: RefObject<HTMLElement | null>
}
const ReaderOwnerContext = createContext<ReaderOwner | null>(null)

/** Small reading panels share outside-click, Escape, focus and combat-shortcut behavior. */
export function BattleInfoPopover({
  label,
  description,
  title = label,
  trigger,
  className,
  children,
  hover = false,
  nested = false,
  referenceTrigger = false,
  consumeOutsideClick = false,
  placement = 'auto',
  layer = 'battle',
  initialFocus,
  triggerRef,
  panelWidth,
  portalHost,
  effectTrigger = false,
  shortcutAction,
}: {
  label: string
  description?: string
  title?: string
  trigger: ReactNode
  className?: string
  children: ReactNode
  hover?: boolean
  nested?: boolean
  referenceTrigger?: boolean
  consumeOutsideClick?: boolean
  placement?: 'auto' | 'above'
  layer?: 'battle' | 'inspect'
  initialFocus?: () => HTMLElement | null
  triggerRef?: RefObject<HTMLButtonElement | null>
  panelWidth?: number
  portalHost?: RefObject<HTMLElement | null>
  effectTrigger?: boolean
  shortcutAction?: string
}) {
  const id = useId()
  const containingReader = useContext(ReaderOwnerContext)
  const parent = nested ? containingReader : null
  const effectiveLayer = parent?.layer ?? layer
  const effectivePortalHost = parent?.portalHost ?? portalHost
  const parentRef = useRef(parent)
  useLayoutEffect(() => {
    parentRef.current = parent
  }, [parent])
  const hovered = useRef(false)
  const mounted = useRef(true)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 8, top: 8 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const initialFocusRef = useRef(initialFocus)
  useLayoutEffect(() => {
    initialFocusRef.current = initialFocus
  }, [initialFocus])
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
    parentRef.current?.resumeClose()
  }, [cancelClose, id])
  const show = () => {
    const owns = battleInfoPopoverSession.open(
      id,
      () => {
        suppressHover.current = true
        close()
      },
      parent?.id,
    )
    if (owns) {
      parent?.cancelClose()
      setOpen(true)
    }
  }
  const queueClose = () => {
    if (!mounted.current) return
    cancelClose()
    if (!pinned.current)
      closeTimer.current = setTimeout(() => {
        if (pinned.current || hovered.current || battleInfoPopoverSession.hasChild(id)) return
        const focus = document.activeElement
        if (focus && (panelRef.current?.contains(focus) || buttonRef.current?.contains(focus)))
          return
        close()
      }, 150)
  }
  const restoreFocus = useCallback(() => {
    suppressFocus.current = document.activeElement !== buttonRef.current
    suppressHover.current = true
    close()
    buttonRef.current?.focus()
  }, [close])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (closeTimer.current) clearTimeout(closeTimer.current)
      battleInfoPopoverSession.close(id)
      parentRef.current?.resumeClose()
    }
  }, [id])

  useLayoutEffect(() => {
    if (!open) return
    const report = panelRef.current
    if (report?.querySelectorAll('button[data-combat-tag-reference-trigger]').length)
      report.setAttribute('aria-describedby', `${id}-reference-navigation`)
    else report?.removeAttribute('aria-describedby')
    const place = () => {
      const anchor = buttonRef.current?.getBoundingClientRect()
      const panel = panelRef.current?.getBoundingClientRect()
      if (!anchor || !panel) return
      setPosition(
        battleInfoPopoverPosition(
          anchor,
          panel,
          {
            width: Math.min(window.innerWidth, document.documentElement.clientWidth),
            height: window.innerHeight,
          },
          undefined,
          effectiveLayer === 'inspect' ? 'beside' : placement,
        ),
      )
    }
    place()
    if (focusOnOpen.current) {
      if (initialFocusRef.current) {
        ;(initialFocusRef.current() ?? panelRef.current)?.focus()
        focusOnOpen.current = false
      } else panelRef.current?.focus()
    }
    const placeOnScroll = place
    window.addEventListener('resize', place)
    window.addEventListener('scroll', placeOnScroll, true)
    const observer = new ResizeObserver(place)
    if (panelRef.current) observer.observe(panelRef.current)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', placeOnScroll, true)
    }
  }, [open, placement, effectiveLayer, id])

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
        if (parentRef.current?.contains(target)) {
          close()
          return
        }
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
        ref={(element) => {
          buttonRef.current = element
          if (triggerRef) triggerRef.current = element
        }}
        type="button"
        className={className ?? styles.trigger}
        data-battle-info-trigger="true"
        data-battle-reader-shortcut={shortcutAction}
        data-battle-live-effect-trigger={effectTrigger ? 'true' : undefined}
        aria-keyshortcuts={effectTrigger ? 'Control+Alt+E' : undefined}
        data-combat-tag-reference-trigger={referenceTrigger ? 'true' : undefined}
        aria-label={label}
        aria-describedby={description ? `${id}-description` : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onMouseEnter={
          hover
            ? () => {
                hovered.current = true
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
                hovered.current = false
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
            data-battle-info-layout="compact"
            data-battle-info-page="false"
            data-battle-info-modal-owned={Boolean(effectivePortalHost?.current)}
            onKeyDown={(event) => {
              if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
              if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
              const report = event.currentTarget
              const terms = Array.from(
                report.querySelectorAll<HTMLButtonElement>(
                  'button[data-combat-tag-reference-trigger]',
                ),
              )
              if (!terms.length) return
              const current = terms.findIndex(
                (term) => term === event.target || term.contains(event.target as Node),
              )
              // Pickers, fields and portaled child panels retain their own input behavior.
              if (event.target !== report && current < 0) return
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? terms.length - 1
                    : event.key === 'ArrowDown'
                      ? (current + 1) % terms.length
                      : current <= 0
                        ? terms.length - 1
                        : current - 1
              event.preventDefault()
              event.stopPropagation()
              terms[next]!.focus()
            }}
            onMouseEnter={
              hover
                ? () => {
                    hovered.current = true
                    cancelClose()
                    parent?.cancelClose()
                  }
                : undefined
            }
            onMouseLeave={
              hover
                ? () => {
                    hovered.current = false
                    queueClose()
                  }
                : undefined
            }
            className={[styles.panel, effectiveLayer === 'inspect' ? styles.inspectPanel : ''].join(
              ' ',
            )}
            style={
              {
                '--battle-info-left': `${position.left}px`,
                ...(panelWidth ? { '--battle-info-preferred-width': `${panelWidth}px` } : {}),
                top: position.top,
              } as CSSProperties
            }
          >
            <header>
              <strong>{title}</strong>
            </header>
            <span id={`${id}-reference-navigation`} hidden>
              Linked terms: use Up and Down arrows, Home or End to choose a term. Enter or Space
              opens its explanation; Escape returns to the report.
            </span>
            <ReaderOwnerContext.Provider
              value={{
                id,
                layer: effectiveLayer,
                cancelClose,
                resumeClose: queueClose,
                contains: (target) =>
                  Boolean(
                    panelRef.current?.contains(target) || buttonRef.current?.contains(target),
                  ),
                portalHost: effectivePortalHost,
              }}
            >
              {children}
            </ReaderOwnerContext.Provider>
          </div>,
          effectivePortalHost?.current ?? document.body,
        )}
    </>
  )
}
