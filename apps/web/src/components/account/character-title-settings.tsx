'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { isStarterTitle, STARTER_TITLES, type StarterTitle } from '@/appearance/starter-titles'
import type { AppearanceGender } from '@/appearance/appearance-painted-looks'
import { SettingsScene } from '@/components/settings/settings-scene'
import { CharacterAppearanceSettings } from './character-appearance-settings'
import styles from './character-title-settings.module.css'

interface CharacterTitleSettingsProps {
  characterId: string
  personalTitle: string | null
  appearanceTokens: number
  pendingSpriteDesign: boolean
  initialGender?: AppearanceGender
}

export function CharacterTitleSettings({
  characterId,
  personalTitle,
  appearanceTokens,
  pendingSpriteDesign,
  initialGender,
}: CharacterTitleSettingsProps) {
  const router = useRouter()
  const saving = useRef(false)
  const [title, setTitle] = useState(isStarterTitle(personalTitle) ? personalTitle : null)
  const [pending, setPending] = useState<StarterTitle | null>(null)
  const [message, setMessage] = useState('')

  async function equip(next: StarterTitle) {
    if (saving.current || next === title) return
    saving.current = true
    setPending(next)
    setMessage('')
    try {
      const response = await fetch('/api/account/titles/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, title: next }),
      })
      const body = (await response.json()) as {
        title?: { personalTitle?: unknown }
        error?: { message?: string }
      }
      if (!response.ok || body.title?.personalTitle !== next) {
        setMessage(body.error?.message ?? 'The title could not be equipped.')
        return
      }
      setTitle(next)
      setMessage(`Equipped ${next}.`)
      router.refresh()
    } catch {
      setMessage('The title service could not be reached. Try again.')
    } finally {
      saving.current = false
      setPending(null)
    }
  }

  return (
    <SettingsScene
      title="Appearance & Title"
      description="Shape your character’s look and choose a title."
    >
      <div className={styles.layout} data-character-concept="titles" data-av-surface="moonstone">
        <section className={styles.panel} aria-labelledby="personal-title-heading">
          <h2 id="personal-title-heading">Starter titles</h2>
          <p>Choose a title. You can switch whenever you like.</p>
          <div className={styles.choices}>
            {STARTER_TITLES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={title === option}
                disabled={pending !== null}
                onClick={() => void equip(option)}
              >
                {option}
                {title === option && <span>Equipped</span>}
                {pending === option && <span>Equipping…</span>}
              </button>
            ))}
          </div>
          {message && <p role="status">{message}</p>}
        </section>
        <section className={styles.panel} aria-labelledby="character-appearance-heading">
          <h2 id="character-appearance-heading">Character appearance</h2>
          <CharacterAppearanceSettings
            key={characterId}
            characterId={characterId}
            initialAppearanceTokens={appearanceTokens}
            initialPending={pendingSpriteDesign}
            initialGender={initialGender}
          />
        </section>
      </div>
    </SettingsScene>
  )
}
