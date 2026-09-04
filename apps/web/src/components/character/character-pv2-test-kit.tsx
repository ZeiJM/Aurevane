'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import styles from './character-pv2-test-kit.module.css'

interface Pv2KitResponse {
  result?: {
    masteredDisciplines: number
    learnedSkills: number
  }
  error?: { message?: string }
}

export function CharacterPv2TestKit() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function prepare() {
    if (pending) return
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch('/api/character/build/pv2-test-kit', { method: 'POST' })
      const body = (await response.json()) as Pv2KitResponse
      if (!response.ok || !body.result) {
        setMessage(body.error?.message ?? 'The PV-2 test kit could not be prepared.')
        return
      }
      setMessage(
        `Ready: ${body.result.masteredDisciplines} representative Disciplines and ${body.result.learnedSkills} Skills are available for this character.`,
      )
      router.refresh()
    } catch {
      setMessage('The PV-2 test service could not be reached. Nothing was changed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.root} data-testid="pv2-test-kit">
      <strong>PV-2 buildcraft test</strong>
      <p>
        Preview-only preparation. Grants the representative Vanguard/Lifebinder mastery facts and
        Skills needed to compare a pure 8-Skill Essence build with a mixed 6-Skill Resonance build.
      </p>
      <button type="button" onClick={() => void prepare()} disabled={pending}>
        {pending ? 'Preparing…' : 'Prepare PV-2 buildcraft test'}
      </button>
      {message ? (
        <p className={styles.status} role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}
