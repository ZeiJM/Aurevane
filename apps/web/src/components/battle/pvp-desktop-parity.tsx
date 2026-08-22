'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { PvpBattleMetadata, PvpBattleParticipantView } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import styles from './pvp-desktop-parity.module.css'

type BattleSnapshot = BattleSessionView['snapshot']
type Combatant = BattleSnapshot['tactical']['battle']['combatants'][number]
type Placement = BattleSnapshot['tactical']['placements'][number]
type Profile = BattleSnapshot['statBridge']['combatants'][number]
type CombatStatus = BattleSnapshot['statusState'][number]['statuses'][number]

const ACTION_ECONOMY_KEY = 'pv1f.action-economy'

function activeEconomy(combatant: Combatant | null): number | null {
  if (!combatant) return null
  return (
    combatant.temporaryResources.find((resource) => resource.key === ACTION_ECONOMY_KEY)?.current ??
    null
  )
}

function meterPercent(value: number, maximum: number): number {
  if (maximum <= 0) return 0
  return Math.max(0, Math.min(100, (value / maximum) * 100))
}

function percentFromBasisPoints(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
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

function participantState(
  battle: BattleSessionView,
  participant: PvpBattleParticipantView,
): {
  combatant: Combatant | null
  placement: Placement | null
  profile: Profile | null
  statuses: readonly CombatStatus[]
  active: boolean
} {
  const combatant =
    battle.snapshot.tactical.battle.combatants.find(
      (candidate) => candidate.id === participant.combatantId,
    ) ?? null
  const placement =
    battle.snapshot.tactical.placements.find(
      (candidate) => candidate.combatantId === participant.combatantId,
    ) ?? null
  const profile =
    battle.snapshot.statBridge.combatants.find(
      (candidate) => candidate.combatantId === participant.combatantId,
    ) ?? null
  const statuses =
    battle.snapshot.statusState.find(
      (candidate) => candidate.combatantId === participant.combatantId,
    )?.statuses ?? []

  return {
    combatant,
    placement,
    profile,
    statuses,
    active: battle.snapshot.tactical.battle.currentTurn?.combatantId === participant.combatantId,
  }
}

function decorateTerrainTiles(root: HTMLElement): void {
  for (const tile of root.querySelectorAll<HTMLButtonElement>('button[aria-label^="Tile "]')) {
    const label = tile.getAttribute('aria-label') ?? ''
    const match = label.match(/^Tile (\d+), (\d+); ([^;]+); elevation (\d+)/)
    if (!match) continue
    const [, x, y, terrain, elevationText] = match
    const elevation = Number(elevationText)
    const meta = tile.firstElementChild
    if (!(meta instanceof HTMLElement)) continue

    const rough = terrain.includes('rough')
    const expected = `${x}.${y}${rough ? 'R50' : ''}${elevation > 0 ? `▲${elevation}` : ''}`
    if ((meta.textContent ?? '').replaceAll(/\s+/g, '') !== expected) {
      meta.replaceChildren(document.createTextNode(`${x}.${y}`))
      if (rough) {
        const roughness = document.createElement('b')
        roughness.textContent = 'R50'
        meta.appendChild(roughness)
      }
      if (elevation > 0) {
        const raised = document.createElement('b')
        raised.textContent = `▲${elevation}`
        meta.appendChild(raised)
      }
    }

    for (const child of Array.from(tile.children)) {
      if (child !== meta && child instanceof HTMLElement && child.textContent?.trim() === '▲') {
        child.style.display = 'none'
      }
    }
  }
}

function BattleRailCard({
  battle,
  participant,
  local,
  detailsOpen,
  onToggleDetails,
}: {
  battle: BattleSessionView
  participant: PvpBattleParticipantView
  local: boolean
  detailsOpen: boolean
  onToggleDetails: () => void
}) {
  const state = participantState(battle, participant)
  const { combatant, placement, profile, statuses, active } = state
  if (!combatant || !placement) return null

  return (
    <article
      className={styles.railCard}
      data-active={active ? 'true' : undefined}
      data-defeated={combatant.hp <= 0 ? 'true' : undefined}
    >
      <div className={styles.railHeading}>
        <div>
          <span>{local ? 'Character' : `Opponent · Team ${participant.teamIndex + 1}`}</span>
          <strong>{participant.characterName}</strong>
        </div>
        {active ? <b>Active</b> : null}
      </div>

      <button
        type="button"
        className={styles.portraitButton}
        onClick={onToggleDetails}
        aria-expanded={detailsOpen}
        aria-label={`Show ${participant.characterName} combat details`}
      >
        <CharacterPortraitImage
          imageUrl={participant.profileImageUrl}
          fallbackAssetId={getStarterPortraitImageAssetId(
            participant.portraitRef as CharacterPortraitRef,
          )}
          className={styles.portraitImage}
          sizes="12rem"
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

      <div
        className={styles.statuses}
        aria-label={`${participant.characterName} buffs and debuffs`}
      >
        {statuses.length === 0 ? (
          <span className={styles.noStatus}>No effects</span>
        ) : (
          statuses.map((status) => {
            const label = statusLabel(status.statusId)
            const beneficial = statusIsBeneficial(status.statusId)
            return (
              <button
                type="button"
                key={`${status.statusId}:${status.sourceCombatantId}`}
                className={beneficial ? styles.buff : styles.debuff}
                title={label}
                aria-label={`${label}, ${status.remainingOwnerTurnStarts} turn${status.remainingOwnerTurnStarts === 1 ? '' : 's'} remaining`}
              >
                {beneficial ? '+' : '!'}
              </button>
            )
          })
        )}
      </div>

      <div
        className={styles.facing}
        aria-label={`${participant.characterName} facing ${placement.facing}`}
      >
        <span>{facingGlyph(placement.facing)}</span>
        <strong>{placement.facing}</strong>
      </div>

      {detailsOpen ? (
        <div
          className={styles.details}
          role="dialog"
          aria-label={`${participant.characterName} combat details`}
        >
          <button
            type="button"
            className={styles.detailsClose}
            onClick={onToggleDetails}
            aria-label="Close combat details"
          >
            ×
          </button>
          <strong>{participant.characterName} · combat details</strong>
          <dl>
            <div>
              <dt>Level</dt>
              <dd>{participant.characterLevel}</dd>
            </div>
            <div>
              <dt>HP</dt>
              <dd>
                {combatant.hp}/{combatant.maxHp}
              </dd>
            </div>
            <div>
              <dt>MP</dt>
              <dd>
                {combatant.mp}/{combatant.maxMp}
              </dd>
            </div>
            <div>
              <dt>AP</dt>
              <dd>{activeEconomy(combatant) ?? '—'}</dd>
            </div>
            <div>
              <dt>Initiative</dt>
              <dd>{combatant.initiative}</dd>
            </div>
            <div>
              <dt>Movement</dt>
              <dd>{combatant.baseMovementBudget}</dd>
            </div>
            <div>
              <dt>Jump</dt>
              <dd>{profile?.jump ?? '—'}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>{percentFromBasisPoints(profile?.accuracy)}</dd>
            </div>
            <div>
              <dt>Evasion</dt>
              <dd>{percentFromBasisPoints(profile?.evasion)}</dd>
            </div>
            <div>
              <dt>Armor</dt>
              <dd>{profile?.armor ?? '—'}</dd>
            </div>
            <div>
              <dt>Ward</dt>
              <dd>{profile?.ward ?? '—'}</dd>
            </div>
          </dl>
          <p>
            Facing {placement.facing} {facingGlyph(placement.facing)}. Effects shown on the rail are
            authoritative battle statuses; click an effect icon for its plain-language explanation.
          </p>
        </div>
      ) : null}
    </article>
  )
}

export function PvpDesktopParity({
  initialBattle,
  metadata,
}: {
  initialBattle: BattleSessionView
  metadata: PvpBattleMetadata
}) {
  const [battle, setBattle] = useState(initialBattle)
  const [contentTarget, setContentTarget] = useState<HTMLElement | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)

  const localParticipant = useMemo(
    () =>
      metadata.participants.find(
        (participant) => participant.characterId === metadata.localCharacterId,
      ) ?? null,
    [metadata.localCharacterId, metadata.participants],
  )
  const opponents = useMemo(
    () =>
      localParticipant
        ? metadata.participants.filter(
            (participant) => participant.teamIndex !== localParticipant.teamIndex,
          )
        : [],
    [localParticipant, metadata.participants],
  )

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
    let frame: number | null = null

    const locate = () => {
      frame = null
      const root = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
      if (!root) return
      root.dataset.pvpDesktopParity = 'true'

      const battlefield = root.querySelector<HTMLElement>(
        'section[aria-label="PvP tactical battlefield"]',
      )
      const content =
        battlefield?.parentElement instanceof HTMLElement ? battlefield.parentElement : null
      if (content) {
        content.dataset.pvpDesktopContent = 'true'
        const notice = content.firstElementChild
        if (notice instanceof HTMLElement && notice !== battlefield) {
          notice.dataset.pvpNotice = 'true'
        }
      }

      if (battlefield) decorateTerrainTiles(battlefield)

      const victoryButton = Array.from(
        root.querySelectorAll<HTMLButtonElement>('header button'),
      ).find((button) => button.textContent?.includes('Victory Conditions'))
      const economy =
        victoryButton?.parentElement instanceof HTMLElement ? victoryButton.parentElement : null
      if (economy) economy.dataset.pvpHeaderEconomy = 'true'

      const objective = root.querySelector<HTMLElement>('header > div:first-child > strong')
      if (objective && objective.textContent !== 'Steel is drawn. The battle is underway.') {
        objective.textContent = 'Steel is drawn. The battle is underway.'
      }

      const facingNorth = root.querySelector<HTMLButtonElement>('button[aria-label="Face north"]')
      const facingPad =
        facingNorth?.parentElement instanceof HTMLElement ? facingNorth.parentElement : null
      if (facingPad) {
        facingPad.dataset.pvpFacingPad = 'true'
        const label = facingPad.querySelector<HTMLElement>(':scope > span')
        if (label) label.textContent = 'Final Facing'
      }

      const footerButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('footer button'))
      const spectatorKey = footerButtons.find((button) =>
        button.textContent?.includes(metadata.battleKey),
      )
      const spectatorLabel = spectatorKey?.querySelector<HTMLElement>('small')
      if (spectatorLabel && !spectatorLabel.textContent?.includes('Copied')) {
        spectatorLabel.textContent = 'Spectator Key · click to copy'
      }

      setContentTarget((current) => (current === content ? current : content))
    }

    const schedule = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(locate)
    }

    locate()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [metadata.battleKey])

  useEffect(() => {
    if (!contentTarget || window.matchMedia('(max-width: 820px)').matches) return
    const battlefield = contentTarget.querySelector<HTMLElement>(
      'section[aria-label="PvP tactical battlefield"]',
    )
    const viewport = battlefield?.firstElementChild
    const board = viewport?.firstElementChild
    if (!(viewport instanceof HTMLElement) || !(board instanceof HTMLElement)) return

    const ratio = initialBattle.snapshot.tactical.width / initialBattle.snapshot.tactical.height
    const fit = () => {
      const availableWidth = Math.max(0, viewport.clientWidth - 16)
      const availableHeight = Math.max(0, viewport.clientHeight - 16)
      const width = Math.floor(Math.min(availableWidth, availableHeight * ratio, 620))
      if (width <= 0) return
      board.style.setProperty('width', `${width}px`, 'important')
      board.style.setProperty('max-width', `${width}px`, 'important')
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(viewport)
    window.addEventListener('resize', fit)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', fit)
      board.style.removeProperty('width')
      board.style.removeProperty('max-width')
    }
  }, [contentTarget, initialBattle.snapshot.tactical.height, initialBattle.snapshot.tactical.width])

  return (
    <>
      <span className={styles.hook} aria-hidden="true" />
      {contentTarget && localParticipant
        ? createPortal(
            <>
              <aside
                className={`${styles.rail} ${styles.railLeft}`}
                aria-label={`${localParticipant.characterName} combat status`}
              >
                <div className={styles.railStack} data-count="1">
                  <BattleRailCard
                    battle={battle}
                    participant={localParticipant}
                    local
                    detailsOpen={detailsId === localParticipant.combatantId}
                    onToggleDetails={() =>
                      setDetailsId((current) =>
                        current === localParticipant.combatantId
                          ? null
                          : localParticipant.combatantId,
                      )
                    }
                  />
                </div>
              </aside>

              <aside
                className={`${styles.rail} ${styles.railRight}`}
                aria-label="Opponent combat status"
              >
                <div className={styles.railStack} data-count={String(opponents.length)}>
                  {opponents.map((participant) => (
                    <BattleRailCard
                      key={participant.combatantId}
                      battle={battle}
                      participant={participant}
                      local={false}
                      detailsOpen={detailsId === participant.combatantId}
                      onToggleDetails={() =>
                        setDetailsId((current) =>
                          current === participant.combatantId ? null : participant.combatantId,
                        )
                      }
                    />
                  ))}
                </div>
              </aside>
            </>,
            contentTarget,
          )
        : null}
    </>
  )
}
