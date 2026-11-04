import { expect, it } from 'vitest'
import {
  defaultBasicSkills,
  captureBasicSkillSources,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import {
  captureCombatAbilitySource,
  captureEquipmentAbilitySource,
} from '@aurevane/game-core/combat/combat-behavior-capture'
import { materializeCombatAbilityAction } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { defaultCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { basicActionCharacteristicRows } from './basic-action-presentation'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { skillEffectSummaries } from './skill-detail-presentation'
import { presentItem } from '@/lib/items/item-presentation'

it('shows Instant for standard native Skills, Basic Attack, weapon and consumable Damage without rewriting captures', () => {
  const skill = resolveMatureSkillVersion('vanguard.forceful-strike')!
  const before = JSON.stringify(skill)
  expect(skillEffectSummaries(skill)[0]).toContain('[Instant]')
  expect(
    Object.fromEntries(basicActionCharacteristicRows('basic.attack.unarmed.basic')).Effects,
  ).toContain('[Instant]')
  const basic = defaultBasicSkills().find((item) => item.id === 'unarmed.basic')!
  const basicSource = captureBasicSkillSources({
    ownerCombatantId: 'actor',
    supportActionId: 'basic.recover',
    definitions: defaultBasicSkills(),
  }).find((source) => source.basic?.id === 'unarmed.basic')!
  expect(
    abilityBehaviorInformation(basic.ability.behaviors[0]!, { basic }).effects[0]!.parts.timing,
  ).toBe('Instant')
  const sources = [basicSource]
  for (const itemId of ['iron-shortsword', 'emberflask']) {
    const item = starterItemDefinitions().find((item) => item.id === itemId)!
    const unit = {
      position: itemId === 'emberflask' ? ('consumable-1' as const) : ('main-hand' as const),
      ownedStackId: `private.${itemId}`,
      item,
    }
    const source = captureEquipmentAbilitySource(
      {
        schemaVersion: 2,
        inventoryRevision: 1,
        selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
        equipment: [unit],
      },
      unit,
      'actor',
    )!
    sources.push(source)
    expect(presentItem(item).reports[0]!.effects[0]!.parts.timing).toBe('Instant')
  }
  for (const source of sources) {
    const snapshot = JSON.stringify(source)
    const behavior = source.definition.behaviors.find(
      (behavior) => behavior.activation === 'manual',
    )!
    const beforeAction = materializeCombatAbilityAction(source, behavior)
    expect(abilityBehaviorInformation(behavior).effects[0]!.parts.timing).toBe('Instant')
    expect(materializeCombatAbilityAction(source, behavior)).toEqual(beforeAction)
    expect(JSON.stringify(source)).toBe(snapshot)
  }
  expect(JSON.stringify(skill)).toBe(before)
})

it.each(['delayed', 'controlled', 'next-round'] as const)(
  'reports authored %s Damage without substituting Instant or modifying its captured release clock',
  (timing) => {
    const base = defaultBasicSkills().find((item) => item.id === 'unarmed.basic')!.ability
      .behaviors[0]!
    const behavior = { ...base, effects: base.effects.map((effect) => ({ ...effect, timing })) }
    const source = captureCombatAbilitySource({
      schemaVersion: 1,
      sourceInstanceId: 'timing-test',
      ownerCombatantId: 'actor',
      abilityId: 'timing-test',
      contentVersion: 1,
      sourceKind: 'discipline-skill',
      tags: [],
      definition: { schemaVersion: 1, behaviors: [behavior] },
    })
    const before = JSON.stringify(source)
    const capturedBehavior = source.definition.behaviors[0]!
    const action = materializeCombatAbilityAction(source, capturedBehavior)
    const report = abilityBehaviorInformation(capturedBehavior, {
      timingPolicy: defaultCombatEffectTimingPolicy(),
    })
    expect(report.effects[0]!.parts.timing).toBe(
      timing === 'delayed' ? 'Delayed' : timing === 'controlled' ? 'Controlled' : undefined,
    )
    expect(Object.fromEntries(report.rows).Effects).not.toContain('[Instant]')
    expect(source.definition.behaviors[0]!.effects[0]!.timing).toBe(timing)
    expect(materializeCombatAbilityAction(source, capturedBehavior)).toEqual(action)
    expect(JSON.stringify(source)).toBe(before)
  },
)
