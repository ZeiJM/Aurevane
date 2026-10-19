import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { parseCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { AbilityDefinitionParameters } from './ability-definition-parameters'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { MINIMUM_SKILL_INFORMATION_FIELDS } from './skill-information-contract'
import { SkillEffectTimingProvider } from './skill-effect-timing-context'

type Row = { id: string; kind: string; after: { ability: AbilityDefinition } }
const read = (name: string): Row[] =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../../docs/superpowers/specs/${name}.json`, import.meta.url),
      'utf8',
    ),
  ).records
const changes = read('2026-10-19-essence-resonance-identity-cohort')
const current = read('2026-10-18-modular-correction-cohort')
  .filter((row) => row.kind === 'essence' || row.kind === 'resonance')
  .map((row) => changes.find((change) => change.id === row.id) ?? row)
const policy = parseCombatEffectTimingPolicy({
  version: 8,
  tagAuthority: 'global',
  modes: {
    summon: 'instant',
    displace: 'instant',
    'mp-drain': 'instant',
    'remove-status': 'instant',
    'barrier-change': 'instant',
    blindside: 'instant',
    'return-to-turn-start': 'controlled',
  },
})

it.each(current)(
  'renders all current modular fields for $id without leaking private execution metadata',
  (row) => {
    const before = JSON.stringify(row)
    const definition = projectPublicCombat(row.after.ability)
    const html = renderToStaticMarkup(
      <SkillEffectTimingProvider policy={policy}>
        <AbilityDefinitionParameters definition={definition} />
      </SkillEffectTimingProvider>,
    )
    for (const behavior of definition.behaviors) {
      const report = abilityBehaviorInformation(behavior, { timingPolicy: policy })
      expect(report.rows.map(([field]) => field)).toEqual(MINIMUM_SKILL_INFORMATION_FIELDS)
      expect(report.effectDescriptions).toHaveLength(behavior.effects.length)
      expect(report.rows.every(([, value]) => value !== undefined && value !== '')).toBe(true)
      expect(html).toContain(`data-ability-behavior="${behavior.id}"`)
      for (const [field] of report.rows) expect(html).toContain(`>${field}<`)
    }
    expect(html).not.toMatch(
      /sourceInstanceId|automaticTarget|chanceBasisPoints|accuracyRule|coefficientBasisPoints|\[object Object\]|undefined/,
    )
    expect(html).not.toContain('Once per battle')
    expect(JSON.stringify(row)).toBe(before)
  },
)

it('keeps all Resonances passive and every Essence castable in the same public reader', () => {
  expect(current).toHaveLength(153)
  for (const row of current) {
    const types = row.after.ability.behaviors.map((behavior) => behavior.activation)
    if (row.kind === 'resonance') expect(types).not.toContain('manual')
    else expect(types).toContain('manual')
  }
})
