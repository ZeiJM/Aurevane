'use client'

import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import {
  APPEARANCE_RACES,
  AUTHORED_CHARACTERS,
  authoredAppearance,
  authoredCharacter,
  type AuthoredAppearanceBlueprint,
} from '@/appearance/appearance-authored-catalog'
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
import { APPEARANCE_GENDERS, type AppearanceGender } from '@/appearance/appearance-gender'
import readyStyles from './appearance-ready-stance.module.css'
import styles from './appearance-builder.module.css'

const genderChoices = Object.keys(APPEARANCE_GENDERS) as AppearanceGender[]
function title(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function randomAuthoredLook(
  current: AuthoredAppearanceBlueprint,
  catalogue: readonly { key: string }[],
) {
  const choices = catalogue.filter(({ key }) => key !== current.character)
  const next = choices[Math.floor(Math.random() * choices.length)]
  return next
    ? authoredAppearance(next.key, Math.random() < 0.5 ? 1 : 2)
    : authoredAppearance(current.character, current.variant === 1 ? 2 : 1)
}

function Portraits({ manifest }: { manifest: AppearanceManifest }) {
  return (
    <div className={styles.portraits} role="group" aria-label="Portrait expressions">
      <figure className={styles.neutralPortrait}>
        <div className={styles.neutralImage}>
          <AppearancePortraitPreview manifest={manifest} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.icon}
            src={manifest.icon}
            alt="Character icon"
            width={32}
            height={32}
          />
        </div>
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

export function AppearanceBuilder({
  value,
  onChange,
  disabled = false,
}: {
  value: AuthoredAppearanceBlueprint
  onChange: (blueprint: AuthoredAppearanceBlueprint) => void
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
  const [search, setSearch] = useState('')
  const authored = authoredCharacter(value.character)!
  const gender = authored.gender
  const availableAuthored = AUTHORED_CHARACTERS.filter((character) => character.gender === gender)
  const raceChoices = Array.from(new Set(availableAuthored.map((character) => character.race)))
  const raceCatalogue = availableAuthored.filter((character) => character.race === authored.race)
  const query = search.trim().toLowerCase()
  const chooseAuthored = (key: string, variant: number = 1) => {
    const next = authoredAppearance(key, variant)
    if (next) onChange(next)
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
                  onChange={() => {
                    setSearch('')
                    const matchingRace = AUTHORED_CHARACTERS.find(
                      (character) =>
                        character.gender === choice && character.race === authored.race,
                    )
                    if (matchingRace) chooseAuthored(matchingRace.key)
                  }}
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
          onClick={() => {
            setSearch('')
            const next = randomAuthoredLook(value, raceCatalogue)
            if (next) onChange(next)
          }}
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
          <div className={styles.battle}>
            <div role="group" aria-label="Field previews">
              <PosePreview manifest={preview} size={70} facing="south" pose="walk" label="Field" />
            </div>
            <div className={styles.battlePoses} role="group" aria-label="Battle poses">
              {APPEARANCE_POSES.map((pose) => (
                <PosePreview
                  key={pose}
                  manifest={preview}
                  size={78}
                  facing="east"
                  pose={pose}
                  label={title(pose)}
                  animateIdle
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <fieldset className={styles.controls} disabled={disabled}>
        <legend>Painted appearance</legend>
        <div className={styles.fields}>
          <label className={styles.lookSearch}>
            <span>Race</span>
            <select
              aria-label="Race"
              value={authored.race}
              onChange={(event) => {
                setSearch('')
                const next = availableAuthored.find(({ race }) => race === event.target.value)
                if (next) chooseAuthored(next.key)
              }}
            >
              {raceChoices.map((race) => (
                <option key={race} value={race}>
                  {APPEARANCE_RACES[race]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.fields}>
          <label className={styles.lookSearch}>
            <span>Find a look</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${raceCatalogue.length} looks`}
            />
          </label>
          <label>
            <span>Look</span>
            <select
              aria-label="Look"
              value={authored.key}
              onChange={(event) => chooseAuthored(event.target.value)}
            >
              {raceCatalogue
                .filter(
                  ({ key, label }) => key === authored.key || label.toLowerCase().includes(query),
                )
                .map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Variant</span>
            <select
              aria-label="Variant"
              value={value.variant}
              onChange={(event) => chooseAuthored(authored.key, Number(event.target.value))}
            >
              <option value={1}>Variant 1</option>
              <option value={2}>Variant 2</option>
            </select>
          </label>
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
            '--middle-frame': (100 * (column + 1)) / (columns - 1) + '%',
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
