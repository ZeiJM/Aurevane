import type { BattlePreviewView } from '@/server/battle/battle-preview-service'
import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { AurevaneImage } from '@/components/media/aurevane-image'
import {
  combatInteractionDescription,
  gameplayStatusName,
} from '../../lib/battle/combat-interaction-presentation'
import { BattleInfoPopover } from './battle-info-popover'
import { BattleSkillParameters } from './battle-skill-parameters'
import {
  battleGroundTargetPresentation,
  previewChips,
  skillPreviewChips,
} from './battle-preview-content'
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
      ? (preview.projectedEvents ?? []).map(combatInteractionDescription).filter(Boolean)
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
                    <span key={effectIndex}>{gameplayStatusName(String(effect.after))}</span>
                  ))}
                {effects.length === 0 ? <span>Included in affected area</span> : null}
              </div>
            </article>
          )
        })}
      </div>
    ) : null

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
      {skill ? (
        <div
          className={styles.parameters}
          data-battle-preview-lane="parameters"
          tabIndex={0}
          aria-label="Skill parameters"
        >
          {skillChips.map((chip, index) => (
            <span key={index} data-battle-preview-chip="true" data-battle-preview-tone={chip.tone}>
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}
      {pending ? (
        <div className={styles.forecast} data-battle-preview-lane="outcomes">
          <span>Calculating preview…</span>
        </div>
      ) : preview ? (
        <>
          <div
            className={styles.forecast}
            data-battle-preview-lane="outcomes"
            tabIndex={0}
            aria-label="Forecast outcomes"
          >
            {chips.map((chip, index) => (
              <span
                key={index}
                data-battle-preview-chip="true"
                data-battle-preview-tone={chip.tone}
              >
                {chip.label}
              </span>
            ))}
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
          </div>
          <BattleInfoPopover label="Forecast details" trigger="ⓘ" title="Action forecast">
            <div className={styles.details}>
              {chips.map((chip, index) => (
                <span key={index}>{chip.label}</span>
              ))}
            </div>
            {skill ? <BattleSkillParameters skill={skill} /> : null}
            <div className={styles.targetDetails}>{targets}</div>
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
          <div
            className={styles.forecast}
            data-battle-preview-lane="outcomes"
            tabIndex={0}
            aria-label="Target instructions"
          >
            <span>{notice || 'Choose a target for the exact forecast.'}</span>
          </div>
          <BattleInfoPopover label="Skill details" trigger="ⓘ" title={skill.name}>
            <BattleSkillParameters skill={skill} />
            <p>
              Select a target to calculate the current result, including defenses, active effects
              and consecutive-use penalties.
            </p>
          </BattleInfoPopover>
        </>
      ) : (
        <div
          className={styles.forecast}
          data-battle-preview-lane="outcomes"
          tabIndex={0}
          aria-label="Target instructions"
        >
          <span>{notice || 'Select a target to preview the result.'}</span>
        </div>
      )}
    </div>
  )
}
