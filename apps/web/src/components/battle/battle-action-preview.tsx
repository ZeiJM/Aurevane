import type { BattlePreviewView } from '@/server/battle/battle-preview-service'
import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import {
  combatInteractionDescription,
  gameplayStatusName,
} from '../../lib/battle/combat-interaction-presentation'
import { BattleInfoPopover } from './battle-info-popover'
import { previewChips, skillPreviewChips } from './battle-preview-content'
import type {
  BattlePresentationParticipant,
  BattleSkillForecastPresentation,
} from './battle-runtime'
import styles from './battle-action-preview.module.css'

export function BattleActionPreview({
  preview: suppliedPreview,
  pending,
  notice,
  skill,
  participants = [],
}: {
  preview: BattlePreviewView['preview'] | null
  pending: boolean
  notice?: string
  skill?: BattleSkillForecastPresentation | null
  participants?: readonly BattlePresentationParticipant[]
}) {
  const preview =
    skill &&
    suppliedPreview &&
    (suppliedPreview.kind !== 'action' || suppliedPreview.actionId !== skill.id)
      ? null
      : suppliedPreview
  const chips = preview ? previewChips(preview) : []
  const skillChips = skill ? skillPreviewChips(skill) : []
  const skillTargetChip = skillChips.find((chip) => chip.tone === 'effect')
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
          {preview.kind === 'action' && preview.legal ? (
            <div className={styles.targets} aria-label="Affected target forecasts">
              {preview.affectedCombatantIds.map((id, index) => {
                const participant = participants.find((item) => item.combatantId === id)
                const effects = preview.projectedEffects.filter(
                  (effect) => effect.combatantId === id,
                )
                const damage = effects
                  .filter((effect) => effect.effectType === 'damage')
                  .reduce(
                    (total, effect) =>
                      total +
                      (typeof effect.before === 'number' && typeof effect.after === 'number'
                        ? Math.max(0, effect.before - effect.after)
                        : 0),
                    0,
                  )
                const healing = effects
                  .filter((effect) => effect.effectType === 'healing')
                  .reduce(
                    (total, effect) =>
                      total +
                      (typeof effect.before === 'number' && typeof effect.after === 'number'
                        ? Math.max(0, effect.after - effect.before)
                        : 0),
                    0,
                  )
                const primary = preview.primaryCombatantId === id
                return (
                  <article key={id} data-battle-target-forecast={id}>
                    {participant?.portraitAssetId ? (
                      <CharacterPortraitImage
                        imageUrl={participant.profileImageUrl}
                        fallbackAssetId={participant.portraitAssetId}
                        sizes="44px"
                        alt=""
                      />
                    ) : null}
                    <div>
                      <strong>{participant?.name ?? `Target ${index + 1}`}</strong>
                      {primary && preview.hitChanceBasisPoints !== null ? (
                        <span>Hit {Math.round(preview.hitChanceBasisPoints / 100)}%</span>
                      ) : null}
                      {damage > 0 ? <span data-result="damage">Damage {damage}</span> : null}
                      {healing > 0 ? <span data-result="healing">Heal +{healing}</span> : null}
                      {effects
                        .filter(
                          (effect) =>
                            effect.effectType === 'apply-status' &&
                            typeof effect.after === 'string',
                        )
                        .map((effect, effectIndex) => (
                          <span key={effectIndex}>{gameplayStatusName(String(effect.after))}</span>
                        ))}
                      {effects.length === 0 ? <span>Included in affected area</span> : null}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}
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
              Projected result before execution. Damage with a hit chance assumes the hit lands.
            </p>
          </BattleInfoPopover>
        </>
      ) : skill ? (
        <>
          {skillChips.map((chip, index) => (
            <span
              key={index}
              className={
                chip.tone === 'effect' && chip !== skillTargetChip ? styles.secondary : undefined
              }
              data-battle-preview-chip="true"
              data-battle-preview-tone={chip.tone}
            >
              {chip.label}
            </span>
          ))}
          <span>{notice || 'Choose a target for the exact forecast.'}</span>
          <BattleInfoPopover label="Skill details" trigger="ⓘ" title={skill.name}>
            <div className={styles.details}>
              {skillChips.map((chip, index) => (
                <span key={index}>{chip.label}</span>
              ))}
            </div>
            {skill.effectDescriptions.map((description, index) => (
              <p key={index}>{description}</p>
            ))}
            {skill.requirementDescriptions.map((description, index) => (
              <p key={index}>{description}</p>
            ))}
            <p>
              Select a target to calculate the current result, including defenses, active effects
              and consecutive-use penalties.
            </p>
          </BattleInfoPopover>
        </>
      ) : (
        <span>{notice || 'Select a target to preview the result.'}</span>
      )}
    </div>
  )
}
