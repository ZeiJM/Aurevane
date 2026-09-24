'use client'
import Image from 'next/image'
import { useMemo } from 'react'
import { cellCenter } from '@/world/travel'
import type {
  TravelStep,
  WorldCell,
  WorldPlayer,
  WorldPosition,
  WorldSectorView,
} from '@/world/types'
import styles from './world.module.css'

export function SectorMap({
  sector,
  position,
  route,
  players,
  portrait,
  name,
  grid,
  motion,
  onMove,
  onPlayer,
  disabled,
}: {
  sector: WorldSectorView
  position: WorldPosition
  route: TravelStep[]
  players: WorldPlayer[]
  portrait: string
  name: string
  grid: boolean
  motion: boolean
  onMove: (p: WorldPosition) => void
  onPlayer: (id: string) => void
  disabled: boolean
}) {
  const local = position.sectorId === sector.id
  const cellsByIndex = useMemo(() => {
    const indexed = new Array<WorldCell | undefined>(13 * 9)
    for (const cell of sector.cells) indexed[cell.y * 13 + cell.x] = cell
    return indexed
  }, [sector.cells])
  const path = [...(local ? [position] : []), ...route.map((s) => s.position)].filter(
    (p) => p.sectorId === sector.id,
  )
  return (
    <div className={styles.sectorFrame}>
      <div className={styles.northings}>
        {Array.from({ length: 9 }, (_, y) => (
          <span key={y}>N{sector.north - y}</span>
        ))}
      </div>
      <div
        className={styles.sectorMap}
        data-grid={grid}
        data-motion={motion}
        data-frontier={!sector.charted}
        data-sector={sector.id}
        data-region={sector.regionId}
        style={sector.art ? { backgroundImage: `url(${sector.art})` } : undefined}
      >
        {sector.charted && motion ? (
          <div className={styles.ambient} aria-hidden="true" data-world-ambient>
            <span className={styles.riverFlow} data-world-flow />
            {sector.id === 'hollow-coast' ? (
              <span className={styles.shoreFlow} data-world-shore />
            ) : null}
            <span className={styles.windVeil} data-world-wind />
            <span className={styles.lightBloom} data-world-light />
            {sector.landmarks.some((landmark) => landmark.kind === 'settlement') ? (
              <span className={styles.smoke} data-world-smoke />
            ) : null}
            <span className={styles.cloudShadow} data-world-clouds />
            <span className={styles.fireflies} data-world-fireflies />
          </div>
        ) : null}
        <div
          className={styles.cells}
          role="group"
          aria-label={`${sector.name}, square movement grid`}
        >
          {Array.from({ length: 117 }, (_, index) => {
            const x = index % 13,
              y = Math.floor(index / 13),
              cell = cellsByIndex[index]
            return (
              <button
                key={index}
                type="button"
                className={styles.cell}
                data-known={Boolean(cell)}
                data-terrain={cell?.terrain}
                disabled={disabled || !cell?.walkable}
                aria-label={`E${sector.east + x} N${sector.north - y}${!cell ? ', uncharted' : !cell.walkable ? ', blocked' : cell.safe ? ', safe settlement' : ', open territory'}`}
                title={!cell ? 'Uncharted territory' : `E${sector.east + x} / N${sector.north - y}`}
                onClick={() => onMove({ sectorId: sector.id, x, y })}
              />
            )
          })}
        </div>
        <svg className={styles.route} viewBox="0 0 1300 900" aria-hidden="true">
          <polyline
            points={path.map((p) => `${(p.x + 0.5) * 100},${(p.y + 0.5) * 100}`).join(' ')}
          />
          {path.slice(1).map((p, i) => (
            <circle key={i} cx={(p.x + 0.5) * 100} cy={(p.y + 0.5) * 100} r="6" />
          ))}
        </svg>
        {sector.landmarks.map((landmark) => {
          const center = cellCenter(landmark)
          return (
            <span
              key={landmark.id}
              className={styles.landmark}
              title={landmark.name}
              style={{ left: `${center.x * 100}%`, top: `${center.y * 100}%` }}
            >
              {landmark.kind === 'frontier'
                ? '◇'
                : landmark.kind === 'anchor'
                  ? '✦'
                  : landmark.kind === 'watchtower'
                    ? '⚑'
                    : ''}
            </span>
          )
        })}
        {local ? <MapToken position={position} name={name} portrait={portrait} /> : null}
        {players
          .filter((p) => p.position.sectorId === sector.id)
          .map((player) => (
            <MapToken
              key={player.characterId}
              position={player.position}
              name={player.name}
              portrait={player.imageUrl!}
              enemy
              onClick={() => onPlayer(player.characterId)}
            />
          ))}
      </div>
      <div className={styles.eastings}>
        {Array.from({ length: 13 }, (_, x) => (
          <span key={x}>E{sector.east + x}</span>
        ))}
      </div>
    </div>
  )
}
function MapToken({
  position,
  name,
  portrait,
  enemy = false,
  onClick,
}: {
  position: WorldPosition
  name: string
  portrait: string
  enemy?: boolean
  onClick?: () => void
}) {
  const center = cellCenter(position)
  return (
    <button
      className={styles.playerToken}
      data-enemy={enemy}
      style={{ left: `${center.x * 100}%`, top: `${center.y * 100}%` }}
      onClick={onClick}
      aria-label={enemy ? `Inspect ${name}` : `${name}, your position`}
    >
      <Image
        unoptimized
        referrerPolicy="no-referrer"
        src={portrait}
        alt=""
        width={48}
        height={48}
      />
      <span>{name}</span>
    </button>
  )
}
