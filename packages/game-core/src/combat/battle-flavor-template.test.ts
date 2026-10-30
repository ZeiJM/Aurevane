import { latestEnabledMatureSkills, validateMatureSkillDefinition } from './mature-skills'
import { validateSummonProfileDefinition } from './summon-content'
import { describe, expect, it } from 'vitest'
import {
  battleFlavorTemplateIssues,
  renderBattleFlavorTemplate,
  defaultSkillBattleText,
  battleTextContextIssues,
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

describe('simple writing tags', () => {
  it('renders actor aliases, target pronouns and explicit gender wording through the existing identities', () => {
    const template =
      '(name) uses (skill) on (target); (subject) steadies (possessive) hand, protects (object) and braces (reflexive). (gender:King|Queen|Sovereign) meets (target.subject).'
    const context = {
      actor: { name: 'Asha', pronounPresetId: 'she_her' as const, gender: 'feminine' as const },
      target: { name: 'Bryn', pronounPresetId: 'he_him' as const },
      ability: 'Quiet Edge',
    }
    expect(battleFlavorTemplateIssues(template, 300)).toEqual([])
    expect(renderBattleFlavorTemplate(template, context, 300)).toBe(
      'Asha uses Quiet Edge on Bryn; she steadies her hand, protects her and braces herself. Queen meets he.',
    )
    expect(
      renderBattleFlavorTemplate(
        '(name) uses (ability). (subject) braces (reflexive); (gender:his|her|their) blade waits.',
        { ability: 'Quiet Edge' },
      ),
    ).toBe('Combatant uses Quiet Edge. they braces themself; their blade waits.')
  })

  it('retains context restrictions and never invents values or recorded outcomes for simple tags', () => {
    const template = '(name) deals (outcome.damage) to (targets) with (value.0.power).'
    expect(battleTextContextIssues(template, { field: 'activation' }).length).toBeGreaterThan(0)
    expect(
      battleTextContextIssues(template, {
        field: 'result',
        outcomes: ['damage'],
        affectedTargets: true,
        values: { '0.power': 12 },
      }),
    ).toEqual([])
    expect(renderBattleFlavorTemplate(template, { ability: 'Arc' })).toBeNull()
    expect(
      renderBattleFlavorTemplate(template, {
        ability: 'Arc',
        outcomes: { damage: 37 },
        affectedTargets: [{ name: 'Bryn' }],
        values: { '0.power': 12 },
      }),
    ).toBe('Combatant deals 37 to Bryn with 12.')
    expect(renderBattleFlavorTemplate('(trigger) answers.', { ability: 'Arc' })).toBeNull()
  })

  it('leaves ordinary parentheses and historical brace contents intact without recursively expanding inserted names', () => {
    expect(
      renderBattleFlavorTemplate('A pale arc (once per turn) crosses the field (optional).', {
        ability: 'Arc',
      }),
    ).toBe('A pale arc (once per turn) crosses the field (optional).')
    expect(
      renderBattleFlavorTemplate('{actor} is {actor.gender:(king)|(queen)|(sovereign)}.', {
        actor: { name: '(target)', gender: 'feminine' },
        ability: 'Arc',
      }),
    ).toBe('(target) is (queen).')
    expect(
      renderBattleFlavorTemplate('(name) uses {ability} (with care).', {
        actor: { name: '(target)' },
        ability: 'Arc',
      }),
    ).toBe('(target) uses Arc (with care).')
  })

  it.each([
    '(actor.private)',
    '(target.gender:he|she)',
    '(gender:he|she)',
    '(outcome.secret)',
    '(value.0.secret)',
    '(name',
    '(gender:he|she|they',
    '(name)\nstrikes',
    '<b>(name)</b>',
  ])('rejects unsafe or malformed recognized tags: %s', (template) => {
    expect(battleFlavorTemplateIssues(template).length).toBeGreaterThan(0)
    expect(renderBattleFlavorTemplate(template, { ability: 'Arc' })).toBeNull()
  })

  it('enforces authored character limits before expanding aliases', () => {
    expect(battleFlavorTemplateIssues('(name)', 6)).toEqual([])
    expect(battleFlavorTemplateIssues('(name)', 5)).toContain(
      'Narration must be 5 characters or fewer.',
    )
  })
})
