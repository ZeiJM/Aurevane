import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  resolveResonanceForPair,
  type AnyResonanceDefinition,
} from '@aurevane/game-core/combat/resonance'
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

const currentResonances = (
  JSON.parse(
    readFileSync(
      new URL(
        '../../../../../docs/superpowers/specs/2026-10-19-simple-requirements-cohort.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ).records as { id: string; kind: string; after: AnyResonanceDefinition }[]
).filter(({ kind }) => kind === 'resonance')

it.each(currentResonances)(
  '$id keeps its fields and effects without redundant passive activation or usage notes',
  ({ after: definition }) => {
    const before = JSON.stringify(definition)
    const markup = renderToStaticMarkup(<ResonanceParameters definition={definition} />)
    expect([...markup.matchAll(/<dt>(.*?)<\/dt>/g)].map((match) => match[1])).toEqual(fields)
    expect(markup).toContain('aria-label="Effect explanations"')
    expect(markup.match(/data-compact-skill-effect="true"/g)).toHaveLength(
      definition.ability!.behaviors[0]!.effects.length,
    )
    expect(markup).not.toContain('Automatic:')
    expect(markup).not.toContain('aria-label="Usage limits"')
    expect(markup).not.toMatch(/Once per (action|owner turn|round|battle)/)
    if (definition.ability!.behaviors[0]!.requirements) {
      expect(markup).toContain('aria-label="Requirement explanations"')
      expect(markup).toMatch(/<strong[^>]*data-combat-tag-reference=/)
    }
    expect(JSON.stringify(definition)).toBe(before)
  },
)

describe('shared Resonance parameter report', () => {
  it('names exact Frozen Flare setup Skills without inventing a Control or Utility annotation', () => {
    const definition = resolveResonanceForPair('frostweaver', 'cinderweaver')!
    const before = JSON.stringify(definition)
    const markup = renderToStaticMarkup(<ResonanceParameters definition={definition} />)
    expect(markup).toContain('Ice Lance, Chilling Mist, Crystal Prison')
    expect(markup).not.toMatch(/Skills tagged Control|Skills tagged Utility/)
    expect(markup).toContain('Cinderweaver Skills tagged Attack')
    expect(JSON.stringify(definition)).toBe(before)
  })
  it('preserves passive fields, sequence constraints and canonical result information', () => {
    const definition = resolveResonanceForPair('wildwarden', 'edgedancer')!
    const before = JSON.stringify(definition)
    const markup = renderToStaticMarkup(<ResonanceParameters definition={definition} />)
    expect([...markup.matchAll(/<dt>(.*?)<\/dt>/g)].slice(0, 10).map((match) => match[1])).toEqual(
      fields,
    )
    expect(markup).toContain('<dt>Skill Type</dt><dd>Utility</dd>')
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
    expect(markup).toContain('data-compact-effect-magnitude="true">[4%]</span>')
    expect(markup).not.toContain('→ Self')
    expect(markup).toContain('Edgedancer Skills tagged Attack:')
    expect(markup).toContain('<dt>Requirements</dt><dd>Wildwarden Skills tagged Mark</dd>')
    expect([...markup.matchAll(/<dt>(.*?)<\/dt>/g)].map((match) => match[1])).toEqual(fields)
    expect(
      markup.replace(/<span[^>]*data-effect-tag-label="true">([^<]*)<\/span>/g, '$1'),
    ).toContain(
      '<ul aria-label="Effect explanations"><li><strong>MP Recovery</strong> — Restores a captured 4% of your maximum MP. The maximum and Healing Down adjustment are captured when cast; actual gains cap at the current maximum and never revive.</li></ul>',
    )
    expect(markup).toContain('Use a setup Skill from Requirements first.')
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
