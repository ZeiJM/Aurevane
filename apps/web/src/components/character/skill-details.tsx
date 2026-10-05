'use client'

import {
  useSkillEffectTimingPolicy,
  useSkillCopyPolicyVersion,
} from './skill-effect-timing-context'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import {
  skillEffectDescription,
  skillCooldownDescription,
  skillParameterRows,
  skillRequirementDescription,
  skillTargetTags,
} from './skill-detail-presentation'
import styles from './skill-details.module.css'
import { SkillCharacteristicRows } from './skill-characteristic-rows'

function SkillDetailBody({ skill }: { skill: MatureSkillDefinition }) {
  const timingPolicy = useSkillEffectTimingPolicy()
  const copyPolicyVersion = useSkillCopyPolicyVersion()
  return (
    <>
      <dl>
        <SkillCharacteristicRows
          rows={skillParameterRows(skill, skill, timingPolicy, copyPolicyVersion)}
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
      <strong>Effects, in order</strong>
      <ol>
        {skill.effects.map((effect, index) => (
          <li key={index}>
            {effect.type === 'copy' && copyPolicyVersion !== null
              ? skillEffectDescription(effect, copyPolicyVersion)
              : skill.effectDescriptions?.[index]?.trim() ||
                skillEffectDescription(effect, copyPolicyVersion)}
          </li>
        ))}
      </ol>
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
