'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export interface SupernaturalChoiceOption {
  transitionId: string
  transitionContentVersion: number
  path: 'ascended' | 'severed'
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } }
    return payload.error?.message ?? `Request failed with status ${response.status}.`
  } catch {
    return `Request failed with status ${response.status}.`
  }
}

function pathLabel(path: SupernaturalChoiceOption['path']) {
  return path === 'ascended' ? 'Ascension' : 'Severence'
}

export function CharacterSupernaturalChoiceControls({
  stateVersion,
  choices,
}: {
  stateVersion: number
  choices: readonly SupernaturalChoiceOption[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState<SupernaturalChoiceOption | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function confirm() {
    if (!pending || saving) return
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/character/supernatural', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedStateVersion: stateVersion,
          idempotencyKey: crypto.randomUUID(),
          transitionId: pending.transitionId,
          transitionContentVersion: pending.transitionContentVersion,
          confirmPermanentChoice: true,
        }),
      })
      if (!response.ok) throw new Error(await responseMessage(response))
      setMessage(`${pathLabel(pending.path)} chosen. Refreshing your path…`)
      router.refresh()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'That permanent path could not be chosen.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (pending) {
    return (
      <div data-supernatural-actions="confirm">
        <p data-supernatural-warning>
          <strong>{pathLabel(pending.path)} is permanent for this character.</strong> Once
          confirmed, the ordinary path cannot be switched to the other choice. Your path persists
          through Rekindling and cannot be undone by changing Disciplines.
        </p>
        <div data-supernatural-action-row>
          <button type="button" disabled={saving} onClick={() => void confirm()}>
            {saving ? 'Binding path…' : `Confirm ${pathLabel(pending.path)}`}
          </button>
          <button
            type="button"
            data-supernatural-secondary
            disabled={saving}
            onClick={() => {
              setPending(null)
              setMessage(null)
            }}
          >
            Cancel
          </button>
        </div>
        {message ? (
          <p role="status" data-supernatural-message>
            {message}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div data-supernatural-actions="choose">
      <p data-supernatural-warning>
        This decision is permanent. Review both paths before binding this character.
      </p>
      {choices.map((choice) => (
        <p key={choice.transitionId}>
          <strong>{pathLabel(choice.path)}</strong> —{' '}
          {choice.path === 'ascended'
            ? 'Become Ascended on the soul-enhanced path; ordinary progression closes Severence.'
            : 'Become Severed on the alternate supernatural path; ordinary progression closes Ascension.'}
        </p>
      ))}
      <p>Your choice persists through Rekindling. Power details are not available in this view.</p>
      <div data-supernatural-action-row>
        {choices.map((choice) => (
          <button
            key={choice.transitionId}
            type="button"
            data-supernatural-choice={choice.path}
            onClick={() => {
              setPending(choice)
              setMessage(null)
            }}
          >
            Choose {pathLabel(choice.path)}
          </button>
        ))}
      </div>
      {message ? (
        <p role="status" data-supernatural-message>
          {message}
        </p>
      ) : null}
    </div>
  )
}
