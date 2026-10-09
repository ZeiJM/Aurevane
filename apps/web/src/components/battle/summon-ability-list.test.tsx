import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { AirborneAttackElevationContext } from '../character/skill-effect-timing-context'
import { SummonAbilityList } from './summon-ability-list'

const abilities = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!.abilities

const policies = { airbornePolicyVersion: 1 } as const

describe('pinned summon ability characteristics', () => {
  it('shows both complete characteristic sets and accessible information triggers', () => {
    const before = JSON.stringify(abilities)
    const markup = renderToStaticMarkup(
      <SummonAbilityList policies={policies} abilities={abilities} />,
    )
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
    expect(markup).toContain('aria-label="About Thorn Rake"')
    expect(markup).toContain('aria-label="About Verdant Mend"')
    expect(markup).toContain('<dt>Cooldown</dt><dd>None</dd>')
    expect(markup).toContain('data-skill-attack-family="physical"')
    expect(markup).toContain('HP Recovery')
    expect(JSON.stringify(abilities)).toBe(before)
  })

  it('reads captured costs, range and effects rather than the current registry', () => {
    const captured = {
      ...abilities[0]!,
      apCost: 17,
      target: { ...abilities[0]!.target, maximumRange: 4 },
      effects: [{ type: 'damage', recipient: 'primary-unit', amount: 9, durationTurns: 0 }],
    } as const
    const markup = renderToStaticMarkup(
      <SummonAbilityList policies={policies} abilities={[captured]} />,
    )
    expect(markup).toContain('<dt>Cost</dt><dd>17 AP</dd>')
    expect(markup).toContain('<dt>Range</dt><dd>4</dd>')
    expect(markup).toContain('[9]')
  })

  it('uses the inspected summon’s Airborne status for Attack elevation only', () => {
    const markup = renderToStaticMarkup(
      <SummonAbilityList policies={policies} abilities={abilities} airborne />,
    )
    const cards = markup.split('data-summon-ability=')
    expect(cards[1]).toContain('<dt>Target Elevation</dt><dd>3</dd>')
    expect(cards[2]).not.toContain('<dt>Target Elevation</dt><dd>3</dd>')
  })

  it('does not inherit the active character’s Airborne elevation', () => {
    const markup = renderToStaticMarkup(
      <AirborneAttackElevationContext.Provider value>
        <SummonAbilityList policies={policies} abilities={abilities} />
      </AirborneAttackElevationContext.Provider>,
    )
    expect(markup).not.toContain('<dt>Target Elevation</dt><dd>3</dd>')
  })

  it('reads the inspected battle’s timing even outside the active battle provider', () => {
    const markup = renderToStaticMarkup(
      <SummonAbilityList
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
    const markup = renderToStaticMarkup(
      <SummonAbilityList policies={{}} abilities={abilities} airborne />,
    )
    expect(markup).not.toContain('<dt>Target Elevation</dt><dd>3</dd>')
  })
})
