'use client'

import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { PORTRAIT_FACES, portraitFace } from '@/appearance/appearance-face-catalog'
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
  paintedPlayerAppearanceBlueprint,
  paintedPlayerLook,
  randomPaintedLookForGender,
  type AppearanceGender,
} from '@/appearance/appearance-painted-looks'
import {
  PAINTED_PLAYER_FIELDS,
  PAINTED_WARDROBE_LABELS,
  wardrobeLook,
  PLAYER_HAIRSTYLE_GROUPS,
  type PaintedPlayerLook,
} from '@/appearance/appearance-painted-wardrobe'
import readyStyles from './appearance-ready-stance.module.css'
import styles from './appearance-builder.module.css'

const genderChoices = Object.keys(APPEARANCE_GENDERS) as AppearanceGender[]
const fields = [
  'identity',
  'bodyFrame',
  'skinTone',
  'hairstyle',
  'hairDye',
  'hairAccent',
  'hairPlacement',
  'eyeColor',
  'secondEye',
  'facialHair',
  'scar',
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
  eyeColor: 'Eye color',
  secondEye: 'Right eye color (heterochromia)',
  facewear: 'Facewear style',
  faceColor: 'Facewear color',
  backdrop: 'Portrait setting',
} satisfies Record<Exclude<keyof PaintedPlayerLook, 'faceId'>, string>

const displayLabels: Partial<Record<Exclude<keyof PaintedPlayerLook, 'faceId'>, string>> = {
  eyeColor: 'Eye color',
  secondEye: 'Right eye color',
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
  const faces = PORTRAIT_FACES.filter((face) => appearanceGenderForIdentity(face.rig) === gender)
  return (
    <fieldset className={styles.controls} aria-label="Appearance options" disabled={disabled}>
      {legacy ? <p className={styles.legacyHint}>Edits start a painted look.</p> : null}
      <div className={styles.fields}>
        {fields.map((field) => {
          const dyePiece = dyedPieces[field]
          const options = PAINTED_PLAYER_FIELDS[field]
          const defaultValue =
            field === 'hairPlacement'
              ? 'streak'
              : field === 'hairAccent' || field === 'secondEye'
                ? 'natural'
                : 'none'
          return (
            <label key={field}>
              <span>{displayLabels[field] ?? fieldLabels[field]}</span>
              <select
                aria-label={fieldLabels[field]}
                title={
                  field === 'backdrop' ? PAINTED_PLAYER_FIELDS.backdrop[look.backdrop] : undefined
                }
                value={
                  field === 'identity'
                    ? (look.faceId ?? 'fit' + look.identity)
                    : (look[field] ?? defaultValue)
                }
                disabled={
                  Boolean(dyePiece && look[dyePiece] === 'none') ||
                  (field === 'hairPlacement' && (!look.hairAccent || look.hairAccent === 'natural'))
                }
                onChange={(event) => {
                  const choice = event.target.value
                  if (field === 'identity') {
                    const face = portraitFace(choice)
                    if (face && appearanceGenderForIdentity(face.rig) === gender)
                      onChange(
                        paintedPlayerAppearanceBlueprint({
                          ...look,
                          identity: face.rig,
                          faceId: face.id,
                        }),
                      )
                  } else if (Object.hasOwn(options, choice)) {
                    onChange(
                      paintedPlayerAppearanceBlueprint({
                        ...look,
                        faceId: look.faceId ?? 'fit' + look.identity,
                        [field]: choice,
                      }),
                    )
                  }
                }}
              >
                {field === 'identity' ? (
                  faces.map(({ id, name }) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))
                ) : field === 'backdrop' ? (
                  <PortraitSettingOptions />
                ) : field === 'hairstyle' ? (
                  Object.entries(PLAYER_HAIRSTYLE_GROUPS).map(([group, styles]) => (
                    <optgroup key={group} label={group}>
                      {styles.map((id) => (
                        <option key={id} value={id}>
                          {PAINTED_PLAYER_FIELDS.hairstyle[id]}
                        </option>
                      ))}
                    </optgroup>
                  ))
                ) : (
                  Object.entries(options).map(([id, option]) => (
                    <option key={id} value={id}>
                      {id === 'natural'
                        ? field === 'secondEye'
                          ? 'Match left eye'
                          : field === 'hairAccent'
                            ? 'No second color'
                            : 'Original'
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
    const next =
      painted && look
        ? { ...look, faceId: 'fit' + defaults.identity, identity: defaults.identity }
        : { ...defaults, faceId: 'fit' + defaults.identity }
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

      <div
        className={styles.preview}
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
