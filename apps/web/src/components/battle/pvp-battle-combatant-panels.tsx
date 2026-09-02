'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { PvpBattleMetadata, PvpBattleParticipantView } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import {
  aggregateBattleStatusStacks,
  formatStatusStackCount,
  statusIsBeneficial,
  statusLabel,
} from './battle-effect-summary'
import styles from './pvp-battle-combatant-panels.module.css'

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
  const statuses =
    battle.snapshot.statusState.find((row) => row.combatantId === participant.combatantId)
      ?.statuses ?? []
  const effectStatuses = aggregateBattleStatusStacks(statuses)
  if (!combatant) return null

  const style = { '--combatant-accent': accent } as CSSProperties
  return (
    <aside
      className={styles.panel}
      data-pvp-combatant-panel={side}
      data-side={side}
      aria-label={`${participant.characterName} battle summary`}
      style={style}
    >
      <div className={styles.heading}>
        <div>
          <span>{side === 'left' ? 'Character' : `Team ${participant.teamIndex + 1}`}</span>
          <strong>{participant.characterName}</strong>
        </div>
        {battle.snapshot.tactical.battle.currentTurn?.combatantId === participant.combatantId ? (
          <b>Active</b>
        ) : null}
      </div>

      <div className={styles.portrait}>
        <CharacterPortraitImage
          imageUrl={participant.profileImageUrl}
          fallbackAssetId={getStarterPortraitImageAssetId(
            participant.portraitRef as CharacterPortraitRef,
          )}
          alt={`${participant.characterName} portrait`}
          sizes="(max-width: 880px) 70px, 150px"
        />
        <div className={styles.meters}>
          <span title={`HP ${combatant.hp} / ${combatant.maxHp}`}>
            <i style={{ width: `${percent(combatant.hp, combatant.maxHp)}%` }} />
          </span>
          <span title={`MP ${combatant.mp} / ${combatant.maxMp}`}>
            <i style={{ width: `${percent(combatant.mp, combatant.maxMp)}%` }} />
          </span>
        </div>
      </div>

      <div className={styles.effects} aria-label={`${participant.characterName} status effects`}>
        <span>Effects</span>
        <div>
          {effectStatuses.length > 0 ? (
            effectStatuses.map((status) => {
              const loweredGuard = status.statusId === 'lowered-guard'
              const label = statusLabel(status.statusId)
              const stackCount = formatStatusStackCount(status.statusId, status.stacks)
              return (
                <b
                  key={`${status.statusId}:${status.statusVersion}`}
                  data-debuff={!statusIsBeneficial(status.statusId) || undefined}
                  title={
                    loweredGuard
                      ? `${label} ${stackCount} · each stack multiplies incoming damage by 2.5×`
                      : `${label} ${stackCount}`
                  }
                >
                  <span>{label}</span>
                  <strong>{stackCount}</strong>
                </b>
              )
            })
          ) : (
            <small>No effects</small>
          )}
        </div>
      </div>

      <div className={styles.facing}>
        <span aria-hidden="true">
          {placement?.facing === 'north'
            ? '↑'
            : placement?.facing === 'east'
              ? '→'
              : placement?.facing === 'south'
                ? '↓'
                : '←'}
        </span>
        <strong>{placement?.facing ?? '—'}</strong>
      </div>
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
  const [battlefieldTarget, setBattlefieldTarget] = useState<HTMLElement | null>(null)
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
    const locate = () => setBattlefieldTarget(document.querySelector<HTMLElement>('#battlefield'))
    locate()
    const observer = new MutationObserver(locate)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

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

  if (!battlefieldTarget) return null
  return createPortal(
    <div className={styles.rails} data-pvp-battle-rails="true">
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
    </div>,
    battlefieldTarget,
  )
}
