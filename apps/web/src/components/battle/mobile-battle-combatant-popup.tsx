'use client'

import { useEffect, useMemo, useState } from 'react'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import type { ImageAssetId } from '@/media/registry'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import styles from './mobile-battle-combatant-popup.module.css'

const MOBILE_QUERY = '(max-width: 880px)'
const ACTION_ECONOMY_KEY = 'pv1f.action-economy'

type GridPosition = { x: number; y: number }
type BattleSnapshot = BattleSessionView['snapshot']
type Combatant = BattleSnapshot['tactical']['battle']['combatants'][number]
type Placement = BattleSnapshot['tactical']['placements'][number]
type Profile = BattleSnapshot['statBridge']['combatants'][number]
type CombatStatus = BattleSnapshot['statusState'][number]['statuses'][number]

interface MobileBattleCombatantPopupProps {
  battleSessionId: string
  playerName: string
  playerPortraitAssetId: ImageAssetId
  playerProfileImageUrl?: string | null
}

interface SelectedCombatant {
  combatant: Combatant
  placement: Placement
  profile: Profile | null
  statuses: readonly CombatStatus[]
  name: string
  isPlayer: boolean
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
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
  )
  const inspect = buttons.find(
    (button) => button.querySelector('strong')?.textContent?.trim() === 'Inspect',
  )
  if (!inspect) return false
  return (
    inspect.hasAttribute('data-active') ||
    inspect.getAttribute('aria-pressed') === 'true' ||
    `${inspect.className}`.includes('commandActive')
  )
}

function readSelectedCombatant(
  battle: BattleSessionView,
  position: GridPosition,
  playerName: string,
): SelectedCombatant | null {
  const placement = battle.snapshot.tactical.placements.find((candidate) =>
    positionsEqual(candidate.position, position),
  )
  if (!placement) return null

  const combatant = battle.snapshot.tactical.battle.combatants.find(
    (candidate) => candidate.id === placement.combatantId,
  )
  if (!combatant) return null

  const profile =
    battle.snapshot.statBridge.combatants.find(
      (candidate) => candidate.combatantId === combatant.id,
    ) ?? null
  const statuses =
    battle.snapshot.statusState.find((candidate) => candidate.combatantId === combatant.id)
      ?.statuses ?? []
  const isPlayer = combatant.id.startsWith('character:')
  const economy = combatant.temporaryResources.find(
    (resource) => resource.key === ACTION_ECONOMY_KEY,
  )

  return {
    combatant,
    placement,
    profile,
    statuses,
    name: isPlayer ? playerName : combatant.id.startsWith('recruit:') ? 'Recruit' : 'Combatant',
    isPlayer,
    active: battle.snapshot.tactical.battle.currentTurn?.combatantId === combatant.id,
    actionEconomy: economy?.current ?? null,
  }
}

export function MobileBattleCombatantPopup({
  battleSessionId,
  playerName,
  playerPortraitAssetId,
  playerProfileImageUrl = null,
}: MobileBattleCombatantPopupProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedCombatant | null>(null)

  useEffect(() => {
    let requestSequence = 0

    async function openCombatant(position: GridPosition) {
      const sequence = ++requestSequence
      setOpen(true)
      setLoading(true)
      setError(null)
      setSelected(null)

      try {
        const response = await fetch(`/api/battles/${battleSessionId}`, {
          method: 'GET',
          cache: 'no-store',
        })
        const body = (await response.json()) as BattleApiBody
        if (sequence !== requestSequence) return
        if (!response.ok || !body.battle) {
          throw new Error(body.error?.message ?? 'Combatant details could not be loaded.')
        }

        const next = readSelectedCombatant(body.battle, position, playerName)
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
      if (!window.matchMedia(MOBILE_QUERY).matches || !inspectModeActive()) return
      const target = event.target instanceof Element ? event.target : null
      const tile = target?.closest<HTMLButtonElement>(
        '#battlefield button[aria-label^="Tile "][aria-label*="occupied by"]',
      )
      if (!tile) return

      const label = tile.getAttribute('aria-label') ?? ''
      const position = parseTilePosition(label)
      if (!position) return

      // Combatant details are an explicit Inspect gesture on mobile. Outside Inspect mode, leave
      // the battlefield tap untouched so self-targeting, movement, attacks, and turn actions keep
      // their normal command behavior.
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
  }, [battleSessionId, playerName])

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
    <div className={styles.backdrop} onPointerDown={() => setOpen(false)} data-mobile-battle-popup>
      <section
        className={styles.popup}
        role="dialog"
        aria-modal="true"
        aria-label={selected ? `${selected.name} battle details` : 'Battle combatant details'}
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
                {selected.isPlayer ? (
                  <CharacterPortraitImage
                    imageUrl={playerProfileImageUrl}
                    fallbackAssetId={playerPortraitAssetId}
                    className={styles.portraitImage}
                    sizes="8rem"
                    alt={`${selected.name} portrait`}
                  />
                ) : (
                  <span className={styles.recruitPortrait} aria-label="Recruit default portrait">
                    R
                  </span>
                )}
              </div>
              <div className={styles.identityCopy}>
                <span>{selected.isPlayer ? 'Character' : 'Opponent'}</span>
                <h2>{selected.name}</h2>
                <p>
                  {selected.active ? 'Active turn · ' : ''}
                  Facing {selected.placement.facing} {facingGlyph(selected.placement.facing)}
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

            <section className={styles.effects} aria-label={`${selected.name} active effects`}>
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
              Inspect mode only. Tap outside this card to close it; all other battle modes keep
              combatant taps reserved for their active command.
            </p>
          </>
        ) : null}
      </section>
    </div>
  )
}
