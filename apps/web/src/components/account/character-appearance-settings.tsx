'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useSyncExternalStore } from 'react'
import {
  appearanceManifestFromImageUrl,
  type AppearanceBlueprint,
} from '@/appearance/appearance-manifest'
import {
  readClassicPortraitTokens,
  setClassicPortraitTokens,
  subscribeClassicPortraitTokens,
} from '@/appearance/appearance-preferences'
import { AppearanceBuilderDialog } from '@/components/character/appearance-builder-dialog'

interface AppearanceResponse {
  appearance?: {
    imageUrl: string | null
    pendingImageUrl: string | null
    revision: number
    remainingDesigns: number
  }
  error?: { message?: string }
}

const queuedStatus = 'Ready — applies after this battle.'
const lockedStatus = 'Your sprite design is permanently locked.'

export function CharacterAppearanceSettings({
  characterId,
  initialRemainingDesigns,
  initialPending,
}: {
  characterId: string
  initialRemainingDesigns: number
  initialPending: boolean
}) {
  const router = useRouter()
  const revision = useRef<number | null>(null)
  const [status, setStatus] = useState('')
  const [remainingDesigns, setRemainingDesigns] = useState(initialRemainingDesigns)
  const classic = useSyncExternalStore(
    subscribeClassicPortraitTokens,
    readClassicPortraitTokens,
    () => false,
  )

  async function prepare() {
    setStatus('')
    const response = await fetch('/api/account/appearance', { cache: 'no-store' })
    const { appearance, error } = (await response.json()) as AppearanceResponse
    if (!response.ok || !appearance) {
      throw new Error(error?.message ?? 'The active look could not be loaded.')
    }
    revision.current = appearance.revision
    setRemainingDesigns(appearance.remainingDesigns)
    if (appearance.remainingDesigns === 0) throw new Error(lockedStatus)
    if (appearance.pendingImageUrl) setStatus(queuedStatus)
    return (
      appearanceManifestFromImageUrl(appearance.pendingImageUrl ?? appearance.imageUrl)
        ?.blueprint ?? null
    )
  }

  async function confirm(blueprint: AppearanceBlueprint) {
    const response = await fetch('/api/account/appearance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId, expectedRevision: revision.current, blueprint }),
    })
    const { appearance, error } = (await response.json()) as AppearanceResponse
    if (!response.ok || !appearance) {
      throw new Error(error?.message ?? 'The new look could not be confirmed.')
    }
    revision.current = appearance.revision
    setRemainingDesigns(appearance.remainingDesigns)
    setStatus(appearance.pendingImageUrl ? queuedStatus : 'Your appearance is now active.')
    if (!appearance.pendingImageUrl) router.refresh()
  }

  return (
    <>
      <p role="status">
        {remainingDesigns === 0
          ? lockedStatus
          : `${remainingDesigns} sprite design ${remainingDesigns === 1 ? 'save' : 'saves'} remaining.`}
      </p>
      <AppearanceBuilderDialog
        label="Design sprite"
        confirmLabel="Confirm sprite design"
        locked={remainingDesigns === 0}
        confirmationHint={
          remainingDesigns === 1
            ? 'This is your final save. A different design will permanently lock your sprite.'
            : 'Saving a different design uses one of your two lifetime saves.'
        }
        prepare={prepare}
        onConfirm={confirm}
      />
      <label>
        <input
          type="checkbox"
          checked={classic}
          onChange={(event) => setClassicPortraitTokens(event.target.checked)}
        />
        Classic portrait tokens on this device
      </label>
      <p role="status">{status || (initialPending ? queuedStatus : '')}</p>
    </>
  )
}
