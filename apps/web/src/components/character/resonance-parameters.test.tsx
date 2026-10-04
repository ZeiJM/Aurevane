import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { normalizedResonanceMechanics } from '@aurevane/game-core/combat/resonance-v2'
import { ResonanceParameters } from './resonance-parameters'

const fields = [
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
]

describe('shared Resonance parameter report', () => {
  it('preserves passive fields, sequence constraints and canonical result information', () => {
    const definition = resolveResonanceForPair('wildwarden', 'edgedancer')!
    const before = JSON.stringify(definition)
    const markup = renderToStaticMarkup(<ResonanceParameters definition={definition} />)
    expect([...markup.matchAll(/<dt>(.*?)<\/dt>/g)].slice(0, 10).map((match) => match[1])).toEqual(
      fields,
    )
    expect(markup).toContain('<dt>Skill Type</dt><dd>Passive · Resonance</dd>')
    for (const label of [
      'Cost',
      'Cooldown',
      'Range',
      'Target Method',
      'Target Elevation',
      'Line of Sight',
    ]) {
      expect(markup).toContain(`<dt>${label}</dt><dd>N/A</dd>`)
    }
    expect(markup).toContain('data-compact-effect-magnitude="true">[4]</span>')
    expect(markup).not.toContain('→ Self')
    expect(markup).toContain('Edgedancer · attack:')
    expect(markup).toContain('<dt>Requirements</dt><dd>Wildwarden · mark</dd>')
    expect([...markup.matchAll(/<dt>(.*?)<\/dt>/g)].map((match) => match[1])).toEqual(fields)
    expect(markup).toContain(
      '<ul aria-label="Effect explanations"><li>Restores MP to you.</li></ul>',
    )
    expect(markup).not.toContain('<p>')
    expect(markup).not.toContain('Trigger targeting:')
    expect(JSON.stringify(definition)).toBe(before)
  })

  it('uses the same effect magnitude and duration markup for mixed immediate Results', () => {
    const base = resolveResonanceForPair('farstrider', 'lifebinder')!
    const definition = {
      ...base,
      authoring: { ...base.authoring, schemaVersion: 2 as const },
      trigger: {
        kind: 'skill-trigger-v2' as const,
        mode: 'immediate' as const,
        setup: null,
        trigger: normalizedResonanceMechanics(base).trigger,
        aiSetupUtilityBonus: 0,
        aiTriggerUtilityBonus: 1,
        resultEffects: [
          { type: 'healing' as const, recipient: 'actor' as const, amount: 3 },
          {
            type: 'apply-status' as const,
            recipient: 'primary-unit' as const,
            statusId: 'exposed' as const,
            stacks: 1,
            durationTurns: 2,
            potencyBasisPoints: 2000,
          },
        ],
      },
    }
    const markup = renderToStaticMarkup(<ResonanceParameters definition={definition} />)
    expect(markup.match(/data-compact-skill-effect="true"/g)).toHaveLength(2)
    expect(markup).toContain('data-compact-effect-magnitude="true">[3]</span>')
    expect(markup).toContain('data-compact-effect-magnitude="true">[20%]</span>')
    expect(markup).toContain('data-compact-effect-duration="true">[2 Turns]</span>')
    expect(markup).toContain('→ Trigger Skill selected unit')
    expect(markup).toContain('<dt>Requirements</dt><dd>N/A</dd>')
    expect(markup).toContain('Restores HP to you.')
    expect(markup).toContain('Take 20% more damage per application.')
    expect(markup).not.toContain('next Discipline Skill')
  })

  it('renders battle-pinned historical Results without upgrading their version', () => {
    const definition = resolveResonanceForPair('lifebinder', 'vanguard', 1)!
    const before = JSON.stringify(definition)
    const markup = renderToStaticMarkup(<ResonanceParameters definition={definition} />)
    expect(markup).not.toContain('<dt>Mode</dt>')
    expect(markup).toContain('→ Trigger Skill selected unit')
    expect(markup).toContain('data-compact-skill-effect="true"')
    expect(markup).toContain('aria-label="Effect explanations"')
    expect(JSON.stringify(definition)).toBe(before)
  })

  it('keeps missing pinned metadata unavailable without fabricated effects or trigger details', () => {
    const markup = renderToStaticMarkup(<ResonanceParameters definition={null} />)
    expect([...markup.matchAll(/<dt>(.*?)<\/dt>/g)].map((match) => match[1])).toEqual(fields)
    expect(markup.match(/<dd>Unavailable<\/dd>/g)).toHaveLength(10)
    expect(markup).not.toContain('data-compact-skill-effect')
    expect(markup).not.toContain('Effect explanations')
    expect(markup).not.toContain('Trigger targeting')
  })
})
