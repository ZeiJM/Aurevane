import { describe, expect, it } from 'vitest'
import { battleFlavorTemplateIssues, renderBattleFlavorTemplate } from './battle-narration'

describe('versioned battle flavor templates', () => {
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
