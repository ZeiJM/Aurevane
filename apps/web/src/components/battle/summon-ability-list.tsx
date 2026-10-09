'use client'

import type { SummonAbilityDefinition } from '@aurevane/game-core/combat/summon-content'
import { CompactSkillEffectSummary } from '../character/compact-skill-effect-summary'
import { SkillCharacteristicRows } from '../character/skill-characteristic-rows'
import {
  skillParameterRows,
  skillRequirementDescription,
  skillTargetMethodExplanation,
} from '../character/skill-detail-presentation'
import { groupSkillEffects } from '../character/skill-effect-groups'
import { skillPreviewEffects } from '../character/skill-effect-preview'
import {
  useSkillDotTriggerPolicyVersion,
  useSkillEffectTimingPolicy,
  useSkillGroundInteractionRules,
  SkillEffectTimingProvider,
} from '../character/skill-effect-timing-context'
import type { BattleSummonInspectMetadata } from './battle-summon-inspect'
import { BattleInfoPopover } from './battle-info-popover'
import cockpitStyles from './battle-skill-command.module.css'
import styles from './summon-ability-list.module.css'

/** Uses the summon profile captured in the battle, including its authored effects and targeting. */
function SummonAbilityParameters({
  ability,
  airborne,
}: {
  ability: SummonAbilityDefinition
  airborne: boolean
}) {
  const timingPolicy = useSkillEffectTimingPolicy()
  const groundRules = useSkillGroundInteractionRules()
  // Summon abilities have no authored cooldown; one ability per turn is a separate rule.
  const definition = { ...ability, cooldown: null }
  return (
    <dl>
      <SkillCharacteristicRows
        rows={skillParameterRows(definition, definition, timingPolicy, {
          ...groundRules,
          airborneAttackElevation: airborne && !groundRules.legacyAirborne,
        })}
        targetMethodExplanation={skillTargetMethodExplanation(ability)}
        effectSummary={
          ability.effects.length
            ? groupSkillEffects(ability.effects).map(({ effect, count, firstIndex }) => (
                <div key={firstIndex}>
                  <CompactSkillEffectSummary effect={effect} count={count} />
                </div>
              ))
            : 'N/A'
        }
      />
    </dl>
  )
}

function SummonAbilityDetails({ ability }: { ability: SummonAbilityDefinition }) {
  const groundRules = useSkillGroundInteractionRules()
  const dotTriggerPolicyVersion = useSkillDotTriggerPolicyVersion()
  const legacyTriggers = dotTriggerPolicyVersion === null
  const legacyPoisonMovement = dotTriggerPolicyVersion !== 2
  return (
    <>
      <p>{ability.description}</p>
      <ul aria-label="Effect explanations">
        {skillPreviewEffects(ability, { legacyTriggers, legacyPoisonMovement, ...groundRules }).map(
          (effect, index) => (
            <li key={index}>
              <strong>{effect.label}</strong> — {effect.explanation}
            </li>
          ),
        )}
      </ul>
      {ability.requirements.length ? (
        <>
          <strong>Requirement details</strong>
          <ul>
            {ability.requirements.map((requirement, index) => (
              <li key={index}>{skillRequirementDescription(requirement)}</li>
            ))}
          </ul>
        </>
      ) : null}
      <p>A summon can use one ability per turn.</p>
    </>
  )
}

/** Complete pinned report used inside the summon ability information popout. */
export function SummonAbilityReader({
  ability,
  airborne = false,
}: {
  ability: SummonAbilityDefinition
  airborne?: boolean
}) {
  return (
    <>
      <strong>Parameters</strong>
      <SummonAbilityParameters ability={ability} airborne={airborne} />
      <SummonAbilityDetails ability={ability} />
    </>
  )
}

export function SummonAbilityList({
  abilities,
  airborne = false,
  policies,
}: {
  abilities: readonly SummonAbilityDefinition[]
  airborne?: boolean
  policies: BattleSummonInspectMetadata['policies']
}) {
  return (
    <SkillEffectTimingProvider
      policy={policies.effectTimingPolicy ?? null}
      dotTriggerPolicyVersion={policies.dotTriggerPolicyVersion ?? null}
      frozenGroundPolicyVersion={policies.frozenGroundPolicyVersion ?? null}
      airbornePolicyVersion={policies.airbornePolicyVersion ?? null}
      healingDownPolicyVersion={policies.healingDownPolicyVersion ?? null}
      blindsideActivationPolicyVersion={policies.blindsideActivationPolicyVersion ?? null}
    >
      <div className={styles.list} aria-label="Summon abilities">
        {abilities.map((ability) => (
          <article className={styles.card} key={ability.id} data-summon-ability={ability.id}>
            <header>
              <strong>{ability.name}</strong>
              <BattleInfoPopover
                label={`About ${ability.name}`}
                title={ability.name}
                trigger="!"
                className={cockpitStyles.infoTrigger}
                hover
                consumeOutsideClick
                layer="inspect"
              >
                <SummonAbilityReader ability={ability} airborne={airborne} />
              </BattleInfoPopover>
            </header>
          </article>
        ))}
      </div>
    </SkillEffectTimingProvider>
  )
}
