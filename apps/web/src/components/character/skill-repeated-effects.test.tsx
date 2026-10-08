import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import { skillEffectSummaries } from './skill-detail-presentation'
import { skillPreviewEffects } from './skill-effect-preview'
import { SkillDetails } from './skill-details'
import { ResonanceParameters } from './resonance-parameters'
import { normalizedResonanceMechanics } from '@aurevane/game-core/combat/resonance-v2'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'

describe('compact repeated effect reports', () => {
  it('shows current Sevenfold as one seven-application parameter and one explanation', () => {
    const sevenfold = resolveEssenceForBuild('edgedancer', null)!.skill
    expect(skillEffectSummaries(sevenfold)).toEqual(['Dmg [9] ×7'])
    expect(skillPreviewEffects(sevenfold)).toHaveLength(1)
    const html = renderToStaticMarkup(<SkillDetails skill={sevenfold} expanded />)
    expect(html).toContain('Dmg [9] ×7')
    expect(html.match(/Skill power ranges from 1 to 20/g)).toHaveLength(1)
    expect(sevenfold.effects).toHaveLength(7)
  })
  it('retains differing magnitudes, recipients and custom explanations', () => {
    const dmg: MatureSkillEffectDefinition = {
      type: 'damage',
      recipient: 'primary-unit',
      amount: 9,
    }
    const sevenfold = resolveEssenceForBuild('edgedancer', null)!.skill
    const definition = {
      ...sevenfold,
      effects: [
        dmg,
        { ...dmg },
        { ...dmg, amount: 8 },
        { ...dmg, recipient: 'actor' as const },
        { ...dmg },
      ],
      effectDescriptions: ['same', ' same ', '', '', 'distinct'],
    }
    expect(skillEffectSummaries(definition)).toEqual([
      'Dmg [9] ×2',
      'Dmg [8]',
      'Dmg [9]',
      'Dmg [9]',
    ])
    expect(skillPreviewEffects(definition).map((row) => row.explanation)).toContain('distinct')
  })
  it('keeps Resonance enemy recipient labels after grouping repeated self recovery', () => {
    const original = resolveResonanceForPair('vanguard', 'lifebinder')!
    const definition = {
      ...original,
      authoring: { ...original.authoring, schemaVersion: 2 as const },
      trigger: {
        kind: 'skill-trigger-v2' as const,
        mode: 'immediate' as const,
        setup: null,
        trigger: normalizedResonanceMechanics(original).trigger,
        aiSetupUtilityBonus: 0,
        aiTriggerUtilityBonus: 1,
        resultEffects: [
          { type: 'healing' as const, recipient: 'actor' as const, amount: 4 },
          { type: 'healing' as const, recipient: 'actor' as const, amount: 4 },
          { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 9 },
        ],
      },
    }
    const html = renderToStaticMarkup(<ResonanceParameters definition={definition} />)
    expect(html).toContain('data-compact-effect-count="2"')
    expect(html).toContain('Trigger Skill selected unit')
    expect(html.match(/data-compact-skill-effect="true"/g)).toHaveLength(2)
  })
})
