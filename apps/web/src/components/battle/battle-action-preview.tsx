'use client'

import type {
  BattleActionPreview as ActionPreview,
  BattlePreviewView,
} from '@/server/battle/battle-preview-service'
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

function InlineTargetForecast({
  preview,
  combatantId,
  participant,
}: {
  preview: ActionPreview
  combatantId: string
  participant?: BattlePresentationParticipant
}) {
  const effects = preview.projectedEffects.filter((effect) => effect.combatantId === combatantId)
  const damage = effects
    .filter((effect) => effect.effectType === 'damage')
    .reduce(
      (sum, effect) =>
        sum +
        (typeof effect.before === 'number' && typeof effect.after === 'number'
          ? Math.max(0, effect.before - effect.after)
          : 0),
      0,
    )
  const healing = effects
    .filter((effect) => effect.effectType === 'healing')
    .reduce(
      (sum, effect) =>
        sum +
        (typeof effect.before === 'number' && typeof effect.after === 'number'
          ? Math.max(0, effect.after - effect.before)
          : 0),
      0,
    )
  const hitChance = preview.primaryCombatantId === combatantId ? preview.hitChanceBasisPoints : null
  const resourceChange = effects
    .filter((effect) => effect.effectType === 'resource-change')
    .reduce(
      (sum, effect) =>
        sum +
        (typeof effect.before === 'number' && typeof effect.after === 'number'
          ? effect.after - effect.before
          : 0),
      0,
    )
  const result = [
    hitChance !== null ? `Hit ${Math.round(hitChance / 100)}%` : null,
    damage > 0 ? `${hitChance !== null && hitChance < 10000 ? 'On hit ' : ''}${damage} dmg` : null,
    healing > 0 ? `Heal +${healing}` : null,
    resourceChange !== 0 ? `Resource ${resourceChange > 0 ? '+' : ''}${resourceChange}` : null,
    ...effects
      .filter((effect) => effect.effectType === 'apply-status' && typeof effect.after === 'string')
      .map(
        (effect) => scheduledEffectPreviewLabel(effect) ?? gameplayStatusName(String(effect.after)),
      ),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <article className={styles.inlineTarget} data-battle-range-forecast={combatantId}>
      {participant?.portraitAssetId ? (
        <CharacterPortraitImage
          imageUrl={participant.profileImageUrl}
          fallbackAssetId={participant.portraitAssetId}
          sizes="32px"
          alt=""
        />
      ) : (
        <span className={styles.portraitFallback} aria-hidden="true">
          {participant?.name.charAt(0) || 'T'}
        </span>
      )}
      <strong title={participant?.name}>{participant?.name ?? 'Target'}</strong>
      <span title={result}>
        {result ||
          (preview.affectedCombatantIds.includes(combatantId)
            ? 'Included in affected area'
            : 'Legal target')}
      </span>
    </article>
  )
}

export function BattleActionPreview({
  preview: suppliedPreview,
  pending,
  notice,
  skill,
  participants = [],
  targetTile,
  targetOverlay,
  rangePreviews = [],
  rangePreviewsPending = false,
  rangePreviewActionId,
}: {
  preview: BattlePreviewView['preview'] | null
  pending: boolean
  notice?: string
  skill?: BattleSkillForecastPresentation | null
  participants?: readonly BattlePresentationParticipant[]
  targetTile?: { position: { x: number; y: number }; terrainId: string; elevation: number }
  targetOverlay?: 'frozen' | 'steam' | null
  rangePreviews?: readonly ActionPreview[]
  rangePreviewsPending?: boolean
  rangePreviewActionId?: string | null
}) {
  const selectedPreview =
    pending ||
    (rangePreviewActionId &&
      suppliedPreview?.kind === 'action' &&
      suppliedPreview.actionId !== rangePreviewActionId) ||
    (skill &&
      suppliedPreview &&
      (suppliedPreview.kind !== 'action' || suppliedPreview.actionId !== skill.id))
      ? null
      : suppliedPreview
  const eligiblePreviews = rangePreviews.filter(
    (candidate) =>
      candidate.legal &&
      candidate.actionId === rangePreviewActionId &&
      (!skill || candidate.actionId === skill.id),
  )
  const preview = selectedPreview ?? eligiblePreviews[0] ?? null
  // Alternatives are separate casts. A chosen area forecast owns its actual affected scope.
  const selectedAreaPreview =
    selectedPreview?.kind === 'action' &&
    selectedPreview.legal &&
    (selectedPreview.affectedCombatantIds.length > 1 || selectedPreview.affectedTiles.length > 1)
      ? selectedPreview
      : null
  const inlineForecasts = selectedAreaPreview
    ? selectedAreaPreview.affectedCombatantIds.map((combatantId) => ({
        preview: selectedAreaPreview,
        combatantId,
      }))
    : eligiblePreviews.length > 0
      ? eligiblePreviews.flatMap((candidate) =>
          candidate.primaryCombatantId
            ? [{ preview: candidate, combatantId: candidate.primaryCombatantId }]
            : [],
        )
      : selectedPreview?.kind === 'action' && selectedPreview.legal
        ? selectedPreview.affectedCombatantIds.map((combatantId) => ({
            preview: selectedPreview,
            combatantId,
          }))
        : []
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
  const renderTargets = (preview: ActionPreview) =>
    preview.legal ? (
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
  const targets = preview?.kind === 'action' ? renderTargets(preview) : null

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
      {preview?.kind === 'action' &&
      preview.defenseKind !== null &&
      preview.defenseRating !== null ? (
        <p>
          {preview.defenseKind === 'armor' ? 'Armor' : 'Ward'} {preview.defenseRating}
        </p>
      ) : null}
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
      {eligiblePreviews
        .filter(
          (candidate) =>
            preview?.kind !== 'action' ||
            candidate.primaryCombatantId !== preview.primaryCombatantId,
        )
        .map((candidate) => (
          <section
            key={candidate.primaryCombatantId}
            className={styles.alternativeDetails}
            data-battle-range-forecast-details={candidate.primaryCombatantId}
            aria-label={`Alternative forecast for ${participants.find((item) => item.combatantId === candidate.primaryCombatantId)?.name ?? 'target'}`}
          >
            <h4>
              {participants.find((item) => item.combatantId === candidate.primaryCombatantId)
                ?.name ?? 'Alternative target'}
            </h4>
            <div className={styles.detailChips}>
              {previewChips(candidate).map((chip, index) => (
                <span
                  key={index}
                  data-battle-preview-chip="true"
                  data-battle-preview-tone={chip.tone}
                >
                  {chip.label}
                </span>
              ))}
            </div>
            {candidate.defenseKind !== null && candidate.defenseRating !== null ? (
              <p>
                {candidate.defenseKind === 'armor' ? 'Armor' : 'Ward'} {candidate.defenseRating}
              </p>
            ) : null}
            {renderTargets(candidate)}
            {[
              ...new Set(
                [
                  ...(candidate.projectedTerrain ?? []).map(combatTerrainProjectionDescription),
                  ...(candidate.projectedEvents ?? []).map(combatInteractionDescription),
                ].filter(Boolean),
              ),
            ].map((description, index) => (
              <p key={index}>{description}</p>
            ))}
          </section>
        ))}
    </div>
  )
  return (
    <div
      className={styles.preview}
      data-battle-target-preview="true"
      data-react-battle-preview="true"
      data-battle-preview-has-parameters={skill ? 'true' : undefined}
      data-battle-preview-has-targets={inlineForecasts.length > 0 ? 'true' : undefined}
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
          {(preview && (!pending || eligiblePreviews.length > 0)
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
        {(pending || rangePreviewsPending) && inlineForecasts.length === 0 ? (
          <span>Calculating preview…</span>
        ) : preview ? (
          <>
            {inlineForecasts.length > 0 ? (
              <div
                className={styles.inlineTargets}
                aria-label={
                  selectedAreaPreview ? 'Affected target forecasts' : 'In-range target forecasts'
                }
              >
                {inlineForecasts.map(({ preview: targetPreview, combatantId }) => (
                  <InlineTargetForecast
                    key={combatantId}
                    preview={targetPreview}
                    combatantId={combatantId}
                    participant={participants.find((item) => item.combatantId === combatantId)}
                  />
                ))}
              </div>
            ) : (
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
            )}
            {inlineForecasts.length > 0 ? null : ground ? (
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
                    sizes="32px"
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
