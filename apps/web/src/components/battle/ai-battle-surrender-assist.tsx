'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

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

function relabelSurrenderUi(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('button')) {
    const text = button.textContent?.trim()
    if (text === 'Abort Battle') button.textContent = 'Surrender'
    if (text === 'Confirm Abort Battle') button.textContent = 'Confirm Surrender'
    if (text === 'Aborting…') button.textContent = 'Surrendering…'
  }

  const title = document.getElementById('abort-title')
  if (title?.textContent?.trim() === 'Abort this battle?') {
    title.textContent = 'Surrender this battle?'
    const description = title.parentElement?.querySelector('p')
    if (description) {
      description.textContent =
        'Surrendering ends the battle immediately as a loss. The normal Defeat result screen will follow. Practice grants no normal progression rewards.'
    }
  }
}

export function AiBattleSurrenderAssist({ battleSessionId }: { battleSessionId: string }) {
  const router = useRouter()
  const pendingRef = useRef(false)

  useEffect(() => {
    relabelSurrenderUi()
    const observer = new MutationObserver(relabelSurrenderUi)
    observer.observe(document.body, { childList: true, subtree: true })

    async function commitSurrender(): Promise<void> {
      if (pendingRef.current) return
      pendingRef.current = true

      const confirmButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent?.trim() === 'Confirm Surrender',
      )
      if (confirmButton) {
        confirmButton.disabled = true
        confirmButton.textContent = 'Surrendering…'
      }

      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const currentResponse = await fetch(`/api/battles/${battleSessionId}`, {
            method: 'GET',
            cache: 'no-store',
          })
          const currentBody = await readBattleResponse(currentResponse)
          if (!currentResponse.ok || !currentBody.battle) {
            throw new Error(currentBody.error?.message ?? 'The battle state could not be refreshed.')
          }

          if (currentBody.battle.snapshot.tactical.battle.lifecycle === 'completed') {
            router.refresh()
            return
          }
          if (currentBody.battle.snapshot.tactical.battle.lifecycle !== 'active') {
            throw new Error('Only an active AI battle can be surrendered.')
          }

          const response = await fetch(`/api/battles/${battleSessionId}/surrender`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idempotencyKey: crypto.randomUUID(),
              expectedBattleVersion: currentBody.battle.battleVersion,
            }),
          })
          const body = await readBattleResponse(response)

          if (response.status === 409 && body.error?.code === 'STALE_VERSION' && attempt === 0) {
            continue
          }
          if (!response.ok || !body.battle) {
            throw new Error(body.error?.message ?? 'The AI battle could not be surrendered.')
          }
          if (body.battle.snapshot.tactical.battle.lifecycle !== 'completed') {
            throw new Error('The server did not resolve surrender as a completed loss.')
          }

          router.refresh()
          return
        }
      } catch (error) {
        const title = document.getElementById('abort-title')
        const description = title?.parentElement?.querySelector('p')
        if (description) {
          description.textContent =
            error instanceof Error ? error.message : 'The AI battle could not be surrendered.'
        }
        pendingRef.current = false
        if (confirmButton) {
          confirmButton.disabled = false
          confirmButton.textContent = 'Confirm Surrender'
        }
      }
    }

    function handleClick(event: MouseEvent): void {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest('button')
      if (!(button instanceof HTMLButtonElement)) return
      if (button.textContent?.trim() !== 'Confirm Surrender') return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      void commitSurrender()
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleClick, true)
    }
  }, [battleSessionId, router])

  return null
}
