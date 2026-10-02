import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { skillPreviewEffects } from '../character/skill-effect-preview'
import { BattleSkillParameters } from './battle-skill-parameters'

describe('cockpit Skill Parameters', () => {
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
    expect(markup).toContain(skillPreviewEffects(definition)[0]!.explanation)
    expect(markup).not.toContain('Do not replace pinned Nexus effects')
    expect(markup).toContain('Legal range: 1 tile')
    expect(markup).toContain('Affects: Enemies only')
    expect(JSON.stringify(definition)).toBe(before)
  })
})
