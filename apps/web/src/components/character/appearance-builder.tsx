'use client'

import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { APPEARANCE_BACKDROP_GROUPS } from '@/appearance/appearance-backdrop-catalog'
import {
  activePaintedLookKey,
  activePaintedLooksForGender,
  isActivePaintedAppearance,
  pickActivePaintedLook,
} from '@/appearance/appearance-active-catalog'
import {
  APPEARANCE_EXPRESSIONS,
  APPEARANCE_FRAME,
  APPEARANCE_MOTION_FRAME,
  APPEARANCE_POSES,
  APPEARANCE_READY_CYCLE_MS,
  APPEARANCE_WALK_CYCLE_MS,
  appearanceMotionFrameIndex,
  compileAppearanceManifest,
  type AppearanceBlueprint,
  type AppearanceExpression,
  type AppearanceFacing,
  type AppearanceManifest,
  type AppearancePose,
} from '@/appearance/appearance-manifest'
import {
  APPEARANCE_GENDERS,
  appearanceGenderForIdentity,
  paintedPlayerAppearanceBlueprint,
  type AppearanceGender,
} from '@/appearance/appearance-painted-looks'
import {
  PAINTED_PLAYER_FIELDS,
  WARDROBE_DYES,
  type PaintedPlayerLook,
} from '@/appearance/appearance-painted-wardrobe'
import readyStyles from './appearance-ready-stance.module.css'
import styles from './appearance-builder.module.css'

const genderChoices = Object.keys(APPEARANCE_GENDERS) as AppearanceGender[]
function title(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function Portraits({ manifest }: { manifest: AppearanceManifest }) {
  return (
    <div className={styles.portraits} role="group" aria-label="Portrait expressions">
      <figure className={styles.neutralPortrait}>
        <AppearancePortraitPreview manifest={manifest} />
        <figcaption>Neutral</figcaption>
      </figure>
      <div className={styles.alternatePortraits}>
        {APPEARANCE_EXPRESSIONS.filter((expression) => expression !== 'neutral').map(
          (expression) => (
            <figure key={expression}>
              <AppearancePortraitPreview manifest={manifest} expression={expression} />
              <figcaption>{title(expression)}</figcaption>
            </figure>
          ),
        )}
      </div>
    </div>
  )
}

function PortraitSettingOptions() {
  return (
    <>
      <option value="original">{PAINTED_PLAYER_FIELDS.backdrop.original}</option>
      {Object.entries(APPEARANCE_BACKDROP_GROUPS).map(([group, settings]) => (
        <optgroup key={group} label={group}>
          {Object.entries(settings).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}

export function AppearanceBuilder({
  value,
  initialGender,
  onChange,
  disabled = false,
}: {
  value: AppearanceBlueprint
  initialGender?: AppearanceGender
  onChange: (blueprint: AppearanceBlueprint) => void
  disabled?: boolean
}) {
  const manifest = useMemo(() => compileAppearanceManifest(value), [value])
  const [preview, setPreview] = useState(manifest)
  const [failedPreview, setFailedPreview] = useState<string>()
  useEffect(() => {
    if (manifest.id === preview.id) return
    let current = true
    void loadAppearanceCandidate(manifest.blueprint).then(
      (ready) => {
        if (current) setPreview(ready)
      },
      () => {
        if (current) setFailedPreview(manifest.id)
      },
    )
    return () => {
      current = false
    }
  }, [manifest, preview.id])
  const genderGroupName = useId()
  const look = isActivePaintedAppearance(value)
    ? value
    : pickActivePaintedLook(initialGender, () => 0)
  const gender = appearanceGenderForIdentity(look.identity)
  const choices = activePaintedLooksForGender(gender)
  const selected = activePaintedLookKey(look)
  const choose = (next: PaintedPlayerLook) => onChange(paintedPlayerAppearanceBlueprint(next))

  return (
    <div className={styles.builder}>
      <div className={styles.toolbar}>
        <fieldset className={styles.gender} disabled={disabled}>
          <legend>Gender</legend>
          <div className={styles.genderChoices}>
            {genderChoices.map((choice) => (
              <label key={choice}>
                <input
                  type="radio"
                  name={genderGroupName}
                  value={choice}
                  checked={gender === choice}
                  onChange={() => choose(pickActivePaintedLook(choice, () => 0))}
                />
                <span>{APPEARANCE_GENDERS[choice]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          className={styles.randomize}
          disabled={disabled}
          onClick={() => choose(pickActivePaintedLook(gender, Math.random, look))}
        >
          Randomize
        </button>
      </div>

      <div
        className={styles.preview}
        data-appearance-preview
        aria-busy={preview.id !== manifest.id && failedPreview !== manifest.id}
      >
        {failedPreview === manifest.id && preview.id !== manifest.id ? (
          <p role="status">This preview could not load. Change an option to try again.</p>
        ) : null}
        <Portraits key={preview.id} manifest={preview} />
        <div className={styles.gameplay} role="group" aria-label="Gameplay previews">
          <div className={styles.fieldPreviews} role="group" aria-label="Field previews">
            <figure className={styles.icon}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.icon} alt="" width={34} height={34} />
              <figcaption>Icon</figcaption>
            </figure>
            <PosePreview manifest={preview} size={47} facing="south" pose="walk" label="Movement" />
          </div>
          <div className={styles.battle} role="group" aria-label="Battle poses">
            {APPEARANCE_POSES.map((pose) => (
              <PosePreview
                key={pose}
                manifest={preview}
                size={58}
                facing="east"
                pose={pose}
                label={title(pose)}
                animateIdle
              />
            ))}
          </div>
        </div>
      </div>

      <fieldset className={styles.controls} disabled={disabled}>
        <legend>Painted appearance</legend>
        <div className={styles.fields}>
          <label>
            <span>Look</span>
            <select
              aria-label="Look"
              value={selected}
              onChange={(event) => {
                const choice = choices.find(({ key }) => key === event.target.value)
                if (choice) choose(choice.look)
              }}
            >
              {choices.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Portrait setting</span>
            <select
              aria-label="Portrait setting"
              value={look.backdrop}
              onChange={(event) => {
                const backdrop = event.target.value as PaintedPlayerLook['backdrop']
                if (Object.hasOwn(PAINTED_PLAYER_FIELDS.backdrop, backdrop))
                  choose({ ...look, backdrop })
              }}
            >
              <PortraitSettingOptions />
            </select>
          </label>
          {selected === 'asta' ? (
            <label>
              <span>Cape color</span>
              <select
                aria-label="Cape color"
                value={look.clothColor}
                onChange={(event) => {
                  const clothColor = event.target.value as PaintedPlayerLook['clothColor']
                  if (Object.hasOwn(WARDROBE_DYES, clothColor)) choose({ ...look, clothColor })
                }}
              >
                {Object.entries(WARDROBE_DYES).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </fieldset>
    </div>
  )
}

export function AppearancePortraitPreview({
  manifest,
  expression = 'neutral',
}: {
  manifest: AppearanceManifest
  expression?: AppearanceExpression
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.portrait}
      src={manifest.portraits[expression]}
      alt={title(expression) + ' appearance portrait'}
      width={120}
      height={120}
    />
  )
}

export function PosePreview({
  manifest,
  size,
  facing,
  pose,
  label,
  animateIdle = false,
}: {
  manifest: AppearanceManifest
  size: number
  facing: AppearanceFacing
  pose: AppearancePose
  label: string
  animateIdle?: boolean
}) {
  const { columns, rows, frames } = APPEARANCE_MOTION_FRAME
  const { column, row } = appearanceMotionFrameIndex(facing, pose, 0)
  const continuous = pose === 'idle' || pose === 'walk'
  const frameCount = continuous ? frames : APPEARANCE_FRAME.frames
  const animate = pose !== 'idle' || animateIdle
  return (
    <figure>
      <span
        aria-hidden="true"
        className={
          animate && pose === 'idle' ? `${styles.sprite} ${readyStyles.ready}` : styles.sprite
        }
        data-appearance-facing={facing}
        data-preview-motion={animate ? pose : undefined}
        style={
          {
            backgroundImage: 'url("' + manifest.motionAtlas + '")',
            backgroundSize: columns * 100 + '% ' + rows * 100 + '%',
            '--sprite-width': size + 'px',
            '--first-frame': (100 * column) / (columns - 1) + '%',
            '--last-frame': (100 * (column + frameCount - 1)) / (columns - 1) + '%',
            '--sprite-row': (100 * row) / (rows - 1) + '%',
            '--preview-frames': frameCount,
            '--preview-cycle': `${pose === 'walk' ? APPEARANCE_WALK_CYCLE_MS : 900}ms`,
            '--ready-duration': `${APPEARANCE_READY_CYCLE_MS}ms`,
          } as CSSProperties
        }
      />
      <figcaption>{label}</figcaption>
    </figure>
  )
}

export async function loadAppearanceCandidate(blueprint: AppearanceBlueprint) {
  const manifest = compileAppearanceManifest(blueprint)
  const images = new Set([
    ...Object.values(manifest.portraits),
    manifest.icon,
    manifest.atlas,
    manifest.motionAtlas,
  ])
  await Promise.all(
    [...images].map(
      (src) =>
        new Promise<void>((resolve, reject) => {
          const image = new Image()
          image.onload = () => {
            void image.decode().then(resolve, reject)
          }
          image.onerror = () => reject(new Error('The preview is incomplete. Try again.'))
          image.src = src
        }),
    ),
  )
  return manifest
}
