'use client'
import { useEffect, useState, type FormEvent } from 'react'
import {
  MAX_TIME_OFFSET_MINUTES,
  MAX_WORLD_DAY_MINUTES,
  MAX_WEATHER_ROLL_MINUTES,
  DEFAULT_WEATHER_ROLL_MINUTES,
  WORLD_WEATHER,
  resolveWorldEnvironment,
  worldTimeLabel,
  worldDayPhase,
  type WorldEnvironmentSettings,
  type WorldWeather,
} from '@/world/environment'
import { MasterHelp } from '../master-help'
import styles from './world-environment-editor.module.css'
const weatherLabels: Record<WorldWeather, string> = {
  clear: 'Clear',
  overcast: 'Overcast',
  rain: 'Rain / Snow in Frostmere',
  storm: 'Storm / Snowstorm in Frostmere',
  fog: 'Fog',
  wind: 'Wind',
}
function parseClock(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}
export function WorldEnvironmentEditor({
  initialSettings,
  initialNowMs,
}: {
  initialSettings: WorldEnvironmentSettings
  initialNowMs?: number
}) {
  const [settings, setSettings] = useState(initialSettings)
  const [now, setNow] = useState<number | null>(initialNowMs ?? null)
  const [dayLength, setDayLength] = useState(String(initialSettings.dayLengthMinutes ?? 1440))
  const [weatherRoll, setWeatherRoll] = useState(
    String(initialSettings.weatherRollMinutes ?? DEFAULT_WEATHER_ROLL_MINUTES),
  )
  const [offset, setOffset] = useState(String(initialSettings.timeOffsetMinutes))
  const [frozen, setFrozen] = useState(initialSettings.frozenMinuteOfDay !== null)
  const [clock, setClock] = useState(worldTimeLabel(initialSettings.frozenMinuteOfDay ?? 720))
  const [weather, setWeather] = useState<WorldWeather | 'live' | 'unchanged'>('unchanged')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0)
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [])
  const current = now === null ? null : resolveWorldEnvironment(now, settings)
  const offsetValue = /^-?\d{1,4}$/.test(offset) ? Number(offset) : NaN
  const dayValue = /^\d+$/.test(dayLength) ? Number(dayLength) : NaN
  const rollValue = /^\d+$/.test(weatherRoll) ? Number(weatherRoll) : NaN
  const frozenMinute = frozen ? parseClock(clock) : null
  const valid =
    Math.abs(offsetValue) <= MAX_TIME_OFFSET_MINUTES &&
    (!frozen || frozenMinute !== null) &&
    Number.isSafeInteger(dayValue) &&
    dayValue >= 1 &&
    dayValue <= MAX_WORLD_DAY_MINUTES &&
    Number.isSafeInteger(rollValue) &&
    rollValue >= 1 &&
    rollValue <= MAX_WEATHER_ROLL_MINUTES
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/master/world-environment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: settings.version,
          change: {
            dayLengthMinutes: dayValue,
            weatherRollMinutes: rollValue,
            timeOffsetMinutes: offsetValue,
            frozenMinuteOfDay: frozenMinute,
            weather: weather === 'live' ? null : weather,
          },
        }),
      })
      const body = (await response.json()) as {
        settings?: WorldEnvironmentSettings
        error?: { message?: string }
      }
      if (!response.ok || !body.settings)
        throw new Error(body.error?.message ?? 'The world environment could not be saved.')
      setSettings(body.settings)
      setWeather('unchanged')
      setMessage('World environment saved. Players receive it with their next World update.')
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The world environment could not be saved.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className={styles.editor} onSubmit={save} aria-label="World environment">
      <div className={styles.heading}>
        <h2>World Environment</h2>
        <MasterHelp label="World environment help">
          <p>
            One World day advances through 24 World hours. Default: 1440 real minutes (UTC). Shorter
            cycles make daylight and darkness pass faster; changing the cycle can shift the current
            phase.
          </p>
          <p>
            Automatic weather rolls use real minutes independently of the day length. A roll may
            keep the same weather. Default: every 360 minutes (six hours).
          </p>
          <p>
            Manual selections last until the next automatic roll. Saving Keep current weather
            preserves an earlier expiry and limits any longer override to the next roll. Rain
            renders as snow in Frostmere; Storm renders as Snowstorm there.
          </p>
        </MasterHelp>
      </div>
      <p data-testid="world-environment-current">
        {current
          ? `World time ${worldTimeLabel(current.minuteOfDay)} · ${worldDayPhase(current.minuteOfDay)}${current.frozen ? ' (frozen)' : ''} · ${weatherLabels[current.weather]} (${current.weatherSource === 'master' ? 'forced' : 'ordinary weather'}).`
          : 'Reading the current server time…'}
      </p>
      {settings.weatherOverrideUntil && current?.weatherSource === 'master' ? (
        <p>
          Forced weather ends{' '}
          {new Date(settings.weatherOverrideUntil).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}{' '}
          (local time) · {Math.ceil((settings.weatherOverrideUntil - now!) / 60_000)} min remaining.
        </p>
      ) : null}
      <div className={styles.sections}>
        <fieldset disabled={saving}>
          <legend>Day / night cycle</legend>
          <label>
            Day length (real minutes)
            <input
              type="number"
              min={1}
              max={MAX_WORLD_DAY_MINUTES}
              step="1"
              required
              value={dayLength}
              onChange={(event) => setDayLength(event.currentTarget.value)}
            />
          </label>

          <label>
            Shift world time (minutes, −1440 to 1440)
            <input
              type="number"
              min={-MAX_TIME_OFFSET_MINUTES}
              max={MAX_TIME_OFFSET_MINUTES}
              step="1"
              required
              value={offset}
              disabled={frozen}
              onChange={(event) => setOffset(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>
              <input
                type="checkbox"
                checked={frozen}
                onChange={(event) => setFrozen(event.currentTarget.checked)}
              />{' '}
              Freeze the clock at a time of day
            </span>
          </label>
          <label>
            Frozen World time
            <input
              type="time"
              value={clock}
              disabled={!frozen}
              onChange={(event) => setClock(event.currentTarget.value)}
            />
          </label>
        </fieldset>
        <fieldset disabled={saving}>
          <legend>Weather</legend>
          <label>
            Automatic weather roll interval (real minutes)
            <input
              type="number"
              min={1}
              max={MAX_WEATHER_ROLL_MINUTES}
              step="1"
              required
              value={weatherRoll}
              onChange={(event) => setWeatherRoll(event.currentTarget.value)}
            />
          </label>
          <label>
            Weather selection
            <select
              value={weather}
              onChange={(event) => setWeather(event.currentTarget.value as typeof weather)}
            >
              <option value="unchanged">Keep current weather</option>
              <option value="live">Ordinary weather (clear override)</option>
              {WORLD_WEATHER.map((value) => (
                <option key={value} value={value}>
                  {weatherLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <small>Manual selections last until the next automatic roll.</small>
        </fieldset>
      </div>
      <button type="submit" disabled={saving || !valid}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
      <p role="status">{message}</p>
    </form>
  )
}
