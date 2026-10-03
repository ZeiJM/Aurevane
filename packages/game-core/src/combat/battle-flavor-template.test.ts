import { latestEnabledMatureSkills, validateMatureSkillDefinition } from './mature-skills'
import { validateSummonProfileDefinition } from './summon-content'
import { describe, expect, it } from 'vitest'
import {
  battleFlavorTemplateIssues,
  renderBattleFlavorTemplate,
  defaultSkillBattleText,
} from './battle-narration'

describe('versioned battle flavor templates', () => {
  it('gives every current Skill actor-led in-battle wording without mutating mechanics', () => {
    for (const skill of latestEnabledMatureSkills()) {
      const before = JSON.stringify(skill)
      const template = defaultSkillBattleText(skill)
      expect(template).toContain('{actor}')
      expect(battleFlavorTemplateIssues(template), skill.id).toEqual([])
      expect(JSON.stringify(skill)).toBe(before)
    }
  })
  it('rejects executable or unknown-token battle text in Skills and summon abilities', () => {
    const skill = latestEnabledMatureSkills().find((item) => item.summonProfile)!
    expect(
      validateMatureSkillDefinition({ ...skill, battleText: '<script>bad</script>' }),
    ).toContain('battleText')
    expect(
      validateSummonProfileDefinition({
        ...skill.summonProfile!,
        abilities: skill.summonProfile!.abilities.map((item) => ({
          ...item,
          battleText: '{secret}',
        })),
      }),
    ).toContain('abilities')
  })
  it('substitutes names, ability and explicitly supplied pronouns without inferring gender', () => {
    expect(
      renderBattleFlavorTemplate(
        '{actor} steadies {actor.possessive} blade before {target}; {actor.subject} answers with {ability}.',
        {
          actor: { name: 'Asha', pronounPresetId: 'she_her' },
          target: { name: 'Bryn' },
          ability: 'Quiet Edge',
        },
      ),
    ).toBe('Asha steadies her blade before Bryn; she answers with Quiet Edge.')
  })

  it('uses a neutral identity and gender branch for missing historical metadata', () => {
    expect(
      renderBattleFlavorTemplate(
        '{actor} braces {actor.reflexive}; {actor.gender:his|her|their} blade meets {target}.',
        { ability: 'Quiet Edge' },
      ),
    ).toBe('Combatant braces themself; their blade meets Combatant.')
  })

  it('handles authored gender wording only from an explicit supplied identity', () => {
    expect(
      renderBattleFlavorTemplate('{actor.gender:king|queen|sovereign} of the moment.', {
        actor: { name: 'Asha', gender: 'feminine' },
        ability: 'Quiet Edge',
      }),
    ).toBe('queen of the moment.')
  })

  it.each([
    '{actor.name.secret}',
    '{damage}',
    '{actor',
    '{actor.gender:he|she}',
    '{{actor}}',
    '<script>strike</script>',
    'Line\nbreak',
  ])('fails closed on unsafe or malformed template %s', (template) => {
    expect(battleFlavorTemplateIssues(template).length).toBeGreaterThan(0)
    expect(renderBattleFlavorTemplate(template, { ability: 'Quiet Edge' })).toBeNull()
  })

  it('keeps authored prose unchanged and treats inserted names as literal text', () => {
    expect(
      renderBattleFlavorTemplate('{actor} draws a pale arc.', {
        actor: { name: '{target}' },
        ability: 'Arc',
      }),
    ).toBe('{target} draws a pale arc.')
    expect(renderBattleFlavorTemplate('The blade holds its old promise.', { ability: 'Arc' })).toBe(
      'The blade holds its old promise.',
    )
    expect(battleFlavorTemplateIssues('x'.repeat(161))).not.toEqual([])
  })
})
