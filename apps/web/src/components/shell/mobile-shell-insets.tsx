'use client'

import { useLayoutEffect, useRef } from 'react'

/** Keep scrolling content and the mobile dock clear of the actual footer height. */
export function MobileShellInsets() {
  const anchor = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const shell = anchor.current?.closest<HTMLElement>('[data-av-layout="standard"]')
    const footer = shell?.querySelector<HTMLElement>(':scope > footer')
    const dock = shell?.querySelector<HTMLElement>('[data-av-game-rail]')
    if (!shell || !footer || !dock) return

    const mobile = window.matchMedia('(max-width: 760px)')
    const clear = () => {
      shell.style.removeProperty('--av-mobile-footer-height')
      shell.style.removeProperty('--av-mobile-dock-height')
    }
    const sync = () => {
      if (!mobile.matches) {
        clear()
        return
      }
      for (const [property, element] of [
        ['--av-mobile-footer-height', footer],
        ['--av-mobile-dock-height', dock],
      ] as const) {
        const value = `${element.getBoundingClientRect().height}px`
        if (shell.style.getPropertyValue(property) !== value)
          shell.style.setProperty(property, value)
      }
    }

    sync()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync)
    observer?.observe(footer, { box: 'border-box' })
    observer?.observe(dock, { box: 'border-box' })
    mobile.addEventListener('change', sync)
    if (!observer) window.addEventListener('resize', sync)
    return () => {
      observer?.disconnect()
      mobile.removeEventListener('change', sync)
      if (!observer) window.removeEventListener('resize', sync)
      clear()
    }
  }, [])

  return <span ref={anchor} hidden aria-hidden="true" />
}
