import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import {
  AirborneAttackElevationContext,
  SkillEffectTimingProvider,
} from '../character/skill-effect-timing-context'
import { SummonAbilityList, SummonAbilityReader } from './summon-ability-list'

const abilities = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!.abilities

const policies = { airbornePolicyVersion: 1 } as const

function Readers({
  abilities,
  policies,
  airborne = false,
}: Parameters<typeof SummonAbilityList>[0]) {
  return (
    <SkillEffectTimingProvider
      policy={policies.effectTimingPolicy ?? null}
      airbornePolicyVersion={policies.airbornePolicyVersion ?? null}
      dotTriggerPolicyVersion={policies.dotTriggerPolicyVersion ?? null}
      frozenGroundPolicyVersion={policies.frozenGroundPolicyVersion ?? null}
      healingDownPolicyVersion={policies.healingDownPolicyVersion ?? null}
      blindsideActivationPolicyVersion={policies.blindsideActivationPolicyVersion ?? null}
    >
      {abilities.map((ability) => (
        <article key={ability.id} data-summon-ability={ability.id}>
          <SummonAbilityReader ability={ability} airborne={airborne} />
        </article>
      ))}
    </SkillEffectTimingProvider>
  )
}

describe('pinned summon ability characteristics', () => {
  it('shows only ability names and accessible information triggers on the summon page', () => {
    const before = JSON.stringify(abilities)
    const markup = renderToStaticMarkup(
      <SummonAbilityList policies={policies} abilities={abilities} />,
    )
    expect(markup).toContain('Thorn Rake')
    expect(markup).toContain('Verdant Mend')
    expect(markup).toContain('aria-label="About Thorn Rake"')
    expect(markup).toContain('aria-label="About Verdant Mend"')
    expect(markup).not.toContain('<dt>')
    for (const ability of abilities) expect(markup).not.toContain(ability.description)
    expect(JSON.stringify(abilities)).toBe(before)
  })

  it('keeps the full characteristic sets and explanations inside the reader', () => {
    const markup = renderToStaticMarkup(<Readers policies={policies} abilities={abilities} />)
    for (const label of [
      'Skill Type',
      'Cost',
      'Cooldown',
      'Requirements',
      'Effects',
      'Range',
      'Target',
      'Target Method',
      'Target Elevation',
      'Line of Sight',
    ])
      expect(markup.match(new RegExp(`<dt>${label}</dt>`, 'g'))).toHaveLength(2)
    expect(markup).toContain('<dt>Cooldown</dt><dd>None</dd>')
    expect(markup).toContain('data-skill-attack-family="physical"')
    expect(markup).toContain('HP Recovery')
    expect(markup).toContain('A summon can use one ability per turn.')
  })

  it('reads captured costs, range and effects rather than the current registry', () => {
    const captured = {
      ...abilities[0]!,
      apCost: 17,
      target: { ...abilities[0]!.target, maximumRange: 4 },
      effects: [{ type: 'damage', recipient: 'primary-unit', amount: 9, durationTurns: 0 }],
    } as const
    const markup = renderToStaticMarkup(<Readers policies={policies} abilities={[captured]} />)
    expect(markup).toContain('<dt>Cost</dt><dd>17 AP</dd>')
    expect(markup).toContain('<dt>Range</dt><dd>4</dd>')
    expect(markup).toContain('[9]')
  })

  it('uses the inspected summon’s Airborne status for Attack elevation only', () => {
    const markup = renderToStaticMarkup(
      <Readers policies={policies} abilities={abilities} airborne />,
    )
    const cards = markup.split('data-summon-ability=')
    expect(cards[1]).toContain('<dt>Target Elevation</dt><dd>3</dd>')
    expect(cards[2]).not.toContain('<dt>Target Elevation</dt><dd>3</dd>')
  })

  it('does not inherit the active character’s Airborne elevation', () => {
    const markup = renderToStaticMarkup(
      <AirborneAttackElevationContext.Provider value>
        <Readers policies={policies} abilities={abilities} />
      </AirborneAttackElevationContext.Provider>,
    )
    expect(markup).not.toContain('<dt>Target Elevation</dt><dd>3</dd>')
  })

  it('reads the inspected battle’s timing even outside the active battle provider', () => {
    const markup = renderToStaticMarkup(
      <Readers
        policies={{
          effectTimingPolicy: { version: 6, modes: { healing: 'delayed' } },
        }}
        abilities={abilities}
      />,
    )
    expect(markup).toContain('[Delayed]')
    expect(markup).not.toContain('[Instant]')
  })

  it('keeps historical Airborne targeting limits', () => {
    const markup = renderToStaticMarkup(<Readers policies={{}} abilities={abilities} airborne />)
    expect(markup).not.toContain('<dt>Target Elevation</dt><dd>3</dd>')
  })
})
