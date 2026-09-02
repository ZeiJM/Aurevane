'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import { useEffect, useState } from 'react'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { ImageAssetId } from '@/media/registry'
import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import styles from './desktop-battle-combatant-inspect.module.css'
import { PvpBattleInspectPopup } from './pvp-battle-inspect-popup'

const DESKTOP_QUERY = '(min-width: 881px)'
const BASIS_POINTS = 10_000

type GridPosition = { x: number; y: number }
type BattleSnapshot = BattleSessionView['snapshot']
type Combatant = BattleSnapshot['tactical']['battle']['combatants'][number]
type Placement = BattleSnapshot['tactical']['placements'][number]
type Profile = BattleSnapshot['statBridge']['combatants'][number]
type CombatStatus = BattleSnapshot['statusState'][number]['statuses'][number]
type InspectMetadata = Pick<PvpBattleMetadata, 'participants'>
type EffectSummaryTone = 'buff' | 'debuff' | 'neutral'
type EffectSummaryItem = { label: string; value: string; tone: EffectSummaryTone }

type SelectedCombatant = {
  combatant: Combatant
  placement: Placement
  profile: Profile | null
  statuses: readonly CombatStatus[]
  name: string
  teamLabel: string
  level: number | null
  imageUrl: string | null
  fallbackAssetId: ImageAssetId | null
  active: boolean
}

type BattleApiBody = {
  battle?: BattleSessionView
  error?: { message?: string }
}

type OpenTarget =
  | { kind: 'combatant'; combatantId: string }
  | { kind: 'name'; name: string }
  | { kind: 'position'; position: GridPosition }

function parseTilePosition(label: string): GridPosition | null {
  const match = label.match(/^Tile\s+(\d+),\s*(\d+)/i)
  if (!match) return null
  return { x: Number(match[1]) - 1, y: Number(match[2]) - 1 }
}

function positionsEqual(left: GridPosition, right: GridPosition): boolean {
  return left.x === right.x && left.y === right.y
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
  return (
    inspect.hasAttribute('data-active') ||
    inspect.getAttribute('aria-pressed') === 'true' ||
    `${inspect.className}`.includes('commandActive')
  )
}

function facingGlyph(facing: Placement['facing']): string {
  if (facing === 'north') return '↑'
  if (facing === 'east') return '→'
  if (facing === 'south') return '↓'
  return '←'
}

function meterPercent(value: number, maximum: number): number {
  if (maximum <= 0) return 0
  return Math.max(0, Math.min(100, (value / maximum) * 100))
}

function percentFromBasisPoints(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value / 100)}%`
}

function signedPercentFromBasisPointDelta(value: number): string {
  if (value === 0) return '±0%'
  const percent = Math.abs(value) / 100
  const compact = Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
  return `${value > 0 ? '+' : '−'}${compact}%`
}

function statusLabel(statusId: string): string {
  if (statusId === 'guarded') return 'Guarded'
  if (statusId === 'lowered-guard' || statusId === 'lowered.guard') return 'Lowered Guard'
  return statusId
    .replace(/^buff\./, '')
    .replace(/^debuff\./, '')
    .replaceAll('-', ' ')
    .replaceAll('.', ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function statusIsBeneficial(statusId: string): boolean {
  return statusId === 'guarded' || statusId.startsWith('buff.')
}

function summarizeEffects(statuses: readonly CombatStatus[]): EffectSummaryItem[] {
  let buffStacks = 0
  let debuffStacks = 0
  let damageTakenMultiplier = BASIS_POINTS
  let measuredDamageTaken = false

  for (const status of statuses) {
    const stacks = Math.max(1, status.stacks)
    if (statusIsBeneficial(status.statusId)) buffStacks += stacks
    else debuffStacks += stacks

    const definition = PV1F_COMBAT_CONTENT.statuses.find(
      (candidate) => candidate.id === status.statusId && candidate.version === status.statusVersion,
    )
    if (!definition || definition.damageTakenMultiplierBasisPoints === BASIS_POINTS) continue

    measuredDamageTaken = true
    for (let stack = 0; stack < stacks; stack += 1) {
      damageTakenMultiplier = Math.round(
        (damageTakenMultiplier * definition.damageTakenMultiplierBasisPoints) / BASIS_POINTS,
      )
    }
  }

  const summary: EffectSummaryItem[] = []
  if (measuredDamageTaken) {
    const delta = damageTakenMultiplier - BASIS_POINTS
    summary.push({
      label: 'DMG IN',
      value: signedPercentFromBasisPointDelta(delta),
      tone: delta < 0 ? 'buff' : delta > 0 ? 'debuff' : 'neutral',
    })
  }
  if (buffStacks > 0) summary.push({ label: 'BUFF', value: `+${buffStacks}`, tone: 'buff' })
  if (debuffStacks > 0) {
    summary.push({ label: 'DEBUFF', value: `−${debuffStacks}`, tone: 'debuff' })
  }
  return summary
}

function displayNameForCombatant(combatantId: string, playerName: string | null): string {
  if (playerName && combatantId.startsWith('character:')) return playerName
  if (combatantId.startsWith('recruit:')) return 'Recruit'
  return combatantId
}

function resolveCombatantId(
  battle: BattleSessionView,
  target: OpenTarget,
  metadata: InspectMetadata | null,
  playerName: string | null,
): string | null {
  if (target.kind === 'combatant') return target.combatantId

  if (target.kind === 'position') {
    return (
      battle.snapshot.tactical.placements.find((placement) =>
        positionsEqual(placement.position, target.position),
      )?.combatantId ?? null
    )
  }

  const pvpParticipant = metadata?.participants.find(
    (participant) => participant.characterName === target.name,
  )
  if (pvpParticipant) return pvpParticipant.combatantId

  return (
    battle.snapshot.tactical.battle.combatants.find(
      (combatant) => displayNameForCombatant(combatant.id, playerName) === target.name,
    )?.id ?? null
  )
}

function readSelectedCombatant(
  battle: BattleSessionView,
  combatantId: string,
  metadata: InspectMetadata | null,
  playerName: string | null,
  playerPortraitAssetId: ImageAssetId | null,
  playerProfileImageUrl: string | null,
): SelectedCombatant | null {
  const combatant = battle.snapshot.tactical.battle.combatants.find(
    (candidate) => candidate.id === combatantId,
  )
  const placement = battle.snapshot.tactical.placements.find(
    (candidate) => candidate.combatantId === combatantId,
  )
  if (!combatant || !placement) return null

  const profile =
    battle.snapshot.statBridge.combatants.find(
      (candidate) => candidate.combatantId === combatantId,
    ) ?? null
  const statuses =
    battle.snapshot.statusState.find((candidate) => candidate.combatantId === combatantId)
      ?.statuses ?? []
  const participant = metadata?.participants.find(
    (candidate) => candidate.combatantId === combatantId,
  )
  const isPlayer = Boolean(playerName && combatantId.startsWith('character:'))

  return {
    combatant,
    placement,
    profile,
    statuses,
    name: participant?.characterName ?? displayNameForCombatant(combatantId, playerName),
    teamLabel: participant
      ? `Team ${participant.teamIndex + 1}`
      : isPlayer
        ? 'Character'
        : 'Opponent',
    level: participant?.characterLevel ?? null,
    imageUrl: participant?.profileImageUrl ?? (isPlayer ? playerProfileImageUrl : null),
    fallbackAssetId: participant
      ? getStarterPortraitImageAssetId(participant.portraitRef as CharacterPortraitRef)
      : isPlayer
        ? playerPortraitAssetId
        : null,
    active: battle.snapshot.tactical.battle.currentTurn?.combatantId === combatantId,
  }
}

export function DesktopBattleCombatantInspect({
  battleSessionId,
  playerName = null,
  playerPortraitAssetId = null,
  playerProfileImageUrl = null,
  pvpMetadata = null,
  battleView = null,
}: {
  battleSessionId: string
  playerName?: string | null
  playerPortraitAssetId?: ImageAssetId | null
  playerProfileImageUrl?: string | null
  pvpMetadata?: InspectMetadata | null
  battleView?: BattleSessionView | null
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedCombatant | null>(null)

  useEffect(() => {
    let requestSequence = 0

    async function openCombatant(target: OpenTarget) {
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
        const combatantId = resolveCombatantId(currentBattle, target, pvpMetadata, playerName)
        if (!combatantId) throw new Error('That combatant is no longer available.')
        const next = readSelectedCombatant(
          currentBattle,
          combatantId,
          pvpMetadata,
          playerName,
          playerPortraitAssetId,
          playerProfileImageUrl,
        )
        if (!next) throw new Error('That combatant is no longer available.')
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

    function handleClick(event: MouseEvent) {
      if (!window.matchMedia(DESKTOP_QUERY).matches || !inspectModeActive()) return
      const target = event.target instanceof Element ? event.target : null
      if (!target) return

      const railCombatant = target.closest<HTMLElement>('[data-desktop-inspect-combatant]')
      const railName = target.closest<HTMLElement>('[data-desktop-inspect-name]')
      const tile = target.closest<HTMLButtonElement>(
        '#battlefield button[aria-label^="Tile "][aria-label*="occupied by"]',
      )

      let openTarget: OpenTarget | null = null
      const combatantId = railCombatant?.dataset.desktopInspectCombatant
      const name = railName?.dataset.desktopInspectName
      if (combatantId) {
        openTarget = { kind: 'combatant', combatantId }
      } else if (name) {
        openTarget = { kind: 'name', name }
      } else if (tile) {
        const position = parseTilePosition(tile.getAttribute('aria-label') ?? '')
        if (position) openTarget = { kind: 'position', position }
      }

      if (!openTarget) return
      event.preventDefault()
      event.stopImmediatePropagation()
      void openCombatant(openTarget)
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('click', handleClick, true)
    window.addEventListener('keydown', handleEscape)
    return () => {
      requestSequence += 1
      document.removeEventListener('click', handleClick, true)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [
    battleSessionId,
    battleView,
    playerName,
    playerPortraitAssetId,
    playerProfileImageUrl,
    pvpMetadata,
  ])

  const spectatorPopup =
    battleView && pvpMetadata ? (
      <PvpBattleInspectPopup
        battleSessionId={battleSessionId}
        metadata={pvpMetadata}
        battleView={battleView}
      />
    ) : null

  if (!open) return spectatorPopup

  const healthPercent = selected ? meterPercent(selected.combatant.hp, selected.combatant.maxHp) : 0
  const manaPercent = selected ? meterPercent(selected.combatant.mp, selected.combatant.maxMp) : 0
  const effectSummary = selected ? summarizeEffects(selected.statuses) : []

  const desktopPopup = (
    <div
      className={styles.backdrop}
      data-desktop-battle-inspect="true"
      onPointerDown={() => setOpen(false)}
    >
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
            <button
              type="button"
              className={styles.close}
              aria-label="Close combatant details"
              onClick={() => setOpen(false)}
            >
              ×
            </button>

            <div className={styles.identityRow}>
              <div className={styles.portrait}>
                {selected.fallbackAssetId ? (
                  <CharacterPortraitImage
                    imageUrl={selected.imageUrl}
                    fallbackAssetId={selected.fallbackAssetId}
                    className={styles.portraitImage}
                    sizes="9rem"
                    alt={`${selected.name} portrait`}
                  />
                ) : (
                  <span className={styles.fallbackPortrait} aria-hidden="true">
                    {selected.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className={styles.identityCopy}>
                <span>{selected.teamLabel}</span>
                <h2>{selected.name}</h2>
                <p>
                  {selected.level
                    ? `Level ${selected.level}${selected.active ? ' · Active turn' : ''}`
                    : selected.active
                      ? 'Active turn'
                      : ''}
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
                <dd>{percentFromBasisPoints(selected.profile?.accuracy)}</dd>
              </div>
              <div>
                <dt>Evasion</dt>
                <dd>{percentFromBasisPoints(selected.profile?.evasion)}</dd>
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

            <section className={styles.effects} aria-label={`${selected.name} buffs and debuffs`}>
              <div className={styles.effectsHeading}>
                <span>Active effects</span>
                <div className={styles.effectsSummary} aria-label="Current effect summary">
                  {effectSummary.map((item) => (
                    <span
                      className={styles.effectSummaryChip}
                      data-tone={item.tone}
                      key={`${item.label}:${item.value}`}
                      title={`${item.label} ${item.value}`}
                    >
                      <b>{item.label}</b>
                      <strong>{item.value}</strong>
                    </span>
                  ))}
                  <small title="Active status count">{selected.statuses.length}</small>
                </div>
              </div>
              {selected.statuses.length === 0 ? (
                <p>No buffs or debuffs are active.</p>
              ) : (
                <div className={styles.effectIcons}>
                  {selected.statuses.map((status) => {
                    const label = statusLabel(status.statusId)
                    const beneficial = statusIsBeneficial(status.statusId)
                    return (
                      <button
                        type="button"
                        key={`${status.statusId}:${status.sourceCombatantId}`}
                        className={beneficial ? styles.buff : styles.debuff}
                        title={`${label}${status.stacks > 1 ? ` ×${status.stacks}` : ''}`}
                        aria-label={`${beneficial ? 'Buff' : 'Debuff'}: ${label}, ${status.stacks} stack${status.stacks === 1 ? '' : 's'}, ${status.remainingOwnerTurnStarts} turn${status.remainingOwnerTurnStarts === 1 ? '' : 's'} remaining`}
                      >
                        {beneficial ? '+' : '!'}
                        {status.stacks > 1 ? status.stacks : null}
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            <p className={styles.hint}>
              Click an effect icon for its explanation. Click outside this window to close Inspect.
            </p>
          </>
        ) : null}
      </section>
    </div>
  )

  return spectatorPopup ? (
    <>
      {spectatorPopup}
      {desktopPopup}
    </>
  ) : (
    desktopPopup
  )
}
