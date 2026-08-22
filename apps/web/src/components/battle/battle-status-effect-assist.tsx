'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import styles from './battle-status-effect-assist.module.css'

type EffectDetails = {
  title: string
  kind: 'Buff' | 'Debuff' | 'Effect'
  description: string
  duration: string | null
}

function humanize(value: string): string {
  return value
    .replace(/^buff\./, '')
    .replace(/^debuff\./, '')
    .replaceAll('-', ' ')
    .replaceAll('.', ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function durationFromText(text: string): string | null {
  const match = text.match(/(\d+)\s+turns?\s+remaining/i)
  return match ? `${match[1]} turn${match[1] === '1' ? '' : 's'} remaining` : null
}

function detailsFromTrigger(trigger: HTMLElement): EffectDetails {
  const text = trigger.textContent?.trim() ?? ''
  const title = trigger.getAttribute('title') ?? ''
  const aria = trigger.getAttribute('aria-label') ?? ''
  const source = `${text} ${title} ${aria}`.toLowerCase()
  const duration = durationFromText(`${text} ${aria}`)

  if (source.includes('lowered guard') || source.includes('lowered-guard') || source.includes('lg↓')) {
    return {
      title: 'Lowered Guard',
      kind: 'Debuff',
      description:
        'Your defenses are exposed. While Lowered Guard is active, incoming damage is multiplied by 2.5×. In PvP it is applied after a genuine turn-timer expiry and lasts for the next owner-turn start.',
      duration,
    }
  }

  if (source.includes('guarded')) {
    return {
      title: 'Guarded',
      kind: 'Buff',
      description:
        'Incoming damage is reduced by 15% while Guarded is active. The effect expires after its remaining owner-turn duration is consumed.',
      duration,
    }
  }

  const rawLabel =
    trigger.querySelector('strong')?.textContent?.trim() ||
    trigger.getAttribute('title') ||
    trigger.getAttribute('aria-label') ||
    text ||
    'Combat Effect'
  const cleanLabel = rawLabel.replace(/^Explain\s+/i, '').replace(/,.*$/, '').replace(/·.*$/, '').trim()

  return {
    title: humanize(cleanLabel),
    kind: source.includes('debuff') ? 'Debuff' : source.includes('buff') ? 'Buff' : 'Effect',
    description:
      'This combat effect is currently modifying the combatant. Its remaining duration is shown below when the battle state provides one.',
    duration,
  }
}

function decorateEffectTriggers() {
  for (const item of document.querySelectorAll<HTMLElement>('[aria-label$=" buffs and debuffs"] button')) {
    item.dataset.battleEffectTrigger = 'true'
  }

  for (const item of document.querySelectorAll<HTMLElement>('[aria-label$=" active effects"] li')) {
    item.dataset.battleEffectTrigger = 'true'
    item.tabIndex = 0
    item.setAttribute('role', 'button')
    const label = item.querySelector('strong')?.textContent?.trim() ?? 'combat effect'
    item.setAttribute('aria-label', `Explain ${label}`)
  }

  for (const item of document.querySelectorAll<HTMLElement>('[aria-label$=" status effects"] b')) {
    item.dataset.battleEffectTrigger = 'true'
    item.tabIndex = 0
    item.setAttribute('role', 'button')
    if (!item.getAttribute('aria-label')) {
      const label = item.getAttribute('title') ?? item.textContent?.trim() ?? 'combat effect'
      item.setAttribute('aria-label', `Explain ${label}`)
    }
  }
}

export function BattleStatusEffectAssist() {
  const [effect, setEffect] = useState<EffectDetails | null>(null)

  useEffect(() => {
    let frame = 0
    const scheduleDecorate = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        decorateEffectTriggers()
      })
    }

    decorateEffectTriggers()
    const observer = new MutationObserver(scheduleDecorate)
    observer.observe(document.body, { childList: true, subtree: true })

    function openFromTarget(target: EventTarget | null) {
      const element = target instanceof Element ? target : null
      const trigger = element?.closest<HTMLElement>('[data-battle-effect-trigger="true"]')
      if (!trigger) return false
      setEffect(detailsFromTrigger(trigger))
      return true
    }

    function handleClick(event: MouseEvent) {
      if (!openFromTarget(event.target)) return
      event.preventDefault()
      event.stopPropagation()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setEffect(null)
        return
      }
      if (event.key !== 'Enter' && event.key !== ' ') return
      if (!openFromTarget(event.target)) return
      event.preventDefault()
      event.stopPropagation()
    }

    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])

  if (!effect || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setEffect(null)
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="battle-effect-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className={styles.heading}>
          <div>
            <span>{effect.kind}</span>
            <strong id="battle-effect-title">{effect.title}</strong>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Close effect details"
            onClick={() => setEffect(null)}
          >
            ×
          </button>
        </div>
        <p>{effect.description}</p>
        {effect.duration ? <small className={styles.duration}>{effect.duration}</small> : null}
      </section>
    </div>,
    document.body,
  )
}
