'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { PvpBattleMetadata, PvpBattleParticipantView } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

const COMBATANT_COLORS = ['#67c98a', '#dc6a66', '#67aee8', '#d9ad5c', '#a984e8', '#df7eb5'] as const

function percent(value: number, maximum: number): number {
  return maximum > 0 ? Math.max(0, Math.min(100, (value / maximum) * 100)) : 0
}

function Panel({
  participant,
  battle,
  side,
  accent,
}: {
  participant: PvpBattleParticipantView | null
  battle: BattleSessionView
  side: 'left' | 'right'
  accent: string
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
  const statuses =
    battle.snapshot.statusState.find((row) => row.combatantId === participant.combatantId)
      ?.statuses ?? []
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
        border: `1px solid ${accent}88`,
        borderRadius: 'var(--av-radius-md)',
        background: 'rgba(7,10,15,.96)',
        boxShadow: `0 1rem 3rem rgba(0,0,0,.5), 0 0 1rem ${accent}22`,
        transform: 'translateY(-50%)',
        backdropFilter: 'blur(.7rem)',
      }}
    >
      <span
        style={{
          color: accent,
          font: '750 .43rem/1 var(--av-font-mono)',
          textTransform: 'uppercase',
        }}
      >
        {side === 'left' ? 'Your combatant' : `Team ${participant.teamIndex + 1}`}
      </span>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2.7rem 1fr',
          gap: '.55rem',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            display: 'grid',
            width: '2.7rem',
            height: '2.7rem',
            overflow: 'hidden',
            border: `2px solid ${accent}`,
            borderRadius: '50%',
            boxShadow: `0 0 .8rem ${accent}aa`,
          }}
        >
          <CharacterPortraitImage
            imageUrl={participant.profileImageUrl}
            fallbackAssetId={getStarterPortraitImageAssetId(
              participant.portraitRef as CharacterPortraitRef,
            )}
            alt={`${participant.characterName} portrait`}
            sizes="44px"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 50%' }}
          />
        </span>
        <div style={{ display: 'grid', gap: '.2rem' }}>
          <strong style={{ font: '600 .92rem/1 var(--av-font-display)' }}>
            {participant.characterName}
          </strong>
          <small
            style={{ color: 'var(--av-text-dim)', font: '650 .44rem/1.3 var(--av-font-mono)' }}
          >
            Lv {participant.characterLevel} · Initiative {combatant.initiative}
          </small>
        </div>
      </div>
      <small style={{ color: 'var(--av-text-dim)', font: '650 .44rem/1.3 var(--av-font-mono)' }}>
        Move {combatant.baseMovementBudget}
        {profile ? ` · Jump ${profile.jump}` : ''}
      </small>
      <div style={{ display: 'grid', gap: '.22rem' }}>
        <span
          title={`HP ${combatant.hp} / ${combatant.maxHp}`}
          style={{
            height: '.38rem',
            overflow: 'hidden',
            borderRadius: '999px',
            background: 'rgba(255,255,255,.08)',
          }}
        >
          <i
            style={{
              display: 'block',
              width: `${percent(combatant.hp, combatant.maxHp)}%`,
              height: '100%',
              background: 'linear-gradient(90deg,#8f3333,#df675f)',
            }}
          />
        </span>
        <span
          title={`MP ${combatant.mp} / ${combatant.maxMp}`}
          style={{
            height: '.28rem',
            overflow: 'hidden',
            borderRadius: '999px',
            background: 'rgba(255,255,255,.08)',
          }}
        >
          <i
            style={{
              display: 'block',
              width: `${percent(combatant.mp, combatant.maxMp)}%`,
              height: '100%',
              background: 'linear-gradient(90deg,#31548c,#719ade)',
            }}
          />
        </span>
      </div>
      <div
        aria-label={`${participant.characterName} status effects`}
        style={{ display: 'flex', minHeight: '1.55rem', flexWrap: 'wrap', gap: '.3rem' }}
      >
        {statuses.length > 0 ? (
          statuses.map((status) => {
            const loweredGuard = status.statusId === 'lowered-guard'
            return (
              <span
                key={status.statusId}
                title={
                  loweredGuard
                    ? 'Lowered Guard · takes 2.5× damage from all sources'
                    : status.statusId
                }
                style={{
                  display: 'inline-flex',
                  gap: '.25rem',
                  alignItems: 'center',
                  padding: '.28rem .36rem',
                  border: `1px solid ${loweredGuard ? 'rgba(225,98,82,.7)' : 'rgba(212,186,130,.28)'}`,
                  borderRadius: '.3rem',
                  color: loweredGuard ? '#f0a398' : 'var(--av-text-muted)',
                  background: loweredGuard ? 'rgba(151,45,36,.18)' : 'rgba(255,255,255,.025)',
                  font: '700 .4rem/1 var(--av-font-mono)',
                }}
              >
                <b aria-hidden="true">{loweredGuard ? '⛨↓' : '◇'}</b>
                {loweredGuard ? 'Lowered Guard' : status.statusId}
              </span>
            )
          })
        ) : (
          <span style={{ color: 'var(--av-text-dim)', font: '650 .4rem/1 var(--av-font-mono)' }}>
            No active effects
          </span>
        )}
      </div>
      <small style={{ color: 'var(--av-text-muted)', fontSize: '.5rem' }}>
        {combatant.hp <= 0 ? 'Defeated' : `Facing ${placement?.facing ?? '—'}`}
        {profile
          ? ` · Armor ${profile.armor} · Evasion ${(profile.evasion / 100).toFixed(0)}%`
          : ''}
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
  const orderedParticipants = useMemo(
    () =>
      [...metadata.participants].sort(
        (left, right) =>
          left.teamIndex - right.teamIndex ||
          left.seatIndex - right.seatIndex ||
          left.characterId.localeCompare(right.characterId),
      ),
    [metadata.participants],
  )
  const accentByCombatant = useMemo(
    () =>
      new Map(
        orderedParticipants.map((participant, index) => [
          participant.combatantId,
          COMBATANT_COLORS[index % COMBATANT_COLORS.length],
        ]),
      ),
    [orderedParticipants],
  )
  const local = useMemo(
    () =>
      metadata.participants.find(
        (participant) => participant.characterId === metadata.localCharacterId,
      ) ?? null,
    [metadata.localCharacterId, metadata.participants],
  )
  const [selectedId, setSelectedId] = useState<string | null>(
    metadata.participants.find(
      (participant) => participant.characterId !== metadata.localCharacterId,
    )?.combatantId ??
      metadata.participants[0]?.combatantId ??
      null,
  )
  const selected = useMemo(
    () =>
      metadata.participants.find((participant) => participant.combatantId === selectedId) ?? null,
    [metadata.participants, selectedId],
  )

  useEffect(() => {
    let cancelled = false
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/battles/${initialBattle.battleSessionId}`, {
          cache: 'no-store',
        })
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
      if (participant) setSelectedId(participant.combatantId)
    }
    document.addEventListener('click', choose, true)
    return () => document.removeEventListener('click', choose, true)
  }, [metadata.participants])

  if (typeof document === 'undefined') return null
  return createPortal(
    <>
      <Panel
        participant={local}
        battle={battle}
        side="left"
        accent={
          local
            ? (accentByCombatant.get(local.combatantId) ?? COMBATANT_COLORS[0])
            : COMBATANT_COLORS[0]
        }
      />
      <Panel
        participant={selected}
        battle={battle}
        side="right"
        accent={
          selected
            ? (accentByCombatant.get(selected.combatantId) ?? COMBATANT_COLORS[1])
            : COMBATANT_COLORS[1]
        }
      />
    </>,
    document.body,
  )
}
