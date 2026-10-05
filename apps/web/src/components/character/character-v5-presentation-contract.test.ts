import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('Combat v5 Nexus and Technique presentation contracts', () => {
  it('keeps Technique flavor text and one-line effect summaries in the focused preview', () => {
    const source = readFileSync(join(here, 'character-skill-build-panel.tsx'), 'utf8')

    expect(source).toContain('focusedSkill.definition.flavorLine')
    expect(source.replace(/\s+/gu, ' ')).toContain(
      'skillParameterRows( focusedSkill.definition, focusedSkill.definition, timingPolicy, copyPolicyVersion,',
    )
    const parameters = readFileSync(join(here, 'skill-detail-presentation.ts'), 'utf8')
    expect(parameters).toContain("'Skill Type': skillParameterTypeDescription(skill)")
    expect(parameters).toContain(
      'Cooldown: skillCooldownDescription(skill, costs.cooldownOwnerTurns)',
    )
    expect(parameters).toContain(
      'Effects: skillEffectsSummary(skill, timingPolicy, copyPolicyVersion)',
    )
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
