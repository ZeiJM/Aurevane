import type { BattlePreviewView } from '@/server/battle/battle-preview-service'
import { combatInteractionDescription } from '../../lib/battle/combat-interaction-presentation'
import { BattleInfoPopover } from './battle-info-popover'
import { previewChips } from './battle-preview-content'
import styles from './battle-action-preview.module.css'

export function BattleActionPreview({
  preview,
  pending,
  notice,
}: {
  preview: BattlePreviewView['preview'] | null
  pending: boolean
  notice?: string
}) {
  const chips = preview ? previewChips(preview) : []
  const important = chips.filter((chip) => chip.tone !== 'effect').slice(0, 4)
  const extra = chips.filter((chip) => !important.includes(chip))
  const interactions =
    preview?.kind === 'action'
      ? (preview.projectedEvents ?? []).map(combatInteractionDescription).filter(Boolean)
      : []
  return (
    <div
      className={styles.preview}
      data-battle-target-preview="true"
      data-react-battle-preview="true"
      aria-label="Action preview"
      aria-live="polite"
    >
      {preview && notice ? <span className={styles.notice}>{notice}</span> : null}
      {pending ? (
        <span>Calculating preview…</span>
      ) : preview ? (
        <>
          {important.map((chip, index) => (
            <span key={index} data-battle-preview-chip="true" data-battle-preview-tone={chip.tone}>
              {chip.label}
            </span>
          ))}
          {extra.slice(0, 2).map((chip, index) => (
            <span
              key={`effect-${index}`}
              className={styles.secondary}
              data-battle-preview-chip="true"
              data-battle-preview-tone={chip.tone}
            >
              {chip.label}
            </span>
          ))}
          <BattleInfoPopover label="Forecast details" trigger="ⓘ" title="Action forecast">
            <div className={styles.details}>
              {chips.map((chip, index) => (
                <span key={index}>{chip.label}</span>
              ))}
            </div>
            {preview.issues.map((issue) => (
              <p key={issue.code}>{issue.message}</p>
            ))}
            {interactions.map((description, index) => (
              <p key={index}>{description}</p>
            ))}
            <p>
              Projected result before confirmation. Damage with a hit chance assumes the hit lands.
            </p>
          </BattleInfoPopover>
        </>
      ) : (
        <span>{notice || 'Select a target to preview the result.'}</span>
      )}
    </div>
  )
}
