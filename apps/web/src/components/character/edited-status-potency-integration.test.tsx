import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { AbilityDefinitionParameters } from './ability-definition-parameters'
import { compactSkillEffectSummaryParts } from './skill-detail-presentation'
import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { expect, it } from 'vitest'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import { SkillEffectEditor } from '@/components/master/combat-content/skill-effect-editor'
import { abilityBehaviorInformation } from '@/components/character/ability-detail-presentation'
const base = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records.find((r: { id: string }) => r.id === 'vanguard.brace').after.ability.behaviors[0]
function findStatusInput(node: ReactNode): ReactElement<{
  'aria-label': string
  onChange: (event: { currentTarget: { value: string } }) => void
}> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = findStatusInput(child)
      if (result) return result
    }
  }
  if (!isValidElement<{ 'aria-label'?: string; children?: ReactNode }>(node)) return null
  if (node.props['aria-label'] === 'Status') return node as ReturnType<typeof findStatusInput>
  return findStatusInput(node.props.children)
}
it.each(['airborne', 'root', 'covert', 'invisible', 'frozen'])(
  'does not invent potency after a real Master edit to %s',
  (statusId) => {
    const original: CombatEffectDefinition = {
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'guarded',
      durationTurns: 2,
      stacks: 1,
      potencyBasisPoints: 1500,
    }
    const before = JSON.stringify(original)
    let edited: CombatEffectDefinition | undefined
    const input = findStatusInput(
      SkillEffectEditor({
        value: original,
        onChange: (value) => {
          edited = value
        },
      }),
    )
    expect(input).not.toBeNull()
    input!.props.onChange({ currentTarget: { value: statusId } })
    expect(edited).toMatchObject({ statusId, potencyBasisPoints: 1500 })
    const definition = parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: [{ ...base, effects: [{ id: 'edited', payload: edited, timing: 'instant' }] }],
    })
    expect(
      abilityBehaviorInformation(definition.behaviors[0]!).effects[0]!.parts.magnitude,
    ).toBeNull()
    const html = renderToStaticMarkup(
      <AbilityDefinitionParameters definition={projectPublicCombat(definition)} />,
    )
    expect(html).not.toContain('[15%]')
    expect(
      compactSkillEffectSummaryParts(
        edited! as Parameters<typeof compactSkillEffectSummaryParts>[0],
      ).magnitude,
    ).toBeNull()
    expect(
      compactSkillEffectSummaryParts(
        edited! as Parameters<typeof compactSkillEffectSummaryParts>[0],
        undefined,
        { legacyElemental: true, explicitElemental: false },
      ).magnitude,
    ).toBeNull()
    expect(JSON.stringify(original)).toBe(before)
  },
)

it.each([
  ['guarded', 1500, '15%'],
  ['wet', 2750, '27.5%'],
  ['mark', 1625, '16.25%'],
  ['haste', 1500, '−10 AP'],
] as const)(
  'retains meaningful %s magnitude and native units',
  (statusId, potencyBasisPoints, magnitude) => {
    const payload = {
      type: 'apply-status',
      recipient: 'actor',
      statusId,
      durationTurns: 2,
      stacks: 1,
      potencyBasisPoints,
    }
    const definition = parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: [{ ...base, effects: [{ id: 'captured', payload, timing: 'instant' }] }],
    })
    expect(abilityBehaviorInformation(definition.behaviors[0]!).effects[0]!.parts.magnitude).toBe(
      magnitude,
    )
    const html = renderToStaticMarkup(
      <AbilityDefinitionParameters definition={projectPublicCombat(definition)} />,
    )
    expect(html).toContain(`[${magnitude}]`)
  },
)

it.each([
  ['guarded', 1700, '17%'],
  ['haste', 1500, '−10 AP'],
  ['slow', 1500, '+10 AP'],
  ['mark', 1625, '16.25%'],
] as const)(
  'keeps native %s units in compact and historical readers',
  (statusId, potencyBasisPoints, magnitude) => {
    const effect = {
      type: 'apply-status' as const,
      recipient: 'actor' as const,
      statusId,
      stacks: 1,
      durationTurns: 2,
      potencyBasisPoints,
    }
    expect(compactSkillEffectSummaryParts(effect).magnitude).toBe(magnitude)
    expect(
      compactSkillEffectSummaryParts(effect, undefined, {
        legacyElemental: true,
        explicitElemental: false,
      }).magnitude,
    ).toBe(magnitude)
  },
)

it.each([
  [true, '25%'],
  [false, '25%'],
] as const)(
  'keeps the captured Healing Down scope in compact readers (old=%s)',
  (legacyHealingDown, magnitude) => {
    const effect = {
      type: 'apply-status' as const,
      recipient: 'actor' as const,
      statusId: 'hexed',
      stacks: 1,
      durationTurns: 2,
      potencyBasisPoints: 2500,
    }
    expect(compactSkillEffectSummaryParts(effect, undefined, { legacyHealingDown }).magnitude).toBe(
      magnitude,
    )
  },
)
