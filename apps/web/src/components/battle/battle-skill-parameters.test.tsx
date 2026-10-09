import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { skillPreviewEffects } from '../character/skill-effect-preview'
import { BattleSkillParameters } from './battle-skill-parameters'
import { SkillEffectTimingProvider } from '../character/skill-effect-timing-context'

describe('cockpit Skill Parameters', () => {
  it.each([
    ['next-round', 'starting next round'],
    ['instant', 'starting immediately'],
    ['delayed', 'starting two rounds after cast'],
  ] as const)('separates Ground area rules from effects with %s timing', (mode, timing) => {
    const definition = resolveMatureSkillVersion('frostweaver.chilling-mist')!
    const before = JSON.stringify(definition)
    const markup = renderToStaticMarkup(
      <SkillEffectTimingProvider policy={{ version: 5, modes: { 'ground-area': mode } }}>
        <BattleSkillParameters
          skill={{
            definition,
            id: definition.id,
            name: 'Chilling Mist',
            apCost: definition.apCost,
            mpCost: definition.mpCost ?? 0,
            minimumRange: definition.target.minimumRange,
            maximumRange: definition.target.maximumRange,
            targetKind: definition.target.kind,
            targetTeamPolicy: definition.target.teamPolicy,
            tags: [],
            effectDescriptions: [],
            requirementDescriptions: [],
          }}
        />
      </SkillEffectTimingProvider>,
    )
    const effects = markup.match(/<ul aria-label="Effect explanations">([\s\S]*?)<\/ul>/)?.[1]
    expect(effects).toContain('<strong>Frozen Ground</strong>')
    expect(effects).toContain('<strong>Slow</strong>')
    expect(effects).toContain('<strong>Chilled</strong>')
    expect(effects).not.toContain('<strong>Ground</strong>')
    expect(effects).not.toContain('Each cast has its own allowance')
    expect(markup).toMatch(
      /<dt>Target<\/dt><dd>[\s\S]*?aria-label="Ground area rules"[\s\S]*?<\/dd>/,
    )
    expect(markup).not.toContain('<strong>Ground area</strong>')
    expect(markup.indexOf('aria-label="Ground area rules"')).toBeLessThan(
      markup.indexOf('aria-label="Effect explanations"'),
    )
    expect(markup).toContain(timing)
    expect(markup).toContain('Entry applies effects once per character’s turn')
    expect(JSON.stringify(definition)).toBe(before)
  })
  it.each(['cinderweaver.cinder-bolt', 'wildwarden.venom-shot'])(
    'reads historical trigger policy for %s',
    (id) => {
      const definition = resolveMatureSkillVersion(id)!
      expect(definition).toBeDefined()
      const markup = renderToStaticMarkup(
        <SkillEffectTimingProvider policy={null} dotTriggerPolicyVersion={null}>
          <BattleSkillParameters
            skill={{
              definition,
              id: definition.id,
              name: definition.id,
              apCost: 50,
              mpCost: 0,
              minimumRange: definition.target.minimumRange,
              maximumRange: definition.target.maximumRange,
              targetKind: definition.target.kind,
              targetTeamPolicy: definition.target.teamPolicy,
              tags: [],
              effectDescriptions: [],
              requirementDescriptions: [],
            }}
          />
        </SkillEffectTimingProvider>,
      )
      expect(markup).toContain(
        id.startsWith('cinder')
          ? '2 HP backlash once after each damaging command'
          : 'Every five traversed tiles',
      )
      expect(markup).not.toContain('at most once per turn')
      expect(markup).not.toContain('backlash equal to 10%')
    },
  )
  it('reads the committed definition with Nexus effects and effective battle costs', () => {
    const definition = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
    const before = JSON.stringify(definition)
    const markup = renderToStaticMarkup(
      <BattleSkillParameters
        skill={{
          definition,
          id: definition.id,
          name: 'Forceful Strike',
          apCost: 31,
          mpCost: 6,
          cooldownOwnerTurns: 1,
          minimumRange: 1,
          maximumRange: 1,
          targetKind: 'unit',
          targetTeamPolicy: 'enemy',
          tags: [],
          effectDescriptions: ['Do not replace pinned Nexus effects with this fallback.'],
          requirementDescriptions: [],
        }}
      />,
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
    ]) {
      expect(markup).toContain(`<dt>${label}</dt>`)
    }
    expect(markup).toContain('<strong>Parameters</strong>')
    expect(markup).toContain('31 AP')
    expect(markup).toContain('6 MP')
    expect(markup).toContain('<dt>Cooldown</dt><dd>1 turn</dd>')
    expect(markup.match(/data-compact-skill-effect="true"/g)).toHaveLength(
      definition.effects.length,
    )
    for (const effect of skillPreviewEffects(definition)) {
      expect(markup).toContain(`<strong>${effect.label}</strong>`)
      expect(markup).toContain(effect.explanation)
    }
    expect(markup).not.toContain('Do not replace pinned Nexus effects')
    expect(markup).not.toContain('Legal range')
    expect(markup).toContain('<dt>Range</dt><dd>1</dd>')
    expect(markup).toContain('<dt>Target</dt><dd>Enemy</dd>')
    expect(markup).not.toContain('Single target')
    expect(markup).not.toContain('Affects:')
    expect(markup).not.toContain('aria-label="Ground area rules"')
    expect(JSON.stringify(definition)).toBe(before)
  })
})
