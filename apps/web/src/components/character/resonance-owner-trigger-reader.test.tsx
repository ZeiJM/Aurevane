import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { AbilityDefinitionParameters } from './ability-definition-parameters'
import { abilityBehaviorInformation } from './ability-detail-presentation'

const candidate = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/verification/release-assets/2026-10-22-resonance-owner-state-trigger-recovery.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  records: readonly { name: string; after: AnyResonanceDefinition }[]
}

describe('Resonance modular trigger visibility', () => {
  it.each(candidate.records)('$name displays an enemy turn-end event before the owner status', ({
    after,
  }) => {
    const behavior = after.ability!.behaviors[0]!
    const report = abilityBehaviorInformation(behavior)
    const expectedCondition = report.effects.map((effect) => effect.condition).filter(Boolean)
    const requirements = Object.fromEntries(report.rows).Requirements!
    const effects = Object.fromEntries(report.rows).Effects!
    expect(requirements).toMatch(/^Enemy Turn Ends; /)
    expect(requirements).toContain('[Self]')
    expect(requirements).not.toMatch(/\bIf\b|\bonly if\b/i)
    expect(effects).not.toMatch(/\bIf\b|\bonly if\b/i)
    expect(expectedCondition).toHaveLength(0)
    const html = renderToStaticMarkup(
      <AbilityDefinitionParameters definition={projectPublicCombat(after.ability!)} showActivationNotes={false} />,
    )
    expect(html).toContain('data-combat-tag-reference="trigger"')
    expect(html.indexOf('Enemy Turn Ends')).toBeLessThan(html.indexOf('Effects</dt>'))
    expect(html).not.toContain('Automatic: Enemy Turn Ends')
  })
})
