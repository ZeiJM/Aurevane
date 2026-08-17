'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

import styles from './battle-abort-controls.module.css'

interface BattleAbortControlsProps {
  battleSessionId: string
  initialLifecycle: BattleSessionView['snapshot']['tactical']['battle']['lifecycle']
}

interface BattleResponseBody {
  battle?: BattleSessionView
  error?: {
    code?: string
    message?: string
  }
}

async function readBattleResponse(response: Response): Promise<BattleResponseBody> {
  try {
    return (await response.json()) as BattleResponseBody
  } catch {
    return {}
  }
}

export function BattleAbortControls({
  battleSessionId,
  initialLifecycle,
}: BattleAbortControlsProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (initialLifecycle !== 'active' && initialLifecycle !== 'pending') return null

  async function fetchCurrentBattle(): Promise<BattleSessionView> {
    const response = await fetch(`/api/battles/${battleSessionId}`, {
      method: 'GET',
      cache: 'no-store',
    })
    const body = await readBattleResponse(response)
    if (!response.ok || !body.battle) {
      throw new Error(body.error?.message ?? 'The current exercise state could not be refreshed.')
    }
    return body.battle
  }

  async function commitAbort(expectedBattleVersion: number): Promise<Response> {
    return fetch(`/api/battles/${battleSessionId}/abort`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        expectedBattleVersion,
      }),
    })
  }

  async function abortExercise() {
    if (pending) return
    setPending(true)
    setNotice('Checking the latest authoritative battle state…')

    try {
      let current = await fetchCurrentBattle()
      if (current.snapshot.tactical.battle.lifecycle !== 'active') {
        setConfirming(false)
        setNotice('This exercise is no longer active, so there is nothing left to abort.')
        return
      }

      let response = await commitAbort(current.battleVersion)
      let body = await readBattleResponse(response)

      if (response.status === 409 && body.error?.code === 'STALE_VERSION') {
        current = await fetchCurrentBattle()
        if (current.snapshot.tactical.battle.lifecycle !== 'active') {
          setConfirming(false)
          setNotice('The exercise changed before the abort could settle and is no longer active.')
          return
        }
        response = await commitAbort(current.battleVersion)
        body = await readBattleResponse(response)
      }

      if (!response.ok || !body.battle) {
        throw new Error(body.error?.message ?? 'The practice exercise could not be aborted.')
      }
      if (body.battle.snapshot.tactical.battle.lifecycle !== 'abandoned') {
        throw new Error('The server did not settle the exercise as aborted.')
      }

      setConfirming(false)
      setNotice('Exercise aborted. Returning to the Tactical Hall…')
      router.replace('/game/battle')
      router.refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The practice exercise could not be aborted.')
    } finally {
      setPending(false)
    }
  }

  return (
    <aside className={styles.panel} aria-label="Practice battle exit" data-testid="abort-exercise-controls">
      {confirming ? (
        <>
          <p>
            <strong>Abort Exercise?</strong> This ends the drill as ABORTED. You receive no Character
            XP, Mastery, loot, Crowns, PvP rating, or normal completion rewards.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                setConfirming(false)
                setNotice('Abort cancelled. The exercise remains active.')
              }}
              disabled={pending}
            >
              Stay in Battle
            </button>
            <button
              type="button"
              className={styles.danger}
              data-testid="confirm-abort-exercise"
              onClick={() => void abortExercise()}
              disabled={pending}
            >
              {pending ? 'Aborting…' : 'Confirm Abort Exercise'}
            </button>
          </div>
        </>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.danger}
            data-testid="abort-exercise"
            onClick={() => {
              setConfirming(true)
              setNotice('Abort requires confirmation; no state has changed yet.')
            }}
            disabled={pending}
          >
            Abort Exercise
          </button>
        </div>
      )}
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
    </aside>
  )
}
