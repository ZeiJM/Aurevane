'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { PvpBattleMetadata, PvpBattleParticipantView } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { pvpParticipantAccent } from './battle-combatant-colors'
import styles from './pvp-six-combatant-rails.module.css'

type BattleSnapshot = BattleSessionView['snapshot']
type Combatant = BattleSnapshot['tactical']['battle']['combatants'][number]
type Placement = BattleSnapshot['tactical']['placements'][number]

const DESKTOP_QUERY = '(min-width: 821px)'

function meterPercent(value: number, maximum: number): number {
  if (maximum <= 0) return 0
  return Math.max(0, Math.min(100, (value / maximum) * 100))
}

function facingGlyph(facing: Placement['facing']): string {
  if (facing === 'north') return '↑'
  if (facing === 'east') return '→'
  if (facing === 'south') return '↓'
  return '←'
}

function participantState(
  battle: BattleSessionView,
  participant: PvpBattleParticipantView,
): { combatant: Combatant | null; placement: Placement | null; active: boolean } {
  const combatant =
    battle.snapshot.tactical.battle.combatants.find(
      (candidate) => candidate.id === participant.combatantId,
    ) ?? null
  const placement =
    battle.snapshot.tactical.placements.find(
      (candidate) => candidate.combatantId === participant.combatantId,
    ) ?? null

  return {
    combatant,
    placement,
    active: battle.snapshot.tactical.battle.currentTurn?.combatantId === participant.combatantId,
  }
}

function participantSort(left: PvpBattleParticipantView, right: PvpBattleParticipantView): number {
  return left.teamIndex - right.teamIndex || left.seatIndex - right.seatIndex
}

function RailCard({
  battle,
  participant,
  friendly,
  accent,
}: {
  battle: BattleSessionView
  participant: PvpBattleParticipantView
  friendly: boolean
  accent: string
}) {
  const { combatant, placement, active } = participantState(battle, participant)
  if (!combatant || !placement) return null

  const accentStyle = { '--battle-combatant-accent': accent } as CSSProperties

  return (
    <article
      className={styles.card}
      data-active={active || undefined}
      data-defeated={combatant.hp <= 0 || undefined}
      style={accentStyle}
    >
      <div className={styles.heading}>
        <div>
          <span>{friendly ? 'Character' : `Opponent · Team ${participant.teamIndex + 1}`}</span>
          <strong>{participant.characterName}</strong>
        </div>
        <div className={styles.turnState}>
          <i
            aria-label={`${participant.characterName} facing ${placement.facing}`}
            title={`Facing ${placement.facing}`}
          >
            {facingGlyph(placement.facing)}
          </i>
          {active ? <b>Active</b> : null}
        </div>
      </div>

      <button
        type="button"
        className={styles.portraitButton}
        data-desktop-inspect-combatant={participant.combatantId}
        aria-label={`Inspect ${participant.characterName}`}
        title={`Use Inspect to view ${participant.characterName}`}
      >
        <CharacterPortraitImage
          imageUrl={participant.profileImageUrl}
          fallbackAssetId={getStarterPortraitImageAssetId(
            participant.portraitRef as CharacterPortraitRef,
          )}
          className={styles.portraitImage}
          sizes="11rem"
          alt=""
        />
        <div className={styles.meters}>
          <span
            aria-label={`${participant.characterName} HP ${combatant.hp} of ${combatant.maxHp}`}
          >
            <i style={{ width: `${meterPercent(combatant.hp, combatant.maxHp)}%` }} />
          </span>
          <span
            aria-label={`${participant.characterName} MP ${combatant.mp} of ${combatant.maxMp}`}
          >
            <i style={{ width: `${meterPercent(combatant.mp, combatant.maxMp)}%` }} />
          </span>
        </div>
      </button>
    </article>
  )
}

export function PvpSixCombatantRails({
  initialBattle,
  metadata,
}: {
  initialBattle: BattleSessionView
  metadata: PvpBattleMetadata
}) {
  const [battle, setBattle] = useState(initialBattle)
  const [contentTarget, setContentTarget] = useState<HTMLElement | null>(null)
  const [desktop, setDesktop] = useState(false)

  const teamCount = useMemo(
    () => Math.max(1, ...metadata.participants.map((participant) => participant.teamIndex + 1)),
    [metadata.participants],
  )
  const localParticipant = useMemo(
    () =>
      metadata.participants.find(
        (participant) => participant.characterId === metadata.localCharacterId,
      ) ?? null,
    [metadata.localCharacterId, metadata.participants],
  )
  const localTeamIndex = localParticipant?.teamIndex ?? null
  const allies = useMemo(
    () =>
      localTeamIndex === null
        ? []
        : metadata.participants
            .filter((participant) => participant.teamIndex === localTeamIndex)
            .slice()
            .sort(participantSort),
    [localTeamIndex, metadata.participants],
  )
  const opponents = useMemo(
    () =>
      localTeamIndex === null
        ? []
        : metadata.participants
            .filter((participant) => participant.teamIndex !== localTeamIndex)
            .slice()
            .sort(participantSort),
    [localTeamIndex, metadata.participants],
  )

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY)
    const sync = () => setDesktop(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const receiveBattleState = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const next = event.detail as BattleSessionView | undefined
      if (!next || next.battleSessionId !== initialBattle.battleSessionId) return
      setBattle((current) => (next.battleVersion !== current.battleVersion ? next : current))
    }

    window.addEventListener('aurevane:pvp-battle-state', receiveBattleState)
    return () => window.removeEventListener('aurevane:pvp-battle-state', receiveBattleState)
  }, [initialBattle.battleSessionId])

  useEffect(() => {
    if (!desktop) {
      setContentTarget(null)
      return
    }

    let frame = 0
    const locate = () => {
      frame = 0
      const target = document.querySelector<HTMLElement>('[data-pvp-desktop-content="true"]')
      setContentTarget((current) => (current === target ? current : target))
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(locate)
    }

    locate()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [desktop])

  useEffect(() => {
    if (!desktop || !contentTarget) return

    let frame = 0
    const syncGridAccents = () => {
      frame = 0
      const accents = new Map(
        metadata.participants.map((participant) => [
          participant.characterName,
          pvpParticipantAccent(participant.teamIndex, participant.seatIndex, teamCount),
        ]),
      )

      for (const tile of contentTarget.querySelectorAll<HTMLButtonElement>(
        'button[aria-label^="Tile "][aria-label*="occupied by"]',
      )) {
        const label = tile.getAttribute('aria-label') ?? ''
        const occupiedBy = label.split('; occupied by ')[1]?.trim()
        if (!occupiedBy) continue
        const accent = accents.get(occupiedBy)
        if (!accent) continue
        const token = tile.querySelector<HTMLElement>('[data-team]')
        if (!token) continue
        token.dataset.desktopCombatantToken = 'true'
        token.style.setProperty('--battle-combatant-accent', accent)
      }
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(syncGridAccents)
    }

    syncGridAccents()
    const observer = new MutationObserver(schedule)
    observer.observe(contentTarget, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [battle.battleVersion, contentTarget, desktop, metadata.participants, teamCount])

  if (!desktop || !contentTarget || !localParticipant) return null

  return createPortal(
    <>
      <aside
        className={`${styles.rail} ${styles.railLeft}`}
        data-six-combatant-rail="true"
        aria-label="Allied combatants"
      >
        <div className={styles.stack} data-count={String(allies.length)}>
          {allies.map((participant) => (
            <RailCard
              key={participant.combatantId}
              battle={battle}
              participant={participant}
              friendly
              accent={pvpParticipantAccent(participant.teamIndex, participant.seatIndex, teamCount)}
            />
          ))}
        </div>
      </aside>

      <aside
        className={`${styles.rail} ${styles.railRight}`}
        data-six-combatant-rail="true"
        aria-label="Opposing combatants"
      >
        <div className={styles.stack} data-count={String(opponents.length)}>
          {opponents.map((participant) => (
            <RailCard
              key={participant.combatantId}
              battle={battle}
              participant={participant}
              friendly={false}
              accent={pvpParticipantAccent(participant.teamIndex, participant.seatIndex, teamCount)}
            />
          ))}
        </div>
      </aside>
    </>,
    contentTarget,
  )
}
