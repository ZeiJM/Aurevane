'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import type { PvpBattleMetadata, PvpBattleParticipantView } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

function percent(value: number, maximum: number): number {
  return maximum > 0 ? Math.max(0, Math.min(100, (value / maximum) * 100)) : 0
}

function Panel({
  participant,
  battle,
  side,
}: {
  participant: PvpBattleParticipantView | null
  battle: BattleSessionView
  side: 'left' | 'right'
}) {
  if (!participant) return null
  const combatant = battle.snapshot.tactical.battle.combatants.find(
    (candidate) => candidate.id === participant.combatantId,
  )
  const placement = battle.snapshot.tactical.placements.find(
    (candidate) => candidate.combatantId === participant.combatantId,
  )
  const profile = battle.snapshot.statBridge.combatants.find(
    (candidate) => candidate.combatantId === participant.combatantId,
  )
  if (!combatant) return null

  return (
    <aside
      data-pvp-combatant-panel={side}
      aria-label={`${participant.characterName} battle summary`}
      style={{
        position: 'fixed',
        top: '50%',
        [side]: '.65rem',
        zIndex: 4100,
        display: 'grid',
        width: 'min(13rem, 21vw)',
        minWidth: '9.5rem',
        gap: '.46rem',
        padding: '.7rem',
        border: '1px solid rgba(212,186,130,.38)',
        borderRadius: 'var(--av-radius-md)',
        background: 'rgba(7,10,15,.96)',
        boxShadow: '0 1rem 3rem rgba(0,0,0,.5)',
        transform: 'translateY(-50%)',
        backdropFilter: 'blur(.7rem)',
      }}
    >
      <span style={{ color: 'var(--av-brass-300)', font: '750 .43rem/1 var(--av-font-mono)', textTransform: 'uppercase' }}>
        {side === 'left' ? 'Your combatant' : `Team ${participant.teamIndex + 1}`}
      </span>
      <strong style={{ font: '600 .92rem/1 var(--av-font-display)' }}>{participant.characterName}</strong>
      <small style={{ color: 'var(--av-text-dim)', font: '650 .44rem/1.3 var(--av-font-mono)' }}>
        Lv {participant.characterLevel} · Initiative {combatant.initiative} · Move {combatant.baseMovementBudget}
        {profile ? ` · Jump ${profile.jump}` : ''}
      </small>
      <div style={{ display: 'grid', gap: '.22rem' }}>
        <span title={`HP ${combatant.hp} / ${combatant.maxHp}`} style={{ height: '.38rem', overflow: 'hidden', borderRadius: '999px', background: 'rgba(255,255,255,.08)' }}>
          <i style={{ display: 'block', width: `${percent(combatant.hp, combatant.maxHp)}%`, height: '100%', background: 'linear-gradient(90deg,#8f3333,#df675f)' }} />
        </span>
        <span title={`MP ${combatant.mp} / ${combatant.maxMp}`} style={{ height: '.28rem', overflow: 'hidden', borderRadius: '999px', background: 'rgba(255,255,255,.08)' }}>
          <i style={{ display: 'block', width: `${percent(combatant.mp, combatant.maxMp)}%`, height: '100%', background: 'linear-gradient(90deg,#31548c,#719ade)' }} />
        </span>
      </div>
      <small style={{ color: 'var(--av-text-muted)', fontSize: '.5rem' }}>
        {combatant.hp <= 0 ? 'Defeated' : `Facing ${placement?.facing ?? '—'}`}
        {profile ? ` · Armor ${profile.armor} · Evasion ${(profile.evasion / 100).toFixed(0)}%` : ''}
      </small>
    </aside>
  )
}

export function PvpBattleCombatantPanels({
  initialBattle,
  metadata,
}: {
  initialBattle: BattleSessionView
  metadata: PvpBattleMetadata
}) {
  const [battle, setBattle] = useState(initialBattle)
  const local = useMemo(
    () => metadata.participants.find((participant) => participant.characterId === metadata.localCharacterId) ?? null,
    [metadata.localCharacterId, metadata.participants],
  )
  const [selectedId, setSelectedId] = useState<string | null>(
    metadata.participants.find((participant) => participant.characterId !== metadata.localCharacterId)?.combatantId ?? null,
  )
  const selected = useMemo(
    () => metadata.participants.find((participant) => participant.combatantId === selectedId) ?? null,
    [metadata.participants, selectedId],
  )

  useEffect(() => {
    let cancelled = false
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/battles/${initialBattle.battleSessionId}`, { cache: 'no-store' })
        const body = (await response.json()) as { battle?: BattleSessionView }
        if (response.ok && body.battle && !cancelled) setBattle(body.battle)
      } catch {
        // Existing battle UI owns connectivity messaging; this panel repairs itself on the next poll.
      }
    }, 900)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [initialBattle.battleSessionId])

  useEffect(() => {
    function choose(event: MouseEvent) {
      const tile = (event.target as Element | null)?.closest<HTMLButtonElement>(
        '#battlefield button[aria-label*="occupied by"]',
      )
      const label = tile?.getAttribute('aria-label') ?? ''
      const participant = metadata.participants.find((candidate) =>
        label.includes(`occupied by ${candidate.characterName}`),
      )
      if (participant && participant.characterId !== metadata.localCharacterId) {
        setSelectedId(participant.combatantId)
      } else if (participant) {
        setSelectedId(
          metadata.participants.find((candidate) => candidate.characterId !== metadata.localCharacterId)
            ?.combatantId ?? null,
        )
      }
    }
    document.addEventListener('click', choose, true)
    return () => document.removeEventListener('click', choose, true)
  }, [metadata.localCharacterId, metadata.participants])

  if (typeof document === 'undefined') return null
  return createPortal(
    <>
      <Panel participant={local} battle={battle} side="left" />
      <Panel participant={selected} battle={battle} side="right" />
    </>,
    document.body,
  )
}
