import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { canonicalAbilityTargetSpec } from '@aurevane/game-core/combat/combat-targeting-shapes'
import { presentItem } from '@/lib/items/item-presentation'
import type { BattleItemPresentation } from '@/lib/battle/battle-item-presentation'
import { abilityBehaviorInformation } from '../character/ability-detail-presentation'
import { BattleItemPicker } from './battle-item-picker'

vi.mock('./battle-info-popover', () => ({
  BattleInfoPopover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

it('renders each consumable slot with a compact captured Skill report and finite uses', () => {
  const definition = starterItemDefinitions().find((item) => item.id === 'mender-salve')!
  const behavior = definition.ability!.behaviors[0]!
  const item: BattleItemPresentation = {
    ownerCombatantId: 'owner',
    actionId: 'equipment.salve',
    contentVersion: definition.contentVersion,
    name: definition.name,
    description: 'Inventory flavour must not crowd the battle report.',
    enabled: true,
    iconKey: null,
    role: 'use',
    position: 'consumable-1',
    behaviorId: behavior.id,
    artworkSrc: '/media/art/items/mender-salve-v01.webp',
    item: presentItem(definition),
    remainingUses: 2,
    maximumUsesPerBattle: 3,
    unavailableReason: null,
    behaviors: [
      {
        ...abilityBehaviorInformation(behavior),
        behaviorId: behavior.id,
        classification: behavior.classification,
        costs: behavior.costs,
        cooldown: behavior.cooldown,
        target: canonicalAbilityTargetSpec(behavior.targeting!),
      },
    ],
  }
  const html = renderToStaticMarkup(
    <BattleItemPicker
      items={[item, { ...item, actionId: 'equipment.salve2', position: 'consumable-2' }]}
      disabled={false}
      onSelect={() => {}}
    />,
  )
  expect(html).toContain('Use Mender Salve, Consumable 1')
  expect(html).toContain('Use Mender Salve, Consumable 2')
  expect(html).toContain('2 uses left of 3 per battle')
  expect(html).toContain('width="48"')
  expect(html).toContain('/media/art/items/thumbnails/mender-salve-v01.webp')
  expect(html.match(/<dt>Cost<\/dt>/g)).toHaveLength(2)
  expect(html).toContain('aria-label="Effect explanations"')
  expect(html).toContain('data-effect-tag-label="true"')
  expect(html).not.toContain('<dt>Tier</dt>')
  expect(html).not.toContain('<dt>Maximum stack</dt>')
  expect(html).not.toContain('Inventory flavour')
  expect(html).not.toContain(' → ')
})
