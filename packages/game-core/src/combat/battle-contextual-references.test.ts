import { describe, expect, it } from 'vitest'
import * as narration from './battle-narration'

const context = {
  ability: 'Arc',
  actor: { name: 'Asha' },
  target: { name: 'Bryn' },
  affectedTargets: [{ name: 'Bryn' }, { name: 'Cora' }],
  triggeringActor: { name: 'Dara' },
  values: { '0.power': 12, '1.duration': 2 },
  outcomes: { damage: 37, healing: 0 },
}

describe('contextual references use the existing narration authority', () => {
  it('renders exact public values and recorded results without confusing power with damage', () => {
    expect(
      narration.renderBattleFlavorTemplate(
        '{actor}: {value.0.power} power; {outcome.damage} damage.',
        context,
      ),
    ).toBe('Asha: 12 power; 37 damage.')
  })
  it('renders plural recipients and an actual triggering actor', () => {
    expect(
      narration.renderBattleFlavorTemplate(
        '{trigger} affects {targets}; {targets.subject} {targets.be} ready.',
        context,
      ),
    ).toBe('Dara affects Bryn and Cora; they are ready.')
    expect(
      narration.renderBattleFlavorTemplate(
        '{targets.count} target: {targets.subject} {targets.be} ready.',
        {
          ...context,
          affectedTargets: [{ name: 'Bryn', pronounPresetId: 'she_her' as const }],
        },
      ),
    ).toBe('1 target: she is ready.')
  })
  it.each(['{trigger}', '{targets}', '{value.0.power}', '{outcome.damage}'])(
    'does not fabricate missing %s',
    (template) => {
      expect(narration.renderBattleFlavorTemplate(template, { ability: 'Arc' })).toBeNull()
    },
  )
  it.each([
    '{value.0.accuracy}',
    '{value.0.accuracyRule}',
    '{outcome.hitChance}',
    '{targets..count}',
    '{{targets}}',
  ])('rejects private or malformed %s', (template) => {
    expect(narration.battleFlavorTemplateIssues(template).length).toBeGreaterThan(0)
  })
  it('offers readable contextual choices and rejects result references during activation', () => {
    expect(narration.battleTextReferenceChoices).toBeTypeOf('function')
    if (!narration.battleTextReferenceChoices) return
    const choices = narration.battleTextReferenceChoices({
      field: 'activation',
      values: context.values,
    })
    expect(choices).toContainEqual(expect.objectContaining({ token: 'actor', label: 'User' }))
    expect(choices).toContainEqual(
      expect.objectContaining({ token: 'value.0.power', label: 'Effect 1 · power' }),
    )
    expect(choices.some((choice) => choice.token.startsWith('outcome.'))).toBe(false)
    expect(
      narration.battleTextContextIssues('{outcome.damage}', { field: 'activation' }),
    ).not.toEqual([])
    expect(
      narration.battleTextContextIssues('{value.1.duration}', {
        field: 'public',
        values: context.values,
      }),
    ).toEqual([])
    expect(
      narration.battleTextContextIssues('{value.2.power}', {
        field: 'public',
        values: context.values,
      }),
    ).not.toEqual([])
  })
  it('legacy result narration also rejects malformed braces and executable markup', () => {
    for (const template of ['{actor', '{{actor}}', '<script>hit</script>', 'Line\nbreak'])
      expect(narration.skillNarrationVariantIssues(template).length).toBeGreaterThan(0)
  })
})
