'use client'
import Image from 'next/image'
import { useMemo, useSyncExternalStore } from 'react'
import { resolvePublicCharacterImageUrl } from '@/media/public-character-portrait'
import type { WorldLandmark, WorldPlayer, WorldPosition } from '@/world/types'
import styles from './world.module.css'

export type DockTab = 'nearby' | 'poi'
export const DOCK_TAB_STORAGE_KEY = 'aurevane.dockTab'
const dockTabListeners = new Set<() => void>()
function subscribeDockTab(listener: () => void) {
  dockTabListeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    dockTabListeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}
function readDockTab(): DockTab {
  try {
    return window.localStorage.getItem(DOCK_TAB_STORAGE_KEY) === 'poi' ? 'poi' : 'nearby'
  } catch {
    return 'nearby'
  }
}

/** Higher level first; ties alphabetical. The server already limits who is listed. */
export function sortNearbyPlayers(players: readonly WorldPlayer[]): WorldPlayer[] {
  return [...players].sort(
    (a, b) =>
      Number(b.online === true) - Number(a.online === true) ||
      b.level - a.level ||
      a.name.localeCompare(b.name),
  )
}
export function sortPointsOfInterest<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name))
}

const KIND_GLYPH: Record<WorldLandmark['kind'], string> = {
  settlement: '⌂',
  watchtower: '⚑',
  frontier: '◇',
  anchor: '✦',
}

export function WorldDock({
  players,
  landmarks,
  safe,
  selectedPlayerId,
  disabled,
  onSelectPlayer,
  onApproach,
  onAttack,
  onLandmark,
}: {
  players: readonly WorldPlayer[]
  landmarks: readonly WorldLandmark[]
  safe: boolean
  selectedPlayerId: string | null
  disabled: boolean
  onSelectPlayer: (id: string) => void
  onApproach: (position: WorldPosition) => void
  onAttack: (id: string) => void
  onLandmark: (landmark: WorldLandmark) => void
}) {
  const tab = useSyncExternalStore(subscribeDockTab, readDockTab, () => 'nearby' as DockTab)
  function choose(next: DockTab) {
    try {
      window.localStorage.setItem(DOCK_TAB_STORAGE_KEY, next)
    } catch {}
    dockTabListeners.forEach((listener) => listener())
  }
  const nearby = useMemo(() => sortNearbyPlayers(players), [players])
  const pois = useMemo(() => sortPointsOfInterest(landmarks), [landmarks])
  return (
    <section
      className={styles.dock}
      data-world-dock
      data-tab={tab}
      aria-label="Nearby and points of interest"
    >
      <div className={styles.dockTabs} role="tablist">
        <button
          type="button"
          role="tab"
          id="world-tab-nearby"
          aria-selected={tab === 'nearby'}
          aria-controls="world-dock-nearby"
          onClick={() => choose('nearby')}
        >
          <span className={styles.dockTabName}>Nearby</span>
          <span className={styles.zoneBadge} data-zone={safe ? 'safe' : 'pvp'}>
            {safe ? 'Safe zone' : 'PvP zone'}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          id="world-tab-poi"
          aria-selected={tab === 'poi'}
          aria-controls="world-dock-poi"
          onClick={() => choose('poi')}
        >
          <span className={styles.dockTabName}>Points of interest</span>
        </button>
      </div>
      <div className={styles.dockBody}>
        {tab === 'nearby' ? (
          <div
            id="world-dock-nearby"
            role="tabpanel"
            aria-labelledby="world-tab-nearby"
            className={styles.nearbyList}
          >
            {nearby.length ? (
              nearby.map((p) => {
                const src = resolvePublicCharacterImageUrl(p.imageUrl, p.portraitRef)
                return (
                  <article
                    key={p.characterId}
                    className={styles.nearbyCard}
                    data-selected={selectedPlayerId === p.characterId}
                    data-online={p.online === true}
                  >
                    <button
                      type="button"
                      className={styles.nearbyPortrait}
                      aria-label={`Select ${p.name}`}
                      onClick={() => onSelectPlayer(p.characterId)}
                    >
                      {src ? (
                        <Image
                          unoptimized
                          referrerPolicy="no-referrer"
                          src={src}
                          alt=""
                          width={44}
                          height={44}
                        />
                      ) : null}
                    </button>
                    <div className={styles.nearbyText}>
                      <strong title={p.name}>{p.name}</strong>
                      <small>
                        Player · Lv {p.level}
                        {p.online === false ? ' · Away' : ''}
                      </small>
                    </div>
                    <div className={styles.nearbyActions}>
                      <button
                        type="button"
                        className={styles.attack}
                        aria-label={`Attack ${p.name}`}
                        disabled={disabled || !p.attackable}
                        onClick={() => onAttack(p.characterId)}
                      >
                        Attack
                      </button>
                      <button
                        type="button"
                        disabled
                        aria-label={`Talk to ${p.name} (coming soon)`}
                        title="Talking is coming soon"
                      >
                        Talk
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        aria-label={`Approach ${p.name}`}
                        onClick={() => onApproach(p.position)}
                      >
                        Approach
                      </button>
                    </div>
                  </article>
                )
              })
            ) : (
              <p className={styles.dockEmpty}>
                A quiet stretch of road. Other characters appear here when they are in your area.
              </p>
            )}
          </div>
        ) : (
          <div
            id="world-dock-poi"
            role="tabpanel"
            aria-labelledby="world-tab-poi"
            className={styles.poiList}
          >
            {pois.length ? (
              pois.map((landmark) => (
                <button
                  key={landmark.id}
                  type="button"
                  className={styles.poiItem}
                  onClick={() => onLandmark(landmark)}
                >
                  <span className={styles.poiDot} aria-hidden="true">
                    {KIND_GLYPH[landmark.kind]}
                  </span>
                  <span className={styles.poiName}>{landmark.name}</span>
                </button>
              ))
            ) : (
              <p className={styles.dockEmpty}>No known points of interest here yet.</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
