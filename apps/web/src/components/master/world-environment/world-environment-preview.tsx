'use client'

import { useEffect, useRef, useState } from 'react'
import { WORLD_REGIONS } from '@/world/catalog'
import { WORLD_WEATHER, type WorldWeather } from '@/world/environment'
import type { WorldView } from '@/world/types'
import { createMapRenderer } from '@/components/world/map-renderer'
import { regionalWeatherLabel } from '@/components/world/map-weather'
import { WorldMotion } from '@/components/world/world-motion'
import type { MapQuality } from '@/components/world/map-quality'
import styles from './world-environment-editor.module.css'

function RegionCanvas({
  view,
  weather,
  minute,
  quality,
  authorityOverlay,
}: {
  view: WorldView
  weather: WorldWeather
  minute: number
  quality: MapQuality
  authorityOverlay: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<ReturnType<typeof createMapRenderer>>(null)
  useEffect(() => {
    if (!canvas.current) return
    const current = createMapRenderer(
      canvas.current,
      new WorldMotion(view),
      view,
      () => {},
      () => {},
    )
    renderer.current = current
    return () => current?.dispose()
  }, [view])
  useEffect(() => {
    renderer.current?.update({
      ...view,
      environment: { ...view.environment, weather, minuteOfDay: minute },
    })
  }, [view, weather, minute])
  useEffect(() => {
    renderer.current?.settings({
      animate: true,
      zoom: 0.75,
      quality,
      preview: true,
      authorityOverlay,
    })
  }, [view, quality, authorityOverlay])
  return (
    <canvas
      className={styles.previewCanvas}
      ref={canvas}
      role="img"
      aria-label="Public region preview"
    />
  )
}

const phases = [
  { label: 'Dawn', minute: 390 },
  { label: 'Day', minute: 720 },
  { label: 'Dusk', minute: 1110 },
  { label: 'Night', minute: 0 },
]

export function WorldEnvironmentPreview({
  liveWeather,
}: {
  liveWeather: WorldWeather | undefined
}) {
  const [open, setOpen] = useState(false)
  const [region, setRegion] = useState('frostmere')
  const [minute, setMinute] = useState(720)
  const [weather, setWeather] = useState<WorldWeather | 'live'>('live')
  const [quality, setQuality] = useState<MapQuality>('balanced')
  const [authorityOverlay, setAuthorityOverlay] = useState(false)
  const [result, setResult] = useState<{ region: string; view: WorldView | null }>()
  useEffect(() => {
    if (!open) return
    const abort = new AbortController()
    const query = new URLSearchParams({ previewRegion: region })
    void fetch(`/api/master/world-environment?${query}`, { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Region preview unavailable.')
        const { view } = (await response.json()) as { view: WorldView }
        if (!abort.signal.aborted) setResult({ region, view })
      })
      .catch(() => {
        if (!abort.signal.aborted) setResult({ region, view: null })
      })
    return () => abort.abort()
  }, [open, region])
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="world-environment-preview"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Hide region preview' : 'Preview region'}
      </button>
      {open ? (
        <fieldset id="world-environment-preview">
          <legend>Region preview</legend>
          <p>Preview changes are visible only here.</p>
          <div className={styles.previewControls}>
            <label>
              Region
              <select value={region} onChange={(event) => setRegion(event.currentTarget.value)}>
                {WORLD_REGIONS.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Preview weather
              <select
                value={weather}
                onChange={(event) => setWeather(event.currentTarget.value as WorldWeather | 'live')}
              >
                <option value="live">Current world weather</option>
                {WORLD_WEATHER.map((value) => (
                  <option key={value} value={value}>
                    {regionalWeatherLabel(value, region)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Time of day
              <select
                value={minute}
                onChange={(event) => setMinute(Number(event.currentTarget.value))}
              >
                {phases.map(({ label, minute }) => (
                  <option key={minute} value={minute}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Map detail
              <select
                value={quality}
                onChange={(event) => setQuality(event.currentTarget.value as MapQuality)}
              >
                <option value="high">High</option>
                <option value="balanced">Balanced</option>
                <option value="low">Low</option>
              </select>
            </label>
          </div>
          <label className={styles.authorityOverlay}>
            <span>
              <input
                type="checkbox"
                checked={authorityOverlay}
                onChange={(event) => setAuthorityOverlay(event.currentTarget.checked)}
              />{' '}
              Show movement boundaries and landmarks
            </span>
          </label>
          {authorityOverlay ? (
            <p>
              Purple marks blocked ground, gold marks crossings, and white outlines mark landmarks.
            </p>
          ) : null}
          {result?.region !== region ? (
            <p role="status">Loading region…</p>
          ) : result.view ? (
            <RegionCanvas
              view={result.view}
              weather={
                weather === 'live' ? (liveWeather ?? result.view.environment.weather) : weather
              }
              minute={minute}
              quality={quality}
              authorityOverlay={authorityOverlay}
            />
          ) : (
            <p role="alert">Region preview unavailable.</p>
          )}
        </fieldset>
      ) : null}
    </>
  )
}
