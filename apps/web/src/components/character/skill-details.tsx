'use client'
import { combatGroundAreaDescription } from '@aurevane/game-core/combat/combat-ground-visuals'
import { combatEffectTimingMode } from '@aurevane/game-core/combat/combat-effect-timing'

import {
  useSkillEffectTimingPolicy,
  useSkillDotTriggerPolicyVersion,
} from './skill-effect-timing-context'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import {
  skillCooldownDescription,
  skillParameterRows,
  skillRequirementDescription,
  skillTargetTags,
  skillTargetMethodExplanation,
} from './skill-detail-presentation'
import { skillPreviewEffects } from './skill-effect-preview'
import styles from './skill-details.module.css'
import { SkillCharacteristicRows } from './skill-characteristic-rows'

function SkillDetailBody({ skill }: { skill: MatureSkillDefinition }) {
  const timingPolicy = useSkillEffectTimingPolicy()
  const legacyTriggers = useSkillDotTriggerPolicyVersion() === null
  return (
    <>
      <dl>
        <SkillCharacteristicRows
          rows={skillParameterRows(skill, skill, timingPolicy)}
          targetMethodExplanation={skillTargetMethodExplanation(skill)}
        />
        {skill.overrides.pvp?.apCost !== undefined &&
        skill.overrides.pvp.apCost !== skill.apCost ? (
          <div>
            <dt>PvP Cost</dt>
            <dd>
              {skill.overrides.pvp.apCost} AP{skill.mpCost ? ` / ${skill.mpCost} MP` : ''}
            </dd>
          </div>
        ) : null}
        {skill.cooldown !== null &&
        skill.overrides.pvp?.cooldownOwnerTurns !== undefined &&
        skill.overrides.pvp.cooldownOwnerTurns !== skill.cooldown.ownerTurns ? (
          <div>
            <dt>PvP Cooldown</dt>
            <dd>{skillCooldownDescription(skill, skill.overrides.pvp.cooldownOwnerTurns)}</dd>
          </div>
        ) : null}
      </dl>
      <strong>Effects</strong>
      <ol>
        {skillPreviewEffects(skill, timingPolicy, { legacyTriggers })
          .filter((effect) => effect.label !== 'Ground')
          .map((effect, index) => (
            <li key={index}>
              <strong>{effect.label}</strong> — {effect.explanation}
            </li>
          ))}
      </ol>
      {skill.groundArea ? (
        <p>
          {combatGroundAreaDescription(
            skill.groundArea,
            combatEffectTimingMode(timingPolicy ?? undefined, 'ground-area'),
          )}
        </p>
      ) : null}
      {skill.requirements.length ? (
        <>
          <strong>Requirements</strong>
          <ul>
            {skill.requirements.map((requirement, index) => (
              <li key={index}>{skillRequirementDescription(requirement)}</li>
            ))}
          </ul>
        </>
      ) : null}
      <p>
        Final results depend on combat stats and defenses. Consecutive reuse reduces effectiveness
        at the same AP cost. Battle previews show the current result.
      </p>
    </>
  )
}

export function SkillDetails({
  skill,
  expanded = false,
}: {
  skill: MatureSkillDefinition
  expanded?: boolean
}) {
  return (
    <div className={styles.root} data-testid="skill-details">
      <div className={styles.tags} aria-label="Targeting and effects">
        {skillTargetTags(skill).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      {expanded ? (
        <div className={[styles.details, styles.expanded].join(' ')}>
          <SkillDetailBody skill={skill} />
        </div>
      ) : (
        <details className={styles.details}>
          <summary>Skill details</summary>
          <SkillDetailBody skill={skill} />
        </details>
      )}
    </div>
  )
}
