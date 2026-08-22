'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { PvpBattleMetadata, PvpBattleParticipantView } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import styles from './pvp-desktop-parity.module.css'

const ACTION_ECONOMY_KEY = 'pv1f.action-economy'

type BattleSnapshot = BattleSessionView['snapshot']
type Combatant = BattleSnapshot['tactical']['battle']['combatants'][number]
type Placement = BattleSnapshot['tactical']['placements'][number]
type Profile = BattleSnapshot['statBridge']['combatants'][number]
type CombatStatus = BattleSnapshot['statusState'][number]['statuses'][number]

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

function activeEconomy(combatant: Combatant | null): number | null {
  if (!combatant) return null
  return (
    combatant.temporaryResources.find((resource) => resource.key === ACTION_ECONOMY_KEY)?.current ??
    null
  )
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
  const [economyTarget, setEconomyTarget] = useState<HTMLElement | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const fetchInFlight = useRef(false)

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
  const activeParticipant = useMemo(() => {
    const activeId = battle.snapshot.tactical.battle.currentTurn?.combatantId
    return metadata.participants.find((participant) => participant.combatantId === activeId) ?? null
  }, [battle.snapshot.tactical.battle.currentTurn?.combatantId, metadata.participants])

  const refreshBattle = useCallback(async () => {
    if (fetchInFlight.current) return
    fetchInFlight.current = true
    try {
      const response = await fetch(`/api/battles/${initialBattle.battleSessionId}`, {
        method: 'GET',
        cache: 'no-store',
      })
      const body = (await response.json()) as { battle?: BattleSessionView }
      if (!response.ok || !body.battle) return
      setBattle((current) =>
        body.battle && body.battle.battleVersion !== current.battleVersion ? body.battle : current,
      )
    } catch {
      // The primary PvP state loop remains authoritative. A later visible mutation repairs the rail.
    } finally {
      fetchInFlight.current = false
    }
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
        if (notice instanceof HTMLElement && notice !== battlefield)
          notice.dataset.pvpNotice = 'true'
      }

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
      setEconomyTarget((current) => (current === economy ? current : economy))
    }

    const schedule = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(locate)
    }

    locate()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [metadata.battleKey])

  useEffect(() => {
    let timer: number | null = null
    const root = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
    if (!root) return
    const roster = root.querySelector<HTMLElement>('section[aria-label="PvP battle roster"]')
    const header = root.querySelector<HTMLElement>('header')

    const scheduleRefresh = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => void refreshBattle(), 70)
    }

    const observer = new MutationObserver(scheduleRefresh)
    if (roster) {
      observer.observe(roster, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['style', 'data-active', 'data-defeated'],
      })
    }
    if (header) {
      observer.observe(header, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['data-active'],
      })
    }

    const focus = () => void refreshBattle()
    window.addEventListener('focus', focus)
    scheduleRefresh()

    return () => {
      observer.disconnect()
      window.removeEventListener('focus', focus)
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [refreshBattle])

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

      {economyTarget
        ? createPortal(
            <div className={styles.acting} role="status" aria-live="polite">
              <span>Turn control</span>
              <strong>
                {battle.snapshot.tactical.battle.lifecycle === 'active'
                  ? `${activeParticipant?.characterName ?? 'Combatant'} acting…`
                  : 'Battle complete'}
              </strong>
            </div>,
            economyTarget,
          )
        : null}
    </>
  )
}
