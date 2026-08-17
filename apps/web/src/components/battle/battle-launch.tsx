'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { AurevaneImage } from '@/components/media/aurevane-image'

import styles from './battle-launch.module.css'

interface BattleLaunchProps {
  characterId: string
  characterName: string
}

export function BattleLaunch({ characterId, characterName }: BattleLaunchProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function launchBattle() {
    if (pending) return
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const body = (await response.json()) as {
        battle?: { battleSessionId?: string }
        error?: { message?: string }
      }
      if (!response.ok || !body.battle?.battleSessionId) {
        throw new Error(body.error?.message ?? 'The battle could not be started.')
      }
      router.push(`/game/battle/${body.battle.battleSessionId}`)
    } catch (launchError) {
      setError(
        launchError instanceof Error ? launchError.message : 'The battle could not be started.',
      )
      setPending(false)
    }
  }

  return (
    <main className={styles.page}>
      <a className="skip-link" href="#battle-launch">
        Skip to battle launch
      </a>
      <section id="battle-launch" className={styles.panel} aria-labelledby="battle-launch-title">
        <div className={styles.vista} aria-hidden="true">
          <AurevaneImage assetId="ui.foundation.vista" className={styles.vistaImage} />
        </div>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Tactical Hall · Controlled Exercise</p>
          <h1 id="battle-launch-title">Enter the training field</h1>
          <p className={styles.lede}>
            {characterName} will enter the current Phase 2 tactical exercise. Movement, actions,
            facing, forecasts, Recruit decisions, and every committed result remain server
            authoritative.
          </p>

          <section className={styles.record} aria-labelledby="recruit-record-title">
            <div className={styles.recordHeading}>
              <div>
                <span>Tactical Record</span>
                <h2 id="recruit-record-title">Recruit Sparring Partner</h2>
              </div>
              <strong>Recorded</strong>
            </div>
            <dl>
              <div>
                <dt>Intelligence</dt>
                <dd>Recruit</dd>
              </div>
              <div>
                <dt>Level band</dt>
                <dd>Beginner training · fixed</dd>
              </div>
              <div>
                <dt>Attributes</dt>
                <dd>Standard preset · fixed</dd>
              </div>
              <div>
                <dt>Arena</dt>
                <dd>Basic Training Floor</dd>
              </div>
            </dl>
            <p>
              This is the only unlocked Phase 2 practice configuration. AI intelligence is a
              decision profile, not a hidden combat-stat bonus.
            </p>
          </section>

          <div className={styles.rules} aria-label="Exercise rules">
            <span>One controlled Wayfarer</span>
            <span>One opposing Recruit</span>
            <span>1v1 defeat opponent</span>
            <span>No progression rewards</span>
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={launchBattle}
              disabled={pending}
            >
              {pending ? 'Opening field…' : 'Begin exercise'}
            </button>
            <button type="button" className={styles.secondary} onClick={() => router.push('/game')}>
              Return to Wayfarer
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
