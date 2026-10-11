'use client'
import { useEffect, useState, type FormEvent } from 'react'
import {
  MAX_TIME_OFFSET_MINUTES,
  WORLD_WEATHER,
  resolveWorldEnvironment,
  type WorldEnvironmentSettings,
  type WorldWeather,
} from '@/world/environment'
import styles from './world-environment-editor.module.css'

export interface WorldEnvironmentHistoryEntry {
  id: number
  version: number
  actorUserId: string
  reason: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  changedAtMs: number
}
type DurationKey = '15m' | '1h' | '6h' | 'cleared'
const DURATIONS: { key: DurationKey; label: string }[] = [
  { key: '15m', label: '15 minutes' },
  { key: '1h', label: '1 hour' },
  { key: '6h', label: '6 hours' },
  { key: 'cleared', label: 'Until cleared' },
]

export function formatMinuteOfDay(minute: number): string {
  const m = Math.floor(minute) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function parseClock(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}
export function describeSettingsChange(after: Record<string, unknown>): string {
  const parts = [
    after.frozenMinuteOfDay != null
      ? `clock frozen at ${formatMinuteOfDay(after.frozenMinuteOfDay as number)} UTC`
      : `clock offset ${after.timeOffsetMinutes as number} min`,
    after.weatherOverride
      ? `weather forced to ${after.weatherOverride as string}${
          after.weatherOverrideUntilMs
            ? ` until ${new Date(after.weatherOverrideUntilMs as number).toISOString()}`
            : ' until cleared'
        }`
      : 'live weather',
  ]
  return parts.join('; ')
}

export function WorldEnvironmentEditor({
  initialSettings,
  initialHistory,
  initialNowMs,
}: {
  initialSettings: WorldEnvironmentSettings
  initialHistory: WorldEnvironmentHistoryEntry[]
  initialNowMs?: number
}) {
  const [settings, setSettings] = useState(initialSettings)
  const [history, setHistory] = useState(initialHistory)
  const [now, setNow] = useState<number | null>(initialNowMs ?? null)
  const [offset, setOffset] = useState(String(initialSettings.timeOffsetMinutes))
  const [frozen, setFrozen] = useState(initialSettings.frozenMinuteOfDay !== null)
  const [clock, setClock] = useState(formatMinuteOfDay(initialSettings.frozenMinuteOfDay ?? 720))
  const [weather, setWeather] = useState<WorldWeather | 'live'>('live')
  const [duration, setDuration] = useState<DurationKey>('1h')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0)
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [])
  const current = now === null ? null : resolveWorldEnvironment(now, settings)
  const offsetValue = /^-?\d{1,4}$/.test(offset) ? Number(offset) : NaN
  const frozenMinute = frozen ? parseClock(clock) : null
  const valid =
    Math.abs(offsetValue) <= MAX_TIME_OFFSET_MINUTES && (!frozen || frozenMinute !== null)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || saving || reason.trim().length < 8) return
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/master/world-environment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: settings.version,
          change: {
            timeOffsetMinutes: offsetValue,
            frozenMinuteOfDay: frozenMinute,
            weather: weather === 'live' ? null : weather,
            duration: weather === 'live' ? 'cleared' : duration,
          },
          reason,
        }),
      })
      const body = (await response.json()) as {
        settings?: WorldEnvironmentSettings
        history?: WorldEnvironmentHistoryEntry[]
        error?: { message?: string }
      }
      if (!response.ok || !body.settings)
        throw new Error(body.error?.message ?? 'The world environment could not be changed.')
      setSettings(body.settings)
      setHistory(body.history ?? history)
      setReason('')
      setMessage(
        `Saved world environment v${body.settings.version}. Players see it on their next refresh.`,
      )
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The world environment could not be changed.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className={styles.editor} onSubmit={save} aria-label="World environment">
      <h2>World environment v{settings.version}</h2>
      <p data-testid="world-environment-current">
        {current
          ? `Effective server time ${formatMinuteOfDay(current.minuteOfDay)} UTC${
              current.frozen ? ' (frozen)' : ''
            }; weather ${current.weather} (${
              current.weatherSource === 'master' ? 'forced by Master' : 'live'
            }).`
          : 'Reading the current server time…'}
      </p>
      <label>
        Shift server time (minutes, −1440 to 1440)
        <input
          type="number"
          min={-MAX_TIME_OFFSET_MINUTES}
          max={MAX_TIME_OFFSET_MINUTES}
          step="1"
          required
          value={offset}
          disabled={saving || frozen}
          onChange={(event) => setOffset(event.target.value)}
        />
      </label>
      <label>
        <span>
          <input
            type="checkbox"
            checked={frozen}
            disabled={saving}
            onChange={(event) => setFrozen(event.target.checked)}
          />{' '}
          Freeze the clock at a time of day (UTC)
        </span>
      </label>
      <label>
        Frozen time of day (UTC)
        <input
          type="time"
          value={clock}
          disabled={saving || !frozen}
          onChange={(event) => setClock(event.target.value)}
        />
      </label>
      <label>
        Weather
        <select
          value={weather}
          disabled={saving}
          onChange={(event) => setWeather(event.target.value as WorldWeather | 'live')}
        >
          <option value="live">Live weather (no override)</option>
          {WORLD_WEATHER.map((w) => (
            <option key={w} value={w}>
              Force {w}
            </option>
          ))}
        </select>
      </label>
      <label>
        Forced weather duration
        <select
          value={duration}
          disabled={saving || weather === 'live'}
          onChange={(event) => setDuration(event.target.value as DurationKey)}
        >
          {DURATIONS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Environment change reason (8 to 240 characters)
        <textarea
          required
          minLength={8}
          maxLength={240}
          value={reason}
          disabled={saving}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button type="submit" disabled={saving || !valid || reason.trim().length < 8}>
        {saving ? 'Saving…' : 'Apply world environment'}
      </button>
      <p role="status">{message}</p>
      <h3>Recent changes</h3>
      {history.length === 0 ? (
        <p>No environment changes have been recorded.</p>
      ) : (
        <ol aria-label="World environment change history">
          {history.map((entry) => (
            <li key={entry.id}>
              v{entry.version} · {new Date(entry.changedAtMs).toISOString()} · {entry.actorUserId}:{' '}
              {describeSettingsChange(entry.after)} — {entry.reason}
            </li>
          ))}
        </ol>
      )}
    </form>
  )
}
