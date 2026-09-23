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

    const sync = () => {
      const height = rail.getBoundingClientRect().height
      if (height > 0) root.style.setProperty('--character-rail-height', `${height}px`)
    }

    sync()

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync)
    observer?.observe(rail)
    window.addEventListener('resize', sync)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [])

  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  )
}
