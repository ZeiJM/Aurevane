'use client'

import type { BattlePreviewView } from '@/server/battle/battle-preview-service'
import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { AurevaneImage } from '@/components/media/aurevane-image'
import {
  combatInteractionDescription,
  combatTerrainProjectionDescription,
  gameplayStatusName,
} from '../../lib/battle/combat-interaction-presentation'
import {
  battleGroundTargetPresentation,
  previewChips,
  skillPreviewChips,
  scheduledEffectPreviewLabel,
} from './battle-preview-content'
import type {
  BattlePresentationParticipant,
  BattleSkillForecastPresentation,
} from './battle-runtime'
import styles from './battle-action-preview.module.css'
import { BattleInfoPopover } from './battle-info-popover'

export function BattleActionPreview({
  preview: suppliedPreview,
  pending,
  notice,
  skill,
  participants = [],
  targetTile,
  targetOverlay,
}: {
  preview: BattlePreviewView['preview'] | null
  pending: boolean
  notice?: string
  skill?: BattleSkillForecastPresentation | null
  participants?: readonly BattlePresentationParticipant[]
  targetTile?: { position: { x: number; y: number }; terrainId: string; elevation: number }
  targetOverlay?: 'frozen' | 'steam' | null
}) {
  const preview =
    skill &&
    suppliedPreview &&
    (suppliedPreview.kind !== 'action' || suppliedPreview.actionId !== skill.id)
      ? null
      : suppliedPreview
  const chips = preview ? previewChips(preview) : []
  const skillChips = skill ? skillPreviewChips(skill) : []
  const ground = targetTile ? battleGroundTargetPresentation(targetTile, targetOverlay) : null
  const interactions =
    preview?.kind === 'action'
      ? [
          ...new Set(
            [
              ...(preview.projectedTerrain ?? []).map(combatTerrainProjectionDescription),
              ...(preview.projectedEvents ?? []).map(combatInteractionDescription),
            ].filter(Boolean),
          ),
        ]
      : []
  const targets =
    preview?.kind === 'action' && preview.legal ? (
      <div className={styles.targets} aria-label="Affected target forecasts">
        {preview.affectedCombatantIds.map((id, index) => {
          const participant = participants.find((item) => item.combatantId === id)
          const effects = preview.projectedEffects.filter((effect) => effect.combatantId === id)
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
                  sizes="24px"
                  alt=""
                />
              ) : (
                <span
                  className={styles.portraitFallback}
                  data-battle-target-portrait-fallback="true"
                  aria-hidden="true"
                >
                  {participant?.name.charAt(0) || 'T'}
                </span>
              )}
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
                      effect.effectType === 'apply-status' && typeof effect.after === 'string',
                  )
                  .map((effect, effectIndex) => (
                    <span key={effectIndex}>
                      {scheduledEffectPreviewLabel(effect) ??
                        gameplayStatusName(String(effect.after))}
                    </span>
                  ))}
                {effects.length === 0 ? <span>Included in affected area</span> : null}
              </div>
            </article>
          )
        })}
      </div>
    ) : null

  const primaryResults = chips.filter((chip) =>
    ['chance', 'damage', 'heal', 'blocked'].includes(chip.tone),
  )
  const keyResults =
    preview?.kind !== 'action'
      ? chips.filter((chip) => chip.tone !== 'cost' && !chip.label.endsWith('AP left'))
      : [
          ...primaryResults,
          ...chips
            .filter(
              (chip) =>
                chip.tone === 'effect' &&
                chip.label.length <= 20 &&
                !chip.label.endsWith('AP left'),
            )
            .slice(0, Math.max(0, 3 - primaryResults.length)),
        ]
  const costs = chips.filter((chip) => chip.tone === 'cost' || chip.label.endsWith('AP left'))
  const compactParameters = skillChips.filter((chip) => /^Cost:|^Range:/.test(chip.label))
  const rangeParameter = skillChips.find((chip) => chip.label.startsWith('Range:'))
  const primaryTarget =
    preview?.kind === 'action'
      ? participants.find((item) => item.combatantId === preview.primaryCombatantId)
      : undefined
  const forecastDetails = (
    <div className={styles.details}>
      <div className={styles.detailChips}>
        {chips.map((chip, index) => (
          <span key={index} data-battle-preview-chip="true" data-battle-preview-tone={chip.tone}>
            {chip.label}
          </span>
        ))}
      </div>
      {ground && targetTile ? (
        <article
          className={styles.ground}
          data-battle-ground-target="true"
          aria-label={`Target tile ${targetTile.position.x + 1}, ${targetTile.position.y + 1}`}
        >
          <span
            className={styles.terrainThumbnail}
            data-terrain-overlay={targetOverlay || undefined}
          >
            <AurevaneImage assetId={ground.assetId} sizes="24px" />
            {ground.glyph ? <b aria-hidden="true">{ground.glyph}</b> : null}
          </span>
          <span>
            Tile {targetTile.position.x + 1}, {targetTile.position.y + 1} · {ground.label}
          </span>
        </article>
      ) : null}
      {targets}
      {preview?.issues.map((issue, index) => (
        <p key={issue.code ?? index} data-battle-preview-tone="blocked">
          {issue.message}
        </p>
      ))}
      {interactions.map((description, index) => (
        <p key={index}>{description}</p>
      ))}
    </div>
  )
  return (
    <div
      className={styles.preview}
      data-battle-target-preview="true"
      data-react-battle-preview="true"
      data-battle-preview-has-parameters={skill ? 'true' : undefined}
      aria-label="Action preview"
      aria-live="polite"
    >
      {preview && notice ? <span className={styles.notice}>{notice}</span> : null}
      <div
        className={styles.parameters}
        data-battle-preview-lane="parameters"
        aria-label="Skill parameters"
      >
        <div className={styles.inlineChips}>
          {(preview && !pending
            ? [...costs, ...(rangeParameter ? [rangeParameter] : [])]
            : compactParameters
          ).map((chip, index) => (
            <span key={index} data-battle-preview-chip="true" data-battle-preview-tone={chip.tone}>
              {chip.label}
            </span>
          ))}
        </div>
        {skill ? (
          <BattleInfoPopover
            consumeOutsideClick
            key={skill.id}
            label={`Show ${skill.name} parameters`}
            title={`${skill.name} parameters`}
            trigger="Parameters"
            className={styles.readingTrigger}
          >
            <dl>
              {skillChips.map((chip, index) => {
                const separator = chip.label.indexOf(': ')
                return (
                  <div key={index}>
                    <dt>{chip.label.slice(0, separator)}</dt>
                    <dd>{chip.label.slice(separator + 2)}</dd>
                  </div>
                )
              })}
            </dl>
          </BattleInfoPopover>
        ) : null}
      </div>
      <div
        className={styles.forecast}
        data-battle-preview-lane="outcomes"
        aria-label="Forecast outcomes"
      >
        {pending ? (
          <span>Calculating preview…</span>
        ) : preview ? (
          <>
            <div className={styles.inlineChips}>
              {keyResults.map((chip, index) => (
                <span
                  key={index}
                  data-battle-preview-chip="true"
                  data-battle-preview-tone={chip.tone}
                >
                  {chip.label}
                </span>
              ))}
            </div>
            {ground ? (
              <span className={styles.targetSummary} title={ground.label}>
                <span
                  className={styles.terrainThumbnail}
                  data-terrain-overlay={targetOverlay || undefined}
                >
                  <AurevaneImage assetId={ground.assetId} sizes="24px" />
                  {ground.glyph ? <b aria-hidden="true">{ground.glyph}</b> : null}
                </span>
                <span>
                  Tile {targetTile!.position.x + 1}, {targetTile!.position.y + 1}
                </span>
              </span>
            ) : primaryTarget ? (
              <span className={styles.targetSummary} title={primaryTarget.name}>
                {primaryTarget.portraitAssetId ? (
                  <CharacterPortraitImage
                    imageUrl={primaryTarget.profileImageUrl}
                    fallbackAssetId={primaryTarget.portraitAssetId}
                    sizes="24px"
                    alt=""
                  />
                ) : (
                  <span className={styles.portraitFallback} aria-hidden="true">
                    {primaryTarget.name.charAt(0)}
                  </span>
                )}
                <span>{primaryTarget.name}</span>
              </span>
            ) : null}
            <BattleInfoPopover
              consumeOutsideClick
              label="Show forecast details"
              title="Forecast details"
              trigger="Details"
              className={styles.readingTrigger}
            >
              {forecastDetails}
            </BattleInfoPopover>
          </>
        ) : (
          <span className={styles.instruction}>
            {notice || 'Choose a target for the exact forecast.'}
          </span>
        )}
      </div>
    </div>
  )
}
