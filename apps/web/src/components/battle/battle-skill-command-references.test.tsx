import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import {
  parseAbilityDefinition,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import { abilityBehaviorInformation } from '../character/ability-detail-presentation'
import { canonicalAbilityTargetSpec } from '@aurevane/game-core/combat/combat-targeting-shapes'
import { BattleSkillCommand } from './battle-skill-command'
import type { BattleBasicBehaviorPresentation } from '@/lib/battle/battle-basic-actions'
// Expose only the outer closed information reader to SSR; nested reference controls remain real.
vi.mock('./battle-info-popover', async (original) => {
  const real = await original<typeof import('./battle-info-popover')>()
  return {
    ...real,
    BattleInfoPopover: (props: Parameters<typeof real.BattleInfoPopover>[0]) =>
      props.label.startsWith('About ')
        ? (props.children as ReactNode)
        : createElement(real.BattleInfoPopover, props),
  }
})
const records: readonly { id: string; after: { ability: AbilityDefinition } }[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
function group(id: string) {
  return parseAbilityDefinition(records.find((row) => row.id === id)!.after.ability).behaviors[0]!
}
function behavior(id: string): BattleBasicBehaviorPresentation {
  const g = group(id)
  return {
    ...abilityBehaviorInformation(g),
    behaviorId: g.id,
    classification: g.classification,
    costs: g.costs,
    cooldown: g.cooldown,
    target: canonicalAbilityTargetSpec(g.targeting!),
  }
}
function reader(behaviors: readonly BattleBasicBehaviorPresentation[], behaviorId?: string) {
  return renderToStaticMarkup(
    <BattleSkillCommand
      slot="attack"
      hotkey="2"
      label="Captured action"
      cost="50 AP"
      artworkSrc="/attack.webp"
      active={false}
      disabled={false}
      onActivate={() => {}}
      behaviorId={behaviorId}
      basicAction={{
        ownerCombatantId: 'owner',
        actionId: 'basic.attack',
        contentVersion: 1,
        name: 'Captured action',
        description: 'Captured action',
        enabled: true,
        iconKey: null,
        behaviors,
      }}
    />,
  )
}
it('keeps multi-group prerequisite prefixes and conditional effect links in the native cockpit reader', () => {
  const html = reader([behavior('shadehand.exploit-opening'), behavior('shadehand.execution-cut')])
  expect(html.match(/data-combat-tag-reference="exposed"/g) ?? []).toHaveLength(2)
  expect(html.match(/data-combat-tag-reference="mark"/g) ?? []).toHaveLength(1)
  expect(html).toContain('exploit-opening: (')
  expect(html).toContain('; execution-cut: HP [≤ 35%] [Target]')
  expect(html).toContain('execution-cut: If ')
})
it('links only the selected captured group without borrowing other group prerequisites', () => {
  const html = reader(
    [behavior('shadehand.exploit-opening'), behavior('shadehand.execution-cut')],
    'execution-cut',
  )
  expect(html.match(/data-combat-tag-reference="exposed"/g) ?? []).toHaveLength(1)
  expect(html).not.toContain('data-combat-tag-reference="mark"')
  expect(html).not.toContain('exploit-opening:')
})
it('retains old captured plain prerequisites alongside linked groups', () => {
  const old = behavior('shadehand.exploit-opening')
  const { requirementParts: _optional, ...plain } = old
  void _optional
  const html = reader([
    {
      ...plain,
      behaviorId: 'old',
      rows: plain.rows.map(
        ([key, value]) =>
          [key, key === 'Requirements' ? 'Old <Marked> requirement' : value] as const,
      ),
    },
    behavior('shadehand.exploit-opening'),
  ])
  expect(html).toContain('old: Old &lt;Marked&gt; requirement; exploit-opening: (')
  expect(html.match(/data-combat-tag-reference="mark"/g) ?? []).toHaveLength(1)
})
