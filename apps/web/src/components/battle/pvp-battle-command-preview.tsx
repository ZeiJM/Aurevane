'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { BattlePreviewView } from '@/server/battle/battle-preview-service'

import styles from './pvp-battle-command-preview.module.css'

type IntentPreview = BattlePreviewView['preview']
type ActionPreview = Extract<IntentPreview, { kind: 'action' }>
type CommandSlug = 'inspect' | 'move' | 'attack' | 'guard' | 'recover' | 'finish'
type PreviewTone = 'chance' | 'damage' | 'heal' | 'effect' | 'cost' | 'blocked'

interface PreviewChip {
  label: string
  tone: PreviewTone
}

const COMMAND_SLUGS = new Map<string, CommandSlug>([
  ['Inspect', 'inspect'],
  ['Move', 'move'],
  ['Basic Attack', 'attack'],
  ['Guard', 'guard'],
  ['Recover', 'recover'],
  ['Finish Turn', 'finish'],
])

const COMMAND_TITLES: Record<CommandSlug, string> = {
  inspect: 'Inspect · Free',
  move: 'Move · 25 AP per normal tile',
  attack: 'Basic Attack · 30 AP',
  guard: 'Guard · 30 AP',
  recover: 'Recover · 50 AP',
  finish: 'Finish Turn · choose facing',
}

function humanizeStatus(value: string): string {
  const id = value.split(':')[0] ?? value
  return id
    .replace(/^status\./, '')
    .replaceAll('.', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function numericEffectDelta(effect: ActionPreview['projectedEffects'][number]): number | null {
  if (typeof effect.before !== 'number' || typeof effect.after !== 'number') return null
  return effect.after - effect.before
}

function previewSlug(preview: IntentPreview): CommandSlug | null {
  if (preview.kind === 'move') return 'move'
  if (preview.kind === 'face' || preview.kind === 'end-turn') return 'finish'
  if (preview.kind !== 'action') return null
  if (preview.actionId === 'basic.attack.unarmed.basic') return 'attack'
  if (preview.actionId === 'basic.guard') return 'guard'
  if (preview.actionId === 'basic.recover') return 'recover'
  return null
}

function actionPreviewChips(preview: ActionPreview): PreviewChip[] {
  if (!preview.legal) return [{ label: 'Blocked', tone: 'blocked' }]

  const chips: PreviewChip[] = [
    {
      label:
        preview.hitChanceBasisPoints === null
          ? 'Success 100%'
          : `Hit ${Math.round(preview.hitChanceBasisPoints / 100)}%`,
      tone: 'chance',
    },
  ]

  if (preview.mitigatedBaseDamage !== null) {
    chips.push({ label: `On hit ${preview.mitigatedBaseDamage} dmg`, tone: 'damage' })
  } else {
    const projectedDamage = preview.projectedEffects
      .filter((effect) => effect.effectType === 'damage')
      .reduce((total, effect) => {
        const delta = numericEffectDelta(effect)
        return total + (delta === null ? 0 : Math.max(0, -delta))
      }, 0)
    if (projectedDamage > 0) chips.push({ label: `${projectedDamage} dmg`, tone: 'damage' })
  }

  const projectedHealing = preview.projectedEffects
    .filter((effect) => effect.effectType === 'healing')
    .reduce((total, effect) => {
      const delta = numericEffectDelta(effect)
      return total + (delta === null ? 0 : Math.max(0, delta))
    }, 0)
  if (projectedHealing > 0) chips.push({ label: `Heal +${projectedHealing}`, tone: 'heal' })

  const resourceDelta = preview.projectedEffects
    .filter((effect) => effect.effectType === 'resource-change')
    .reduce((total, effect) => total + (numericEffectDelta(effect) ?? 0), 0)
  if (resourceDelta !== 0) {
    chips.push({
      label: `Resource ${resourceDelta > 0 ? '+' : ''}${resourceDelta}`,
      tone: resourceDelta > 0 ? 'heal' : 'cost',
    })
  }

  const projectedStatuses = preview.projectedStatuses ?? []
  for (const status of projectedStatuses) {
    chips.push({ label: humanizeStatus(status.statusId), tone: 'effect' })
    if (
      status.damageTakenMultiplierBasisPoints !== null &&
      status.damageTakenMultiplierBasisPoints < 10_000
    ) {
      const reduction = Math.round((10_000 - status.damageTakenMultiplierBasisPoints) / 100)
      chips.push({ label: `-${reduction}% damage`, tone: 'effect' })
    }
    if (status.durationOwnerTurnStarts !== null) {
      chips.push({
        label: `${status.durationOwnerTurnStarts} turn${status.durationOwnerTurnStarts === 1 ? '' : 's'}`,
        tone: 'effect',
      })
    }
  }

  if (projectedStatuses.length === 0) {
    const statuses = new Set(
      preview.projectedEffects
        .filter((effect) => effect.effectType === 'apply-status' && typeof effect.after === 'string')
        .map((effect) => humanizeStatus(String(effect.after))),
    )
    for (const status of statuses) chips.push({ label: status, tone: 'effect' })
  }

  if (preview.affectedCombatantIds.length > 1) {
    chips.push({ label: `${preview.affectedCombatantIds.length} targets`, tone: 'effect' })
  }

  return chips
}

function previewChips(preview: IntentPreview | null, activeSlug: CommandSlug | null): PreviewChip[] {
  if (!preview || previewSlug(preview) !== activeSlug) return []
  if (!preview.legal) return [{ label: 'Blocked', tone: 'blocked' }]

  if (preview.kind === 'move') {
    return [
      { label: `${preview.actionEconomyCost} AP`, tone: 'cost' },
      { label: `${preview.actionEconomyAfter} AP left`, tone: 'effect' },
      {
        label: `${Math.max(0, preview.path.length - 1)} tile${preview.path.length === 2 ? '' : 's'}`,
        tone: 'effect',
      },
    ]
  }
  if (preview.kind === 'action') return actionPreviewChips(preview)
  if (preview.kind === 'face') {
    return [
      { label: 'Success 100%', tone: 'chance' },
      { label: `Face ${humanizeStatus(preview.facing)}`, tone: 'effect' },
      { label: 'Ends turn', tone: 'cost' },
    ]
  }
  return [{ label: 'Choose facing', tone: 'effect' }]
}

function isPreviewRequest(input: RequestInfo | URL): boolean {
  try {
    const raw = input instanceof Request ? input.url : input instanceof URL ? input.href : input
    return /^\/api\/battles\/[^/]+\/preview\/?$/.test(new URL(raw, window.location.origin).pathname)
  } catch {
    return false
  }
}

function readPreview(body: unknown): IntentPreview | null {
  if (!body || typeof body !== 'object') return null
  const battlePreview = (body as { battlePreview?: unknown }).battlePreview
  if (!battlePreview || typeof battlePreview !== 'object') return null
  const preview = (battlePreview as { preview?: unknown }).preview
  return preview && typeof preview === 'object' ? (preview as IntentPreview) : null
}

function activeCommand(deck: HTMLElement): CommandSlug | null {
  for (const button of deck.querySelectorAll<HTMLButtonElement>('button[data-active]')) {
    const label = button.querySelector<HTMLElement>(':scope > strong')?.textContent?.trim() ?? ''
    const slug = COMMAND_SLUGS.get(label)
    if (slug) return slug
  }
  return null
}

export function PvpBattleCommandPreview() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [activeSlug, setActiveSlug] = useState<CommandSlug | null>(null)
  const [preview, setPreview] = useState<IntentPreview | null>(null)
  const activeSlugRef = useRef<CommandSlug | null>(null)
  const chips = useMemo(() => previewChips(preview, activeSlug), [activeSlug, preview])

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
    if (!root) return
    let frame = 0

    const locate = () => {
      frame = 0
      const deck = root.querySelector<HTMLElement>('section[aria-label="Command Deck"]')
      const nextTarget = deck?.firstElementChild instanceof HTMLElement ? deck.firstElementChild : null
      const nextSlug = deck ? activeCommand(deck) : null

      setTarget((current) => (current === nextTarget ? current : nextTarget))
      if (activeSlugRef.current !== nextSlug) {
        activeSlugRef.current = nextSlug
        setActiveSlug(nextSlug)
        setPreview(null)
      }
    }

    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(locate)
    }

    locate()
    const observer = new MutationObserver(schedule)
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-active', 'disabled'],
    })

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const previousFetch = window.fetch
    let cancelled = false

    const observedFetch: typeof window.fetch = (...args) => {
      const observesPreview = isPreviewRequest(args[0])
      if (observesPreview) setPreview(null)
      const responsePromise = previousFetch(...args)

      if (observesPreview) {
        void responsePromise
          .then((response) => {
            if (!response.ok || cancelled) return
            void response
              .clone()
              .json()
              .then((body: unknown) => {
                if (cancelled) return
                const nextPreview = readPreview(body)
                if (!nextPreview || previewSlug(nextPreview) !== activeSlugRef.current) return
                setPreview(nextPreview)
              })
              .catch(() => undefined)
          })
          .catch(() => undefined)
      }

      return responsePromise
    }

    window.fetch = observedFetch
    return () => {
      cancelled = true
      if (window.fetch === observedFetch) window.fetch = previousFetch
    }
  }, [])

  if (!target || !activeSlug) return null

  return createPortal(
    <span className={styles.context} data-pvp-command-context="true">
      <strong>{COMMAND_TITLES[activeSlug]}</strong>
      {chips.length > 0 ? (
        <span className={styles.preview} data-battle-target-preview="true" aria-label="Action preview">
          {chips.map((chip, index) => (
            <span
              key={`${chip.label}-${index}`}
              data-battle-preview-chip="true"
              data-battle-preview-tone={chip.tone}
            >
              {chip.label}
            </span>
          ))}
        </span>
      ) : null}
    </span>,
    target,
  )
}
