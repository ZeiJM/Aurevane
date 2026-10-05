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
} from '../../lib/battle/combat-interaction-presentation'
import { battleGroundTargetPresentation, previewChips } from './battle-preview-content'
import type {
  BattlePresentationParticipant,
  BattleSkillForecastPresentation,
} from './battle-runtime'
import styles from './battle-action-preview.module.css'

function InlineTargetForecast({
  preview,
  combatantId,
  participant,
  includeTerrain,
}: {
  preview: ActionPreview
  combatantId: string
  participant?: BattlePresentationParticipant
  includeTerrain: boolean
}) {
  const effects = preview.projectedEffects.filter((effect) => effect.combatantId === combatantId)
  const recipientEvents = preview.projectedEvents?.filter(
    (event) =>
      ('targetCombatantId' in event && event.targetCombatantId === combatantId) ||
      ('combatantId' in event && event.combatantId === combatantId),
  )
  const recipientStatuses = preview.projectedStatuses.flatMap((status) => {
    const application = recipientEvents?.find(
      (event) => event.event === 'status_applied' && event.statusId === status.statusId,
    )
    if (application?.event === 'status_applied')
      return [{ ...status, durationOwnerTurnStarts: application.remainingOwnerTurnStarts }]
    // Older previews may lack events, but an actual recipient projection is still required.
    return preview.projectedEvents === undefined &&
      effects.some(
        (effect) => effect.effectType === 'apply-status' && effect.after === status.statusId,
      )
      ? [status]
      : []
  })
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
  const chanceLabel =
    preview.primaryCombatantId === combatantId
      ? previewChips(preview).find((chip) => chip.tone === 'chance')?.label
      : null
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
    chanceLabel,
    damage > 0 ? `${hitChance !== null && hitChance < 10000 ? 'On hit ' : ''}${damage} dmg` : null,
    healing > 0 ? `Heal +${healing}` : null,
    resourceChange !== 0 ? `Resource ${resourceChange > 0 ? '+' : ''}${resourceChange}` : null,
    ...previewChips({
      ...preview,
      projectedEffects: effects,
      projectedStatuses: recipientStatuses,
      projectedEvents: recipientEvents,
      projectedTerrain: [],
      affectedCombatantIds: [combatantId],
    })
      .filter(
        (chip) =>
          chip.tone === 'effect' &&
          !chip.label.endsWith('AP left') &&
          chip.label !== 'Terrain & effect details available',
      )
      .map((chip) => chip.label),
    ...(recipientEvents ?? []).map(combatInteractionDescription),
    ...(includeTerrain
      ? (preview.projectedTerrain ?? []).map(combatTerrainProjectionDescription)
      : []),
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
        <span
          className={styles.portraitFallback}
          data-battle-target-portrait-fallback="true"
          aria-hidden="true"
        >
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
  const ground = targetTile ? battleGroundTargetPresentation(targetTile, targetOverlay) : null
  const interactions =
    preview?.kind === 'action'
      ? [
          ...new Set(
            [
              ...(preview.projectedTerrain ?? []).map(combatTerrainProjectionDescription),
              ...(preview.projectedEvents ?? []).map(combatInteractionDescription),
            ].filter((description): description is string => Boolean(description)),
          ),
        ]
      : []
  const keyResults = chips.filter(
    (chip) =>
      chip.tone !== 'cost' &&
      !chip.label.endsWith('AP left') &&
      chip.label !== 'Terrain & effect details available',
  )
  const primaryTarget =
    preview?.kind === 'action'
      ? participants.find((item) => item.combatantId === preview.primaryCombatantId)
      : undefined
  return (
    <div
      className={styles.preview}
      data-battle-target-preview="true"
      data-react-battle-preview="true"
      data-battle-preview-has-targets={inlineForecasts.length > 0 ? 'true' : undefined}
      aria-label="Action preview"
      aria-live="polite"
    >
      {preview && !preview.legal && notice ? <span className={styles.notice}>{notice}</span> : null}
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
                {inlineForecasts.map(({ preview: targetPreview, combatantId }, index) => (
                  <InlineTargetForecast
                    key={combatantId}
                    preview={targetPreview}
                    combatantId={combatantId}
                    includeTerrain={
                      targetPreview.primaryCombatantId === combatantId ||
                      (targetPreview.primaryCombatantId === null && index === 0)
                    }
                    participant={participants.find((item) => item.combatantId === combatantId)}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.inlineChips}>
                {[...keyResults, ...interactions.map((label) => ({ label, tone: 'effect' }))].map(
                  (chip, index) => (
                    <span
                      key={index}
                      data-battle-preview-chip="true"
                      data-battle-preview-tone={chip.tone}
                      title={chip.label}
                    >
                      {chip.label}
                    </span>
                  ),
                )}
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
                  <span
                    className={styles.portraitFallback}
                    data-battle-target-portrait-fallback="true"
                    aria-hidden="true"
                  >
                    {primaryTarget.name.charAt(0)}
                  </span>
                )}
                <span>{primaryTarget.name}</span>
              </span>
            ) : null}
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
