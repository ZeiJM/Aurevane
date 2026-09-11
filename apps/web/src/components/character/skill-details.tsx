import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import {
  skillAffectedDescription,
  skillEffectDescription,
  skillRangeDescription,
  skillRequirementDescription,
  skillTargetTags,
} from './skill-detail-presentation'
import styles from './skill-details.module.css'

export function SkillDetails({ skill }: { skill: MatureSkillDefinition }) {
  return (
    <div className={styles.root} data-testid="skill-details">
      <div className={styles.tags} aria-label="Targeting and effects">
        {skillTargetTags(skill).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <details className={styles.details}>
        <summary>Skill details</summary>
        <dl>
          <div>
            <dt>Range</dt>
            <dd>{skillRangeDescription(skill)}</dd>
          </div>
          <div>
            <dt>Affects</dt>
            <dd>{skillAffectedDescription(skill)}</dd>
          </div>
          {skill.target.kind !== 'self' ? (
            <>
              <div>
                <dt>Line of sight</dt>
                <dd>{skill.target.requiresLineOfSight ? 'Required' : 'Not required'}</dd>
              </div>
              <div>
                <dt>Elevation gap</dt>
                <dd>
                  {skill.target.maximumElevationDifference === null
                    ? 'No limit'
                    : `Up to ${skill.target.maximumElevationDifference}`}
                </dd>
              </div>
            </>
          ) : null}
          <div>
            <dt>AP cost</dt>
            <dd>
              {skill.apCost}
              {skill.overrides.pvp?.apCost !== undefined &&
              skill.overrides.pvp.apCost !== skill.apCost
                ? ` · PvP ${skill.overrides.pvp.apCost}`
                : ''}
            </dd>
          </div>
        </dl>
        <strong>Effects, in order</strong>
        <ol>
          {skill.effects.map((effect, index) => (
            <li key={index}>{skillEffectDescription(effect)}</li>
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
      </details>
    </div>
  )
}
