'use client'

import { useEffect, useState } from 'react'

export function IdentityAvatar({
  src,
  alt,
  className,
  fallback = 'A',
}: {
  src: string | null | undefined
  alt: string
  className?: string
  fallback?: string
}) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  if (!src || failed) return <span className={className}>{fallback}</span>

  return (
    // A normal img intentionally preserves animated GIFs and arbitrary direct HTTPS image hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />
  )
}
