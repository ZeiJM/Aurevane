'use client'

import type { BasicSkillDefinition } from '@aurevane/game-core/combat/combat-basic-actions'
import type { BasicActionCharacterStats } from './basic-action-presentation'
import { renderAbilityPresentationText } from '@aurevane/game-core/combat/battle-narration'
import { skillDisplayName } from './skill-detail-presentation'

import {
  useSkillGroundInteractionRules,
  useAirborneAttackElevation,
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
import { SkillGroundAreaDetails } from './skill-ground-area-details'
import styles from './skill-details.module.css'
import { SkillCharacteristicRows } from './skill-characteristic-rows'
import { CompactSkillEffectSummary, EffectTagLabel } from './compact-skill-effect-summary'
import { AbilityDefinitionParameters } from './ability-definition-parameters'
import { groupSkillEffects } from './skill-effect-groups'

function SkillDetailBody({ skill }: { skill: MatureSkillDefinition }) {
  const timingPolicy = useSkillEffectTimingPolicy()
  const groundRules = useSkillGroundInteractionRules()
  const airborneAttackElevation = useAirborneAttackElevation()
  const dotTriggerPolicyVersion = useSkillDotTriggerPolicyVersion()
  const legacyTriggers = dotTriggerPolicyVersion === null
  const legacyPoisonMovement = dotTriggerPolicyVersion !== 2
  return (
    <>
      <dl>
        <SkillCharacteristicRows
          rows={skillParameterRows(skill, skill, timingPolicy, {
            ...groundRules,
            airborneAttackElevation,
          })}
          targetMethodExplanation={skillTargetMethodExplanation(skill)}
          targetDetails={<SkillGroundAreaDetails skill={skill} />}
          effectSummary={
            skill.effects.length
              ? groupSkillEffects(skill.effects, skill.effectDescriptions).map(
                  ({ effect, count, firstIndex }, index) => (
                    <span key={firstIndex}>
                      {index > 0 ? ', ' : null}
                      <CompactSkillEffectSummary
                        effect={effect}
                        count={count}
                        skillEffects={skill.effects}
                      />
                    </span>
                  ),
                )
              : 'N/A'
          }
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
        {skillPreviewEffects(skill, {
          legacyTriggers,
          legacyPoisonMovement,
          ...groundRules,
          timingPolicy,
        }).map((effect, index) => (
          <li key={index}>
            <strong>
              <EffectTagLabel label={effect.label} />
            </strong>{' '}
            — {effect.explanation}
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
  basic,
  stats,
}: {
  skill: MatureSkillDefinition
  expanded?: boolean
  basic?: BasicSkillDefinition
  stats?: BasicActionCharacterStats
}) {
  const groundRules = useSkillGroundInteractionRules()
  const body = skill.ability ? (
    <AbilityDefinitionParameters
      definition={skill.ability}
      basic={basic}
      stats={stats}
      effectDescriptions={skill.effectDescriptions}
    />
  ) : (
    <SkillDetailBody skill={skill} />
  )
  return (
    <div className={styles.root} data-testid="skill-details">
      {skill.description ? <p>{skill.description}</p> : null}
      {renderAbilityPresentationText(skill, 'public', { ability: skillDisplayName(skill) }) ? (
        <p>
          {renderAbilityPresentationText(skill, 'public', { ability: skillDisplayName(skill) })}
        </p>
      ) : null}
      {!skill.ability ? (
        <div className={styles.tags} aria-label="Targeting and effects">
          {skillTargetTags(skill, groundRules).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      {expanded ? (
        <div className={[styles.details, styles.expanded].join(' ')}>{body}</div>
      ) : (
        <details className={styles.details}>
          <summary>Skill details</summary>
          {body}
        </details>
      )}
    </div>
  )
}
