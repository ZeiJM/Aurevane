'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import { useEffect, useMemo, useState } from 'react'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { PvpBattleMetadata, PvpBattleParticipantView } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import styles from './mobile-battle-combatant-popup.module.css'

const ACTION_ECONOMY_KEY = 'pv1f.action-economy'

type GridPosition = { x: number; y: number }
type BattleSnapshot = BattleSessionView['snapshot']
type Combatant = BattleSnapshot['tactical']['battle']['combatants'][number]
type Placement = BattleSnapshot['tactical']['placements'][number]
type Profile = BattleSnapshot['statBridge']['combatants'][number]
type CombatStatus = BattleSnapshot['statusState'][number]['statuses'][number]
type InspectMetadata = Pick<PvpBattleMetadata, 'participants'>

interface SelectedCombatant {
  combatant: Combatant
  placement: Placement
  profile: Profile | null
  statuses: readonly CombatStatus[]
  participant: PvpBattleParticipantView
  active: boolean
  actionEconomy: number | null
}

interface BattleApiBody {
  battle?: BattleSessionView
  error?: { message?: string }
}

function parseTilePosition(label: string): GridPosition | null {
  const match = label.match(/^Tile\s+(\d+),\s*(\d+)/i)
  if (!match) return null
  return { x: Number(match[1]) - 1, y: Number(match[2]) - 1 }
}

function positionsEqual(left: GridPosition, right: GridPosition): boolean {
  return left.x === right.x && left.y === right.y
}

function percentFromBasisPoints(value: number): string {
  return `${Math.round(value / 100)}%`
}

function facingGlyph(facing: Placement['facing']): string {
  if (facing === 'north') return '↑'
  if (facing === 'east') return '→'
  if (facing === 'south') return '↓'
  return '←'
}

function statusLabel(statusId: string): string {
  if (statusId === 'guarded') return 'Guarded'
  return statusId
    .replace(/^buff\./, '')
    .replace(/^debuff\./, '')
    .split('.')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function inspectModeActive(): boolean {
  if (document.querySelector("[data-spectator-inspect-active='true']")) return true

  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
  )
  const inspect = buttons.find(
    (button) => button.querySelector('strong')?.textContent?.trim() === 'Inspect',
  )
  if (!inspect) return false
  return inspect.hasAttribute('data-active') || `${inspect.className}`.includes('commandActive')
}

function readSelectedCombatant(
  battle: BattleSessionView,
  position: GridPosition,
  metadata: InspectMetadata,
): SelectedCombatant | null {
  const placement = battle.snapshot.tactical.placements.find((candidate) =>
    positionsEqual(candidate.position, position),
  )
  if (!placement) return null

  const combatant = battle.snapshot.tactical.battle.combatants.find(
    (candidate) => candidate.id === placement.combatantId,
  )
  const participant = metadata.participants.find(
    (candidate) => candidate.combatantId === placement.combatantId,
  )
  if (!combatant || !participant) return null

  const profile =
    battle.snapshot.statBridge.combatants.find(
      (candidate) => candidate.combatantId === combatant.id,
    ) ?? null
  const statuses =
    battle.snapshot.statusState.find((candidate) => candidate.combatantId === combatant.id)
      ?.statuses ?? []
  const economy = combatant.temporaryResources.find(
    (resource) => resource.key === ACTION_ECONOMY_KEY,
  )

  return {
    combatant,
    placement,
    profile,
    statuses,
    participant,
    active: battle.snapshot.tactical.battle.currentTurn?.combatantId === combatant.id,
    actionEconomy: economy?.current ?? null,
  }
}

export function PvpBattleInspectPopup({
  battleSessionId,
  metadata,
  battleView = null,
}: {
  battleSessionId: string
  metadata: InspectMetadata
  battleView?: BattleSessionView | null
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedCombatant | null>(null)

  useEffect(() => {
    let requestSequence = 0

    async function openCombatant(position: GridPosition) {
      const sequence = ++requestSequence
      setOpen(true)
      setLoading(!battleView)
      setError(null)
      setSelected(null)

      try {
        let currentBattle = battleView
        if (!currentBattle) {
          const response = await fetch(`/api/battles/${battleSessionId}`, {
            method: 'GET',
            cache: 'no-store',
          })
          const body = (await response.json()) as BattleApiBody
          if (sequence !== requestSequence) return
          if (!response.ok || !body.battle) {
            throw new Error(body.error?.message ?? 'Combatant details could not be loaded.')
          }
          currentBattle = body.battle
        }

        if (sequence !== requestSequence) return
        const next = readSelectedCombatant(currentBattle, position, metadata)
        if (!next) throw new Error('That combatant is no longer on this tile.')
        setSelected(next)
      } catch (loadError) {
        if (sequence !== requestSequence) return
        setError(
          loadError instanceof Error ? loadError.message : 'Combatant details could not be loaded.',
        )
      } finally {
        if (sequence === requestSequence) setLoading(false)
      }
    }

    function handleBattlefieldClick(event: MouseEvent) {
      if (!inspectModeActive()) return
      const target = event.target instanceof Element ? event.target : null
      const tile = target?.closest<HTMLButtonElement>(
        '#battlefield button[aria-label^="Tile "][aria-label*="occupied by"]',
      )
      if (!tile) return

      const position = parseTilePosition(tile.getAttribute('aria-label') ?? '')
      if (!position) return

      event.preventDefault()
      event.stopPropagation()
      void openCombatant(position)
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('click', handleBattlefieldClick, true)
    window.addEventListener('keydown', handleEscape)
    return () => {
      requestSequence += 1
      document.removeEventListener('click', handleBattlefieldClick, true)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [battleSessionId, battleView, metadata])

  const healthPercent = useMemo(() => {
    if (!selected || selected.combatant.maxHp <= 0) return 0
    return Math.max(0, Math.min(100, (selected.combatant.hp / selected.combatant.maxHp) * 100))
  }, [selected])
  const manaPercent = useMemo(() => {
    if (!selected || selected.combatant.maxMp <= 0) return 0
    return Math.max(0, Math.min(100, (selected.combatant.mp / selected.combatant.maxMp) * 100))
  }, [selected])

  if (!open) return null

  return (
    <div
      className={styles.backdrop}
      data-pvp-inspect-popup="true"
      onPointerDown={() => setOpen(false)}
    >
      <section
        className={styles.popup}
        role="dialog"
        aria-modal="true"
        aria-label={
          selected
            ? `${selected.participant.characterName} battle details`
            : 'Battle combatant details'
        }
        onPointerDown={(event) => event.stopPropagation()}
      >
        {loading ? (
          <div className={styles.loading}>Loading combatant details…</div>
        ) : error ? (
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : selected ? (
          <>
            <div className={styles.identityRow}>
              <div className={styles.portrait}>
                <CharacterPortraitImage
                  imageUrl={selected.participant.profileImageUrl}
                  fallbackAssetId={getStarterPortraitImageAssetId(
                    selected.participant.portraitRef as CharacterPortraitRef,
                  )}
                  className={styles.portraitImage}
                  sizes="8rem"
                  alt={`${selected.participant.characterName} portrait`}
                />
              </div>
              <div className={styles.identityCopy}>
                <span>Team {selected.participant.teamIndex + 1}</span>
                <h2>{selected.participant.characterName}</h2>
                <p>
                  Level {selected.participant.characterLevel}
                  {selected.active ? ' · Active turn' : ''} · Facing {selected.placement.facing}{' '}
                  {facingGlyph(selected.placement.facing)}
                </p>
              </div>
            </div>

            <div className={styles.resources}>
              <div>
                <span>HP</span>
                <strong>
                  {selected.combatant.hp}/{selected.combatant.maxHp}
                </strong>
                <i aria-hidden="true">
                  <b style={{ width: `${healthPercent}%` }} />
                </i>
              </div>
              <div>
                <span>MP</span>
                <strong>
                  {selected.combatant.mp}/{selected.combatant.maxMp}
                </strong>
                <i aria-hidden="true">
                  <b style={{ width: `${manaPercent}%` }} />
                </i>
              </div>
              <div>
                <span>AP</span>
                <strong>{selected.actionEconomy ?? '—'}</strong>
              </div>
            </div>

            <dl className={styles.stats}>
              <div>
                <dt>Initiative</dt>
                <dd>{selected.combatant.initiative}</dd>
              </div>
              <div>
                <dt>Movement</dt>
                <dd>{selected.combatant.baseMovementBudget}</dd>
              </div>
              <div>
                <dt>Jump</dt>
                <dd>{selected.profile?.jump ?? '—'}</dd>
              </div>
              <div>
                <dt>Accuracy</dt>
                <dd>
                  {selected.profile ? percentFromBasisPoints(selected.profile.accuracy) : '—'}
                </dd>
              </div>
              <div>
                <dt>Evasion</dt>
                <dd>{selected.profile ? percentFromBasisPoints(selected.profile.evasion) : '—'}</dd>
              </div>
              <div>
                <dt>Armor</dt>
                <dd>{selected.profile?.armor ?? '—'}</dd>
              </div>
              <div>
                <dt>Ward</dt>
                <dd>{selected.profile?.ward ?? '—'}</dd>
              </div>
              <div>
                <dt>Facing</dt>
                <dd>
                  {facingGlyph(selected.placement.facing)} {selected.placement.facing}
                </dd>
              </div>
            </dl>

            <section
              className={styles.effects}
              aria-label={`${selected.participant.characterName} active effects`}
            >
              <span>Active effects</span>
              {selected.statuses.length === 0 ? (
                <p>No buffs or debuffs are active.</p>
              ) : (
                <ul>
                  {selected.statuses.map((status) => (
                    <li key={`${status.statusId}:${status.sourceCombatantId}`}>
                      <strong>{statusLabel(status.statusId)}</strong>
                      <small>
                        {status.remainingOwnerTurnStarts} turn
                        {status.remainingOwnerTurnStarts === 1 ? '' : 's'} remaining
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className={styles.hint}>
              Inspect mode only. Tap or click outside this card to close it.
            </p>
          </>
        ) : null}
      </section>
    </div>
  )
}
