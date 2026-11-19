'use client'

import { useId, useMemo, useState, type CSSProperties } from 'react'
import {
  APPEARANCE_CATALOG,
  APPEARANCE_EXPRESSIONS,
  APPEARANCE_FACINGS,
  APPEARANCE_FRAME,
  APPEARANCE_POSES,
  APPEARANCE_PRESETS,
  paintedAppearanceBlueprint,
  type PaintedAppearanceBlueprint,
  appearanceFrameIndex,
  compileAppearanceManifest,
  parseAppearanceBlueprint,
  varyAppearanceOutfit,
  withCuff,
  withLowerGarment,
  type AppearanceBlueprint,
  type AppearanceExpression,
  type AppearanceFacing,
  type AppearanceManifest,
  type AppearancePose,
} from '@/appearance/appearance-manifest'
import {
  DEFAULT_PAINTED_LOOK,
  PAINTED_FIELDS,
  randomPaintedLook,
  type PaintedLook,
} from '@/appearance/appearance-painted-catalog'
import {
  appearanceClothingConflict,
  WARDROBE_CUT_LABELS,
} from '@/appearance/appearance-wardrobe-catalog'
import {
  LOWER_GARMENTS,
  LOWER_GARMENT_LABELS,
  supportsLowerGarment,
  type LowerGarmentChoice,
} from '@/appearance/appearance-lower-catalog'
import {
  CUFFS,
  CUFF_LABELS,
  supportsCuff,
  type CuffChoice,
} from '@/appearance/appearance-cuff-catalog'
import styles from './appearance-builder.module.css'

type Field = keyof typeof APPEARANCE_CATALOG

const groups: readonly { name: string; fields: readonly Field[] }[] = [
  { name: 'Identity', fields: ['body', 'complexion', 'hair', 'hairColor'] },
  {
    name: 'Clothing',
    fields: ['coat', 'collar', 'sleeves', 'closure', 'hem', 'textile', 'accessory', 'palette'],
  },
]
const labels: Partial<Record<Field, string>> = { hairColor: 'Hair color', coat: 'Silhouette' }
const fields = groups.flatMap(({ fields }) => fields)
const lowerChoices = ['original', ...LOWER_GARMENTS] as const
const cuffChoices = ['original', ...CUFFS] as const
const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const partLabel = (field: Field, value: string) =>
  (field === 'coat' ? WARDROBE_CUT_LABELS[value as keyof typeof WARDROBE_CUT_LABELS] : undefined) ??
  title(value)

function randomizeParts(value: AppearanceBlueprint, parts: readonly Field[]) {
  return parts.reduce((next, part) => {
    const choices = APPEARANCE_CATALOG[part]
      .map((choice) => parseAppearanceBlueprint({ ...next, [part]: choice }))
      .filter((candidate): candidate is AppearanceBlueprint => candidate !== null)
    return choices[Math.floor(Math.random() * choices.length)] ?? next
  }, value)
}

function randomizeOutfit(value: AppearanceBlueprint, parts: readonly Field[]) {
  const originalCuffs = withCuff(value, 'original') ?? value
  const next = randomizeParts(withLowerGarment(originalCuffs, 'original') ?? originalCuffs, parts)
  if (!supportsLowerGarment(next.coat)) return next
  const lower = lowerChoices[Math.floor(Math.random() * lowerChoices.length)] ?? 'original'
  const withLower = withLowerGarment(next, lower) ?? next
  if (!supportsCuff(next.coat)) return withLower
  const cuff = cuffChoices[Math.floor(Math.random() * cuffChoices.length)] ?? 'original'
  return withCuff(withLower, cuff) ?? withLower
}

const paintedLabels = {
  identity: 'Character',
  outerwear: 'Clothing style',
  clothColor: 'Clothing color',
  gear: 'Accessory style',
  gearColor: 'Accessory color',
  headwear: 'Headwear style',
  headColor: 'Headwear color',
  facewear: 'Face accessory style',
  faceColor: 'Face accessory color',
} satisfies Record<keyof PaintedLook, string>

function PaintedOutfitFields({
  value,
  disabled,
  onChange,
}: {
  value: PaintedAppearanceBlueprint
  disabled: boolean
  onChange: (next: PaintedAppearanceBlueprint) => void
}) {
  return (
    <fieldset disabled={disabled}>
      <legend>Painted outfit</legend>
      <div className={styles.fields}>
        {(Object.keys(PAINTED_FIELDS) as (keyof PaintedLook)[]).map((field) => (
          <label key={field}>
            {paintedLabels[field]}
            <select
              value={value[field]}
              disabled={
                (field === 'clothColor' && value.outerwear === 'none') ||
                (field === 'gearColor' && value.gear === 'none') ||
                (field === 'headColor' && value.headwear === 'none') ||
                (field === 'faceColor' && value.facewear === 'none')
              }
              onChange={(event) => {
                if (!Object.hasOwn(PAINTED_FIELDS[field], event.target.value)) return
                onChange(paintedAppearanceBlueprint({ ...value, [field]: event.target.value }))
              }}
            >
              {Object.entries(PAINTED_FIELDS[field]).map(([id, option]) => (
                <option key={id} value={id}>
                  {typeof option === 'string' ? option : option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function AppearanceBuilder({
  value,
  onChange,
  disabled = false,
}: {
  value: AppearanceBlueprint
  onChange: (blueprint: AppearanceBlueprint) => void
  disabled?: boolean
}) {
  const manifest = useMemo(() => compileAppearanceManifest(value), [value])
  const lowerHint = useId()
  const cuffHint = useId()
  const hasSeparateLowerLayer = supportsLowerGarment(value.coat)
  const hasCuffs = supportsCuff(value.coat)
  const lower = value.v === 2 || value.v === 3 ? value.lower : 'original'
  const cuff = value.v === 3 ? value.cuff : 'original'
  const painted = value.v === 4 ? value : null
  const editableGroups = painted ? [] : groups
  const [expression, setExpression] = useState<AppearanceExpression>('neutral')
  const [facing, setFacing] = useState<AppearanceFacing>('south')
  const [battlePose, setBattlePose] = useState<AppearancePose>('idle')
  const [initial] = useState(value)
  const [history, setHistory] = useState<AppearanceBlueprint[]>([])
  const [favorites, setFavorites] = useState<AppearanceBlueprint[]>([])
  const clothingConflicts = Array.from(
    new Set(
      (['coat', 'sleeves', 'accessory'] as const).flatMap((field) =>
        APPEARANCE_CATALOG[field].flatMap((choice) => {
          const conflict = appearanceClothingConflict({ ...value, [field]: choice })
          return conflict ? [conflict] : []
        }),
      ),
    ),
  )
  const update = (next: AppearanceBlueprint) => {
    if (compileAppearanceManifest(next).id === manifest.id) return
    setHistory((entries) => [...entries.slice(-23), value])
    onChange(next)
  }

  return (
    <div className={styles.builder}>
      <div className={styles.preview}>
        <AppearancePortraitPreview manifest={manifest} expression={expression} />
        <label>
          Expression
          <select
            value={expression}
            onChange={(event) => setExpression(event.target.value as AppearanceExpression)}
          >
            {APPEARANCE_EXPRESSIONS.map((item) => (
              <option key={item} value={item}>
                {title(item)}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.previewControls}>
          <label>
            Facing
            <select
              value={facing}
              onChange={(event) => setFacing(event.target.value as AppearanceFacing)}
            >
              {APPEARANCE_FACINGS.map((direction) => (
                <option key={direction} value={direction}>
                  {title(direction)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Battle pose
            <select
              value={battlePose}
              onChange={(event) => setBattlePose(event.target.value as AppearancePose)}
            >
              {APPEARANCE_POSES.map((pose) => (
                <option key={pose} value={pose}>
                  {title(pose)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.poses} aria-label="Appearance at gameplay sizes">
          <figure>
            <span className={styles.icon}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={manifest.icon} alt="" width={30} height={30} />
            </span>
            <figcaption>Icon</figcaption>
          </figure>
          <PosePreview
            manifest={manifest}
            size={44}
            facing={facing}
            pose="walk"
            label="Field walk"
          />
          <PosePreview
            manifest={manifest}
            size={55}
            facing={facing}
            pose={battlePose}
            label="Battle"
          />
        </div>
      </div>
      <div className={styles.controls}>
        <fieldset className={styles.presets} disabled={disabled}>
          <legend>Starting looks</legend>
          <div className={styles.actions}>
            {APPEARANCE_PRESETS.map((preset) => (
              <button type="button" key={preset.name} onClick={() => update(preset.blueprint)}>
                {preset.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => update(paintedAppearanceBlueprint(DEFAULT_PAINTED_LOOK))}
            >
              Painted characters
            </button>
          </div>
        </fieldset>
        {painted ? (
          <PaintedOutfitFields value={painted} disabled={disabled} onChange={update} />
        ) : null}
        {editableGroups.map(({ name, fields: parts }) => (
          <fieldset key={name} disabled={disabled}>
            <legend>{name}</legend>
            <div className={styles.fields}>
              {parts.map((field) => (
                <label key={field}>
                  {labels[field] ?? title(field)}
                  <select
                    value={value[field]}
                    onChange={(event) => {
                      const next = parseAppearanceBlueprint({
                        ...value,
                        [field]: event.target.value,
                      })
                      if (next) update(next)
                    }}
                  >
                    {APPEARANCE_CATALOG[field].map((choice) => (
                      <option
                        key={choice}
                        value={choice}
                        disabled={!parseAppearanceBlueprint({ ...value, [field]: choice })}
                      >
                        {partLabel(field, choice)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {name === 'Clothing' ? (
                <label>
                  Sleeve cuffs
                  <select
                    aria-describedby={cuffHint}
                    value={cuff}
                    onChange={(event) => {
                      const next = withCuff(value, event.target.value as CuffChoice)
                      if (next) update(next)
                    }}
                  >
                    {cuffChoices.map((choice) => (
                      <option
                        key={choice}
                        value={choice}
                        disabled={choice !== 'original' && !hasCuffs}
                      >
                        {CUFF_LABELS[choice]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {name === 'Clothing' ? (
                <label>
                  Lower garment
                  <select
                    aria-describedby={lowerHint}
                    value={lower}
                    onChange={(event) => {
                      const next = withLowerGarment(value, event.target.value as LowerGarmentChoice)
                      if (next) update(next)
                    }}
                  >
                    {lowerChoices.map((choice) => (
                      <option
                        key={choice}
                        value={choice}
                        disabled={choice !== 'original' && !hasSeparateLowerLayer}
                      >
                        {LOWER_GARMENT_LABELS[choice]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() =>
                  update(
                    name === 'Clothing'
                      ? randomizeOutfit(value, parts)
                      : randomizeParts(value, parts),
                  )
                }
              >
                Randomize {name.toLowerCase()}
              </button>
              {name === 'Clothing' ? (
                <button type="button" onClick={() => update(varyAppearanceOutfit(value))}>
                  Vary silhouette
                </button>
              ) : null}
            </div>
            {name === 'Clothing' ? (
              <>
                <small id={lowerHint}>
                  {clothingConflicts.join(' ')}{' '}
                  {!hasSeparateLowerLayer
                    ? 'Choose a compatible short top to use a separate lower garment.'
                    : lower !== 'original'
                      ? 'Select original trousers to unlock tops that cover this layer.'
                      : 'The lower garment is visible in the field and battle previews.'}
                </small>
                <small id={cuffHint}>
                  {!hasCuffs
                    ? 'Choose a short top with exposed sleeves to change its cuffs.'
                    : cuff !== 'original'
                      ? 'Select original cuffs to unlock other tops.'
                      : 'Cuffs are visible in the field and battle previews.'}
                </small>
              </>
            ) : null}
          </fieldset>
        ))}
        <div className={styles.actions}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!painted) {
                update(randomizeOutfit(value, fields))
                return
              }
              update(paintedAppearanceBlueprint(randomPaintedLook()))
            }}
          >
            Generate random sprite
          </button>
          <button
            type="button"
            disabled={disabled || history.length === 0}
            onClick={() => {
              const previous = history.at(-1)
              if (previous) onChange(previous)
              setHistory((entries) => entries.slice(0, -1))
            }}
          >
            Undo
          </button>
          <button type="button" disabled={disabled} onClick={() => update(initial)}>
            Reset
          </button>
          <button
            type="button"
            disabled={disabled || favorites.length >= 6 || favorites.includes(value)}
            onClick={() => setFavorites((entries) => [...entries, value])}
          >
            Favorite look
          </button>
        </div>
        {favorites.length > 0 ? (
          <div className={styles.actions} role="group" aria-label="Session favorites">
            {favorites.map((favorite, index) => (
              <button
                key={index}
                type="button"
                disabled={disabled}
                onClick={() => update(favorite)}
              >
                Look {index + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>
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
      alt={`${title(expression)} appearance portrait`}
      width={120}
      height={120}
    />
  )
}

function PosePreview({
  manifest,
  size,
  facing,
  pose,
  label,
}: {
  manifest: AppearanceManifest
  size: number
  facing: AppearanceFacing
  pose: AppearancePose
  label: string
}) {
  const { columns, rows } = APPEARANCE_FRAME
  const { column, row } = appearanceFrameIndex(facing, pose, 0)
  return (
    <figure>
      <span
        aria-hidden="true"
        className={styles.sprite}
        data-preview-motion={pose !== 'idle' && pose !== 'down' ? pose : undefined}
        style={
          {
            width: size,
            backgroundImage: `url("${manifest.atlas}")`,
            backgroundSize: `${columns * 100}% ${rows * 100}%`,
            '--x0': `${(100 * column) / (columns - 1)}%`,
            '--x1': `${(100 * (column + 1)) / (columns - 1)}%`,
            '--x2': `${(100 * (column + 2)) / (columns - 1)}%`,
            '--y': `${(100 * row) / (rows - 1)}%`,
          } as CSSProperties
        }
      />
      <figcaption>{label}</figcaption>
    </figure>
  )
}

export async function loadAppearanceCandidate(blueprint: AppearanceBlueprint) {
  const manifest = compileAppearanceManifest(blueprint)
  await Promise.all(
    [...new Set([...Object.values(manifest.portraits), manifest.icon, manifest.atlas])].map(
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
