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
  appearance?: { imageUrl: string | null; pendingImageUrl: string | null; revision: number }
  error?: { message?: string }
}

const queuedStatus = 'Ready — applies after this battle.'

export function CharacterAppearanceSettings({ characterId }: { characterId: string }) {
  const router = useRouter()
  const revision = useRef<number | null>(null)
  const [status, setStatus] = useState('')
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
    setStatus(appearance.pendingImageUrl ? queuedStatus : 'Your appearance is now active.')
    if (!appearance.pendingImageUrl) router.refresh()
  }

  return (
    <>
      <AppearanceBuilderDialog
        label="Regenerate look"
        confirmLabel="Confirm new look"
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
      <p role="status">{status}</p>
    </>
  )
}
