import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  parseAbilityDefinition,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import { AbilityDefinitionParameters } from './ability-definition-parameters'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { SkillEffectTimingProvider } from './skill-effect-timing-context'

const rows: { id: string; after: { ability: AbilityDefinition } }[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-18-modular-correction-cohort.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
const timingPolicy = {
  version: 8,
  tagAuthority: 'global' as const,
  modes: {
    'barrier-change': 'instant' as const,
    blindside: 'instant' as const,
    'return-to-turn-start': 'controlled' as const,
  },
}
it.each(rows)('$id uses the shared concise modular report and bold tags', (row) => {
  const definition = parseAbilityDefinition(row.after.ability)
  const before = JSON.stringify(definition)
  for (const behavior of definition.behaviors) {
    const report = abilityBehaviorInformation(behavior, { timingPolicy })
    expect(String(Object.fromEntries(report.rows).Target).length).toBeLessThanOrEqual(80)
    expect(Object.fromEntries(report.rows)['Skill Type']).toMatch(
      /^(Attack \[(Physical|Mystic)\]|Utility|Heal)$/,
    )
    expect(report.rows.map(([label]) => label)).toEqual([
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
    ])
    for (const [index, description] of report.effectDescriptions.entries()) {
      expect(description.length, `${row.id}: ${description}`).toBeLessThanOrEqual(300)
      expect(description, row.id).not.toMatch(
        /\blegal\b|captur|authored|packet|kernel|ordinals?|prepaid|settle/iu,
      )
      const payload = behavior.effects[index]!.payload
      if (!['damage', 'pierce'].includes(payload.type))
        expect(description, row.id).not.toMatch(/\d/u)
    }
  }
  const html = renderToStaticMarkup(
    <SkillEffectTimingProvider policy={timingPolicy}>
      <AbilityDefinitionParameters definition={definition} />
    </SkillEffectTimingProvider>,
  )
  expect(html).toMatch(/<strong[^>]*data-compact-effect-label="true"/)
  expect(html).not.toMatch(/\[(Stacks|Expiry):/)
  expect(JSON.stringify(definition)).toBe(before)
})
