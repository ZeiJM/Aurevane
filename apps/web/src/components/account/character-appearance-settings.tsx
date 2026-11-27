'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import {
  appearanceManifestFromImageUrl,
  type AppearanceBlueprint,
} from '@/appearance/appearance-manifest'
import { AppearanceBuilderDialog } from '@/components/character/appearance-builder-dialog'
import type { AppearanceGender } from '@/appearance/appearance-painted-looks'

interface AppearanceResponse {
  appearance?: {
    imageUrl: string | null
    pendingImageUrl: string | null
    revision: number
    appearanceTokens: number
  }
  error?: { message?: string }
}

const queuedStatus = 'Ready — applies after this battle.'
const emptyStatus = 'You need an Appearance Token to confirm a different look.'

export function CharacterAppearanceSettings({
  characterId,
  initialAppearanceTokens,
  initialPending,
  initialGender,
}: {
  characterId: string
  initialAppearanceTokens: number
  initialPending: boolean
  initialGender?: AppearanceGender
}) {
  const router = useRouter()
  const revision = useRef<number | null>(null)
  const [status, setStatus] = useState('')
  const [appearanceTokens, setAppearanceTokens] = useState(initialAppearanceTokens)

  async function prepare() {
    setStatus('')
    const response = await fetch('/api/account/appearance', { cache: 'no-store' })
    const { appearance, error } = (await response.json()) as AppearanceResponse
    if (!response.ok || !appearance) {
      throw new Error(error?.message ?? 'The active look could not be loaded.')
    }
    revision.current = appearance.revision
    setAppearanceTokens(appearance.appearanceTokens)
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
    setAppearanceTokens(appearance.appearanceTokens)
    setStatus(appearance.pendingImageUrl ? queuedStatus : 'Your appearance is now active.')
    if (!appearance.pendingImageUrl) router.refresh()
  }

  return (
    <>
      <p role="status">
        {appearanceTokens} Appearance {appearanceTokens === 1 ? 'Token' : 'Tokens'} available.
      </p>
      <AppearanceBuilderDialog
        allowAuthored
        label="Design sprite"
        confirmLabel="Confirm appearance"
        initialGender={initialGender}
        confirmDisabled={appearanceTokens === 0}
        confirmationHint={
          appearanceTokens === 0
            ? emptyStatus
            : 'Confirming a different look spends one Appearance Token.'
        }
        prepare={prepare}
        onConfirm={confirm}
      />
      <p role="status">
        {status || (initialPending ? queuedStatus : appearanceTokens === 0 ? emptyStatus : '')}
      </p>
    </>
  )
}
