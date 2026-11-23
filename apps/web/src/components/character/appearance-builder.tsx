'use client'

import { useId, useMemo, useState, type CSSProperties } from 'react'
import { APPEARANCE_BACKDROP_GROUPS } from '@/appearance/appearance-backdrop-catalog'
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
  defaultPaintedLookForGender,
  paintedIdentitiesForGender,
  paintedPlayerAppearanceBlueprint,
  paintedPlayerLook,
  randomPaintedLookForGender,
  type AppearanceGender,
} from '@/appearance/appearance-painted-looks'
import {
  PAINTED_PLAYER_FIELDS,
  PAINTED_WARDROBE_LABELS,
  wardrobeLook,
  type PaintedPlayerLook,
} from '@/appearance/appearance-painted-wardrobe'
import styles from './appearance-builder.module.css'

const genderChoices = Object.keys(APPEARANCE_GENDERS) as AppearanceGender[]
const fields = [
  'identity',
  'bodyFrame',
  'skinTone',
  'hairstyle',
  'hairDye',
  'eyeColor',
  'outerwear',
  'gear',
  'headwear',
  'clothColor',
  'gearColor',
  'headColor',
  'facewear',
  'faceColor',
  'backdrop',
] as const satisfies readonly (keyof PaintedPlayerLook)[]

const fieldLabels = {
  ...PAINTED_WARDROBE_LABELS,
  identity: 'Face',
  facewear: 'Facewear style',
  faceColor: 'Facewear color',
  backdrop: 'Portrait setting',
} satisfies Record<keyof PaintedPlayerLook, string>

const displayLabels: Partial<Record<keyof PaintedPlayerLook, string>> = {
  outerwear: 'Clothing',
  gear: 'Accessory',
  headwear: 'Headwear',
  facewear: 'Facewear',
}

const dyedPieces: Partial<Record<keyof PaintedPlayerLook, keyof PaintedPlayerLook>> = {
  clothColor: 'outerwear',
  gearColor: 'gear',
  headColor: 'headwear',
  faceColor: 'facewear',
} as const

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

function PaintedFields({
  gender,
  look,
  legacy,
  disabled,
  onChange,
}: {
  gender: AppearanceGender
  look: PaintedPlayerLook
  legacy: boolean
  disabled: boolean
  onChange: (blueprint: AppearanceBlueprint) => void
}) {
  const faces: readonly string[] = paintedIdentitiesForGender(gender)
  return (
    <fieldset className={styles.controls} aria-label="Appearance options" disabled={disabled}>
      {legacy ? <p className={styles.legacyHint}>Edits start a painted look.</p> : null}
      <div className={styles.fields}>
        {fields.map((field) => {
          const dyePiece = dyedPieces[field]
          const options = PAINTED_PLAYER_FIELDS[field]
          return (
            <label key={field}>
              <span>{displayLabels[field] ?? fieldLabels[field]}</span>
              <select
                aria-label={fieldLabels[field]}
                title={
                  field === 'backdrop' ? PAINTED_PLAYER_FIELDS.backdrop[look.backdrop] : undefined
                }
                value={look[field]}
                disabled={Boolean(dyePiece && look[dyePiece] === 'none')}
                onChange={(event) => {
                  const choice = event.target.value
                  if (Object.hasOwn(options, choice))
                    onChange(paintedPlayerAppearanceBlueprint({ ...look, [field]: choice }))
                }}
              >
                {field === 'backdrop' ? (
                  <PortraitSettingOptions />
                ) : (
                  Object.entries(options)
                    .filter(([id]) => field !== 'identity' || faces.includes(id))
                    .map(([id, option]) => (
                      <option key={id} value={id}>
                        {id === 'natural'
                          ? 'Original'
                          : typeof option === 'string'
                            ? option
                            : option.label}
                      </option>
                    ))
                )}
              </select>
            </label>
          )
        })}
      </div>
    </fieldset>
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
  const genderGroupName = useId()
  const [battlePose, setBattlePose] = useState<AppearancePose>('idle')
  const painted = 'identity' in value ? value : null
  const gender = painted ? appearanceGenderForIdentity(painted.identity) : initialGender
  const look: PaintedPlayerLook | null = painted
    ? painted.v === 6
      ? painted
      : paintedPlayerLook(painted.v === 5 ? painted : wardrobeLook(painted))
    : gender
      ? defaultPaintedLookForGender(gender)
      : null

  function selectGender(nextGender: AppearanceGender) {
    const defaults = defaultPaintedLookForGender(nextGender)
    const next = painted && look ? { ...look, identity: defaults.identity } : defaults
    onChange(paintedPlayerAppearanceBlueprint(next))
  }

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
                  onChange={() => selectGender(choice)}
                />
                <span>{APPEARANCE_GENDERS[choice]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          className={styles.randomize}
          disabled={disabled || !gender}
          onClick={() => {
            if (gender && look)
              onChange(
                paintedPlayerAppearanceBlueprint(
                  randomPaintedLookForGender(gender, undefined, look),
                ),
              )
          }}
        >
          Randomize
        </button>
      </div>

      <div className={styles.preview}>
        <Portraits manifest={manifest} />
        <div className={styles.gameplay} role="group" aria-label="Gameplay previews">
          <figure className={styles.icon}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={manifest.icon} alt="" width={34} height={34} />
            <figcaption>Icon</figcaption>
          </figure>
          <PosePreview manifest={manifest} size={47} facing="south" pose="walk" label="Movement" />
          <div className={styles.battle}>
            <PosePreview
              manifest={manifest}
              size={58}
              facing="east"
              pose={battlePose}
              label="Battle"
              animateIdle
            />
            <select
              aria-label="Battle pose"
              value={battlePose}
              disabled={disabled}
              onChange={(event) => setBattlePose(event.target.value as AppearancePose)}
            >
              {APPEARANCE_POSES.map((pose) => (
                <option key={pose} value={pose}>
                  {title(pose)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {gender && look ? (
        <PaintedFields
          gender={gender}
          look={look}
          legacy={!painted}
          disabled={disabled}
          onChange={onChange}
        />
      ) : (
        <p className={styles.controls + ' ' + styles.legacyHint}>
          Choose a gender to start a painted look.
        </p>
      )}
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
  const animate = pose !== 'down' && (pose !== 'idle' || animateIdle)
  const duration =
    pose === 'walk' ? APPEARANCE_WALK_CYCLE_MS : pose === 'idle' ? APPEARANCE_READY_CYCLE_MS : 900
  return (
    <figure>
      <span
        aria-hidden="true"
        className={styles.sprite}
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
            '--preview-cycle': duration + 'ms',
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
          image.onload = () => resolve()
          image.onerror = () => reject(new Error('The preview is incomplete. Try again.'))
          image.src = src
        }),
    ),
  )
  return manifest
}
