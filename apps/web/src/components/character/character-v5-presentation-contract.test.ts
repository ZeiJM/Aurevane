import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { skillParameterRows, skillEffectsSummary } from './skill-detail-presentation'

const here = dirname(fileURLToPath(import.meta.url))

describe('Combat v5 Nexus and Technique presentation contracts', () => {
  it('keeps Technique flavor text and one-line effect summaries in the focused preview', () => {
    const source = readFileSync(join(here, 'character-skill-build-panel.tsx'), 'utf8')

    expect(source).toContain('focusedSkill.definition.flavorLine')
    expect(source.replace(/\s+/gu, ' ')).toContain(
      'skillParameterRows(focusedSkill.definition, focusedSkill.definition, timingPolicy)',
    )
    const parameters = readFileSync(join(here, 'skill-detail-presentation.ts'), 'utf8')
    expect(parameters).toContain("'Skill Type': skillParameterTypeDescription(skill)")
    expect(parameters).toContain(
      'Cooldown: skillCooldownDescription(skill, costs.cooldownOwnerTurns)',
    )
    const skill = {
      ...resolveMatureSkillVersion('tidecaller.water-lance')!,
      effects: [
        {
          type: 'damage' as const,
          recipient: 'primary-unit' as const,
          amount: 10,
          element: 'water' as const,
          durationTurns: 3,
        },
        {
          type: 'apply-status' as const,
          recipient: 'primary-unit' as const,
          statusId: 'wet',
          stacks: 1,
          durationTurns: 4,
          potencyBasisPoints: 4200,
        },
      ],
    }
    const capturedPolicy = { version: 7, modes: { wet: 'delayed' as const } }
    for (const explicitElemental of [true, false]) {
      const options = { explicitElemental }
      const effects = Object.fromEntries(
        skillParameterRows(skill, skill, capturedPolicy, options),
      ).Effects
      expect(effects).toBe(skillEffectsSummary(skill, capturedPolicy, options))
      expect(effects).toBe(
        `${explicitElemental ? 'Water Dmg [10]' : 'Water Dmg [10] [3 Turns]'}, Drenched [42%] [4 Turns] [Delayed]`,
      )
      expect(effects).not.toMatch(/\n/u)
    }
    expect(source).toContain('className={styles.effectSummaryList}')
    expect(source).toContain('aria-label="Effect explanations"')
  })

  it('keeps Essence and Resonance detail previews hoverable, keyboard-focusable and named', () => {
    const source = readFileSync(join(here, 'character-arsenal-shell.tsx'), 'utf8')
    const css = readFileSync(join(here, 'character-arsenal-shell.module.css'), 'utf8')

    expect(source).toContain('label={`Preview Essence: ${essence.name}`}')
    expect(source).toContain('id={`essence-preview-${essence.essenceId}`}')
    expect(source).toContain('label={`Preview Resonance: ${resonance.name}`}')
    expect(source).toContain('id={`resonance-preview-${resonance.id}`}')
    expect(source).toContain('role="tooltip"')
    expect(source).toContain('EssenceHoverPreview')
    expect(source).toContain('ResonanceHoverPreview')
    expect(source.match(/      hover/gu) ?? []).toHaveLength(2)
    expect(source.match(/<BattleInfoPopover/gu) ?? []).toHaveLength(2)

    expect(css).toContain('.attunementPreviewAnchor:focus-visible {')
    expect(css).toContain('@media (max-width: 760px)')
  })
})
