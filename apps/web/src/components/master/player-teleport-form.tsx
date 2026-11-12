'use client'
import { useState } from 'react'
import type { PlayerTeleportDestination } from '@/master/players'

export function PlayerTeleportForm({
  disabled,
  onReview,
}: {
  disabled: boolean
  onReview(destination: PlayerTeleportDestination, reason: string): void
}) {
  const [map, setMap] = useState<PlayerTeleportDestination['map']>('mainland')
  const [sector, setSector] = useState('1')
  const [x, setX] = useState('6')
  const [y, setY] = useState('4')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const maximum = map === 'mainland' ? 8192 : 768
  function review() {
    const sectorNumber = Number(sector),
      nextX = Number(x),
      nextY = Number(y)
    if (
      !sector ||
      !x ||
      !y ||
      !Number.isInteger(sectorNumber) ||
      sectorNumber < 1 ||
      sectorNumber > maximum ||
      !Number.isInteger(nextX) ||
      nextX < 0 ||
      nextX > 12 ||
      !Number.isInteger(nextY) ||
      nextY < 0 ||
      nextY > 8
    ) {
      setError('Enter a valid sector number and whole coordinates: X 0–12, Y 0–8.')
      return
    }
    if (reason.trim().length < 3 || reason.trim().length > 240) {
      setError('Enter a staff reason between 3 and 240 characters.')
      return
    }
    setError(null)
    onReview({ map, sectorNumber, x: nextX, y: nextY }, reason.trim())
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
            setMap(event.target.value as PlayerTeleportDestination['map'])
            setError(null)
          }}
        >
          <option value="mainland">Mainland</option>
          <option value="currentVoid">Current Void</option>
        </select>
      </label>
      <p>
        {map === 'mainland'
          ? 'Sector numbers run across each row of the 128 × 64 mainland grid.'
          : 'Sector numbers run across each row of the 32 × 24 Void grid. The active map is selected when you save.'}
      </p>
      <label>
        Sector number
        <input
          type="number"
          min={1}
          max={maximum}
          step={1}
          value={sector}
          onChange={(event) => setSector(event.target.value)}
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
          onChange={(event) => setX(event.target.value)}
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
          onChange={(event) => setY(event.target.value)}
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
      <button type="button" onClick={review}>
        Review teleport
      </button>
    </fieldset>
  )
}
