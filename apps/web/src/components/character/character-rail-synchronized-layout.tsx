'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import { useLayoutEffect, useRef } from 'react'

interface CharacterRailSynchronizedLayoutProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function CharacterRailSynchronizedLayout({
  children,
  ...props
}: CharacterRailSynchronizedLayoutProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return

    const rail = root.querySelector<HTMLElement>('[data-profile-identity-banner="true"]')
    if (!rail) return

    let lastHeight = 0
    const sync = () => {
      const height = rail.getBoundingClientRect().height
      if (height <= 0) return
      if (height === lastHeight) return
      lastHeight = height
      root.style.setProperty('--character-rail-height', `${height}px`)
    }

    sync()

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync)
    if (observer) {
      observer.observe(rail)
    } else {
      window.addEventListener('resize', sync)
    }

    return () => {
      observer?.disconnect()
      if (!observer) window.removeEventListener('resize', sync)
    }
  }, [])

  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  )
}
