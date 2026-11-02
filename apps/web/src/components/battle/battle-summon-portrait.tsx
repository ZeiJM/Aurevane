'use client'

import { useState } from 'react'
import { isRegisteredSummonPortraitSource } from '../../media/support-action-art'

/** Finalized public media or exact registered summon art; unavailable images retain the initial. */
export function BattleSummonPortrait({
  src,
  name,
  className,
  fallbackClassName,
}: {
  src: string
  name: string
  className?: string
  fallbackClassName?: string
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  if (
    failedSource === src ||
    (!isRegisteredSummonPortraitSource(src) &&
      !/^\/api\/content-media\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(src))
  )
    return (
      <span className={fallbackClassName ?? className} aria-label={`${name} summon portrait`}>
        {name.charAt(0).toUpperCase()}
      </span>
    )
  return (
    // Uploaded media uses the public reader; static portraits come from the closed registry.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${name} summon portrait`}
      className={['character-portrait-media', className].filter(Boolean).join(' ')}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedSource(src)}
    />
  )
}
