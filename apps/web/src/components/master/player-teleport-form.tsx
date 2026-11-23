'use client'
import { useEffect, useState } from 'react'
import { MASTER_TELEPORT_GEOMETRY_VERSION, type PlayerTeleportDestination } from '@/master/players'

import {
  mainlandSectorAtNumber,
  mainlandSectorCount,
  MAX_VOID_SECTOR_NUMBER,
  readSectorNumber,
  VOID_SECTOR_NUMBER_OFFSET,
} from '@/world/sector-index'
import { isWalkable, validCell } from '@/world/travel'
import styles from './players-workspace.module.css'

export function PlayerTeleportForm({
  disabled,
  onReview,
  validateVoid,
}: {
  disabled: boolean
  validateVoid?: (destination: PlayerTeleportDestination, signal: AbortSignal) => Promise<boolean>
  onReview(destination: PlayerTeleportDestination, reason: string): void
}) {
  const [map, setMap] = useState<PlayerTeleportDestination['map']>('mainland')
  const [sector, setSector] = useState('1')
  const [x, setX] = useState('6')
  const [y, setY] = useState('4')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [voidStatus, setVoidStatus] = useState<{ key: string; valid: boolean }>()
  const minimum = map === 'mainland' ? 1 : VOID_SECTOR_NUMBER_OFFSET + 1
  const maximum = map === 'mainland' ? mainlandSectorCount() : MAX_VOID_SECTOR_NUMBER
  const sectorNumber = readSectorNumber(sector)
  const nextX = x === '' ? NaN : Number(x)
  const nextY = y === '' ? NaN : Number(y)
  const coordinates = validCell({ x: nextX, y: nextY })
  const geometryVersion = MASTER_TELEPORT_GEOMETRY_VERSION
  const voidKey =
    map === 'currentVoid' &&
    sectorNumber !== null &&
    sectorNumber >= minimum &&
    sectorNumber <= maximum &&
    coordinates
      ? `${sectorNumber}:${nextX}:${nextY}`
      : ''
  useEffect(() => {
    if (!voidKey || !validateVoid || disabled) return
    const request = new AbortController()
    const timer = setTimeout(() => {
      void validateVoid(
        { map: 'currentVoid', sectorNumber: sectorNumber!, x: nextX, y: nextY, geometryVersion },
        request.signal,
      ).then(
        (valid) => {
          if (!request.signal.aborted) setVoidStatus({ key: voidKey, valid })
        },
        () => {
          if (!request.signal.aborted) setVoidStatus({ key: voidKey, valid: false })
        },
      )
    }, 150)
    return () => {
      clearTimeout(timer)
      request.abort()
    }
  }, [voidKey, sectorNumber, nextX, nextY, validateVoid, geometryVersion, disabled])
  const mainland =
    map === 'mainland' && sectorNumber !== null ? mainlandSectorAtNumber(sectorNumber) : undefined
  const valid =
    !disabled &&
    coordinates &&
    (map === 'mainland'
      ? !!mainland && isWalkable(mainland, { x: nextX, y: nextY })
      : !!voidKey && voidStatus?.key === voidKey && voidStatus.valid)
  const pending = !!voidKey && !!validateVoid && !disabled && voidStatus?.key !== voidKey
  function review() {
    if (!valid || sectorNumber === null) {
      setError('Choose a walkable land cell with whole coordinates X 0–12 and Y 0–8.')
      return
    }
    if (reason.trim().length < 3 || reason.trim().length > 240) {
      setError('Enter a staff reason between 3 and 240 characters.')
      return
    }
    setError(null)
    onReview(
      { map, sectorNumber, x: nextX, y: nextY, geometryVersion: MASTER_TELEPORT_GEOMETRY_VERSION },
      reason.trim(),
    )
  }
  return (
    <fieldset disabled={disabled}>
      <legend>Teleport Player</legend>
      <p>
        Move this character to a walkable cell. End an active encounter first and wait for any ferry
        journey to finish.
      </p>
      <label>
        Destination map
        <select
          value={map}
          onChange={(event) => {
            const next = event.target.value as PlayerTeleportDestination['map']
            setMap(next)
            setSector(next === 'mainland' ? '1' : String(VOID_SECTOR_NUMBER_OFFSET + 1))
            setVoidStatus(undefined)
            setError(null)
          }}
        >
          <option value="mainland">Mainland</option>
          <option value="currentVoid">Current Void</option>
        </select>
      </label>
      <p>
        {map === 'mainland'
          ? 'Mainland sectors are numbered from the heartland outward.'
          : 'Void sector numbers begin at 8193. Availability follows the active Void map.'}
      </p>
      <label>
        Sector number
        <input
          type="number"
          className={styles.teleportSector}
          data-sector-valid={sector ? valid : undefined}
          aria-busy={pending || undefined}
          aria-invalid={!!sector && !pending && !valid}
          title={
            pending
              ? 'Checking destination'
              : valid
                ? 'Walkable destination'
                : 'Unavailable destination'
          }
          min={minimum}
          max={maximum}
          step={1}
          value={sector}
          onChange={(event) => {
            setSector(event.target.value)
            setVoidStatus(undefined)
          }}
        />
      </label>
      <label>
        X coordinate
        <input
          type="number"
          min={0}
          max={12}
          step={1}
          value={x}
          onChange={(event) => {
            setX(event.target.value)
            setVoidStatus(undefined)
          }}
        />
      </label>
      <label>
        Y coordinate
        <input
          type="number"
          min={0}
          max={8}
          step={1}
          value={y}
          onChange={(event) => {
            setY(event.target.value)
            setVoidStatus(undefined)
          }}
        />
      </label>
      <label>
        Staff reason
        <input
          type="text"
          required
          minLength={3}
          maxLength={240}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" disabled={!valid} onClick={review}>
        Review teleport
      </button>
    </fieldset>
  )
}
