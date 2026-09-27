import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('Combat v5 Nexus and Technique presentation contracts', () => {
  it('keeps Technique flavor text and one-line effect summaries in the focused preview', () => {
    const source = readFileSync(join(here, 'character-skill-build-panel.tsx'), 'utf8')

    expect(source).toContain('focusedSkill.definition.flavorLine')
    expect(source).toContain("['Skill Type', skillTypeDescription(focusedSkill.definition)]")
    expect(source).toContain("['Cooldown', skillCooldownDescription(focusedSkill.definition)]")
    expect(source).toContain("['Effects', skillEffectSummaries(focusedSkill.definition)]")
    expect(source).toContain('className={styles.effectSummaryList}')
    expect(source).toContain('aria-label="Effect explanations"')
  })

  it('keeps Essence and Resonance detail previews hoverable, keyboard-focusable and named', () => {
    const source = readFileSync(join(here, 'character-arsenal-shell.tsx'), 'utf8')
    const css = readFileSync(join(here, 'character-arsenal-shell.module.css'), 'utf8')

    expect(source).toContain('aria-label={`Preview Essence: ${essence.name}`}')
    expect(source).toContain('aria-describedby={`essence-preview-${essence.essenceId}`}')
    expect(source).toContain('aria-label={`Preview Resonance: ${resonance.name}`}')
    expect(source).toContain('aria-describedby={`resonance-preview-${resonance.id}`}')
    expect(source.match(/tabIndex=\{0\}/gu) ?? []).toHaveLength(2)
    expect(source).toContain('role="tooltip"')
    expect(source).toContain('EssenceHoverPreview')
    expect(source).toContain('ResonanceHoverPreview')

    expect(css).toContain('.attunementPreviewAnchor:hover > .attunementHover')
    expect(css).toContain('.attunementPreviewAnchor:focus-visible > .attunementHover')
    expect(css).toContain('.attunementPreviewAnchor:focus-within > .attunementHover')
    expect(css).toContain('.attunementPreviewAnchor:focus-visible {')
    expect(css).toContain('@media (max-width: 760px)')
  })
})
