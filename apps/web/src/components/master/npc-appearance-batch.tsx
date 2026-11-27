'use client'

import { useState, type FormEvent } from 'react'
import {
  APPEARANCE_FRAME,
  paintedPlayerAppearanceBlueprint,
  appearanceManifestFromImageUrl,
  type LegacyAppearanceBlueprint,
} from '@/appearance/appearance-manifest'
import { pickActivePaintedLook } from '@/appearance/appearance-active-catalog'
import { PAINTED_IDENTITIES, PAINTED_CLOTHING } from '@/appearance/appearance-painted-catalog'
import {
  PAINTED_PLAYER_FIELDS,
  PAINTED_WARDROBE_LABELS,
  WARDROBE_OUTERWEAR,
  type PaintedWardrobeLook,
} from '@/appearance/appearance-painted-wardrobe'
import { AppearanceBuilderDialog } from '@/components/character/appearance-builder-dialog'
import {
  NPC_VARIANT_BATCH_MAX,
  NPC_VARIANT_BATCH_MIN,
  npcVariantFields,
  type NpcVariantField,
  type NpcVariantRequest,
} from '@/lib/npc-appearance-variants'
import styles from './npc-design-editor.module.css'

const fieldLabel = (field: NpcVariantField) =>
  field === 'coat'
    ? 'Silhouette'
    : field.replace(/^[a-z]|[A-Z]/g, (letter, offset: number) =>
        offset === 0 ? letter.toUpperCase() : ` ${letter.toLowerCase()}`,
      )

export function NpcAppearanceBatch({
  canApproveUniforms,
  reviewDisabled,
  onReview,
}: {
  canApproveUniforms: boolean
  reviewDisabled: boolean
  onReview: (imageUrl: string) => void
}) {
  const [base, setBase] = useState<LegacyAppearanceBlueprint>(() =>
    paintedPlayerAppearanceBlueprint(pickActivePaintedLook('masculine', () => 0)),
  )
  const [count, setCount] = useState(4)
  const [vary, setVary] = useState<NpcVariantField[]>(['backdrop'])
  const [uniform, setUniform] = useState(false)
  const [batch, setBatch] = useState<{ images: string[]; mode: NpcVariantRequest['mode'] } | null>(
    null,
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const painted = base.v === 4 || base.v === 5 || base.v === 6 ? base : null
  const wardrobe = painted && 'bodyFrame' in painted ? painted : null
  const fields = npcVariantFields(base)
  const allowed = vary.filter((field) => fields.includes(field))
  const paintedLabels: Partial<Record<NpcVariantField, string>> = {
    body: 'Character',
    coat: 'Clothing style',
    palette: 'Clothing color',
    accessory: 'Accessory style',
    hairColor: 'Accessory color',
    backdrop: 'Portrait setting',
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    setBatch(null)
    const mode = uniform ? 'uniform' : 'distinct'
    try {
      const response = await fetch('/api/master/npc-design/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base,
          count,
          vary: uniform ? [] : allowed,
          mode,
        } satisfies NpcVariantRequest),
      })
      const result = (await response.json()) as {
        candidates?: string[]
        error?: { message?: string }
      }
      if (!response.ok || !result.candidates)
        throw new Error(result.error?.message ?? 'Unable to generate NPC previews.')
      setBatch({ images: result.candidates, mode })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to generate NPC previews.')
    } finally {
      setPending(false)
    }
  }

  return (
    <details className={styles.variantBatch}>
      <summary>Generate several NPC appearance variants</summary>
      <form className={styles.variantForm} onSubmit={(event) => void generate(event)}>
        <fieldset disabled={pending}>
          <legend>Shared starting look</legend>
          <div className={styles.variantControls}>
            <AppearanceBuilderDialog
              label="Edit starting look"
              confirmLabel="Use this starting look"
              value={base}
              onConfirm={(next) => {
                if (next.v === 7) return
                if ('bodyFrame' in next && !wardrobe)
                  setVary(['identity', 'bodyFrame', 'skinTone', 'outerwear', 'gear', 'headwear'])
                if (wardrobe && !('bodyFrame' in next)) setVary(['body', 'coat'])
                setBase(next)
              }}
            />
            <label>
              Candidates
              <input
                type="number"
                min={NPC_VARIANT_BATCH_MIN}
                max={NPC_VARIANT_BATCH_MAX}
                required
                value={Number.isFinite(count) ? count : ''}
                onChange={(event) => setCount(event.target.valueAsNumber)}
              />
            </label>
          </div>
          <p className={styles.hint}>
            {wardrobe
              ? `${PAINTED_PLAYER_FIELDS.identity[wardrobe.identity]} · ${WARDROBE_OUTERWEAR[wardrobe.outerwear]}`
              : painted?.v === 4
                ? `${PAINTED_IDENTITIES[painted.identity]} · ${PAINTED_CLOTHING[painted.outerwear]}`
                : `Palette: ${base.palette}. Accessory: ${base.accessory}.`}
          </p>
          {canApproveUniforms ? (
            <label>
              <input
                type="checkbox"
                checked={uniform}
                onChange={(event) => setUniform(event.target.checked)}
              />{' '}
              Preview identical looks
            </label>
          ) : null}
        </fieldset>
        {uniform ? (
          <p className={styles.hint}>
            Commit the first NPC normally. A later NPC using that exact look needs individual Game
            Owner approval.
          </p>
        ) : (
          <fieldset disabled={pending}>
            <legend>Features allowed to vary</legend>
            <p className={styles.hint}>Unchecked features stay the same for every candidate.</p>
            <div className={styles.variantFields}>
              {fields.map((field) => (
                <label key={field}>
                  <input
                    type="checkbox"
                    checked={vary.includes(field)}
                    onChange={() =>
                      setVary((previous) =>
                        previous.includes(field)
                          ? previous.filter((item) => item !== field)
                          : [...previous, field],
                      )
                    }
                  />{' '}
                  {(wardrobe
                    ? (PAINTED_WARDROBE_LABELS[field as keyof PaintedWardrobeLook] ??
                      paintedLabels[field])
                    : painted
                      ? paintedLabels[field]
                      : undefined) ?? fieldLabel(field)}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <button type="submit" disabled={pending || (!uniform && allowed.length === 0)}>
          {pending ? 'Generating…' : 'Generate previews'}
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
      {batch ? (
        <div className={styles.variantResults}>
          <p role="status">
            {batch.images.length} {batch.mode === 'uniform' ? 'identical' : 'distinct'} previews.
            Open each look you want to keep and save its own draft.
          </p>
          {reviewDisabled ? (
            <p className={styles.hint}>
              Save or discard the open draft before reviewing another candidate.
            </p>
          ) : null}
          <ol className={styles.variantCards} role="list" aria-label="Appearance candidates">
            {batch.images.map((imageUrl, index) => {
              const manifest = appearanceManifestFromImageUrl(imageUrl)
              if (!manifest) return null
              return (
                <li key={`${imageUrl}-${index}`}>
                  <div className={styles.variantArt}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={manifest.portraits.neutral} alt="Portrait" width={76} height={76} />
                    <span
                      role="img"
                      aria-label="Field sprite"
                      className={styles.variantSprite}
                      style={{
                        width: APPEARANCE_FRAME.width,
                        height: APPEARANCE_FRAME.height,
                        backgroundImage: `url("${manifest.atlas}")`,
                        backgroundSize: `${APPEARANCE_FRAME.columns * 100}% ${APPEARANCE_FRAME.rows * 100}%`,
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={reviewDisabled}
                    onClick={() => onReview(imageUrl)}
                  >
                    Review candidate {index + 1}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}
    </details>
  )
}
