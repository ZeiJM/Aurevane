import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import {
  AUTHORABLE_EFFECT_TAGS,
  combatEffectIdentity,
  combatEffectPresentationId,
} from '@aurevane/game-core/combat/combat-effect-identities'
import {
  createAuthorableEffectPayload,
  effectAuthoringTag,
} from '@aurevane/game-core/combat/combat-effect-authoring'
import {
  validateCombatTagPayload,
  type CombatTagPresentationSnapshot,
} from '@aurevane/game-core/combat/combat-tag-registry'
import { combatEffectPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
import { previewEffect, previewEffectWithTag } from '../components/character/skill-effect-preview'
import { SkillEffectEditor } from '../components/master/combat-content/skill-effect-editor'
import { battleTagForStatus } from './battle/battle-tag-wording'
import { correctCombatContentEntries } from './combat-content-corrector'
import {
  parseStoredCombatEffectTimingPolicy,
  combatEffectTimingMode,
  currentCombatEffectTimingTag,
} from '@aurevane/game-core/combat/combat-effect-timing'
import { EFFECT_RULE_ROWS } from '../components/master/combat-content/effect-rule-rows'
import { isContentBrowserRecord } from '../components/master/combat-content/content-workspace-recovery'
import {
  executeCombatAction,
  type CombatActionDefinition,
} from '@aurevane/game-core/combat/actions'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import { percentageDotEncounter } from '../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'

const flat = {
  type: 'resource-change',
  recipient: 'actor',
  resource: 'mp',
  delta: 20,
  ticks: 3,
} as const
const percentage = {
  type: 'percentage-recovery',
  recipient: 'actor',
  resource: 'mp',
  percent: 20,
  ticks: 3,
} as const
const captured: CombatTagPresentationSnapshot = {
  tagId: 'mp-restore',
  contentKey: 'old.mp',
  contentVersion: 7,
  name: 'MP Restore',
  full: 'Saved flat recovery: {details}',
  compact: '{summary}',
}
it('offers one MP Recovery choice and no current MP Restore or Freeze Ground factory', () => {
  expect(
    AUTHORABLE_EFFECT_TAGS.filter((tag) => ['mp-restore', 'mp-recovery'].includes(tag.id)).map(
      (tag) => tag.id,
    ),
  ).toEqual(['mp-recovery'])
  expect(createAuthorableEffectPayload('mp-restore')).toBeNull()
  expect(createAuthorableEffectPayload('freeze-ground')).toBeNull()
  expect(effectAuthoringTag(flat)).toMatchObject({ id: 'mp-recovery', label: 'MP Recovery' })
  expect(isContentBrowserRecord({ contentKind: 'tag', contentKey: 'tag.mp-restore' })).toBe(false)
  expect(isContentBrowserRecord({ contentKind: 'tag', contentKey: 'tag.freeze-ground' })).toBe(
    false,
  )
  expect(isContentBrowserRecord({ contentKind: 'tag', contentKey: 'tag.mp-recovery' })).toBe(true)
  expect(EFFECT_RULE_ROWS.some((row) => ['mp-restore', 'freeze-ground'].includes(row.id))).toBe(
    false,
  )
})
it('roundtrips retained mechanical timing independently of the hidden current presentation choices', () => {
  const captured = {
    version: 7,
    tagAuthority: 'global' as const,
    modes: { 'create-terrain': 'delayed' as const, 'mp-recovery': 'next-round' as const },
  }
  const restored = parseStoredCombatEffectTimingPolicy(JSON.parse(JSON.stringify(captured)))
  expect(restored).toEqual(captured)
  expect(combatEffectTimingMode(restored, currentCombatEffectTimingTag(flat))).toBe('next-round')
  expect(combatEffectTimingMode(restored, 'create-terrain')).toBe('delayed')
})
it('uses one visible recovery name while preserving flat and percentage amounts and raw historical lookup', () => {
  expect(combatEffectIdentity(flat)).toMatchObject({
    label: 'MP Recovery',
    opcode: 'resource-change',
  })
  expect(combatEffectPresentationId(flat)).toBe('mp-restore')
  expect(validateCombatTagPayload(flat)).toEqual([])
  expect(combatEffectPresentationTags(flat)).toEqual(['MP Recovery [20]'])
  expect(previewEffect(flat)).toMatchObject({ label: 'MP Recovery', magnitude: '20' })
  expect(previewEffect(percentage)).toMatchObject({ label: 'MP Recovery', magnitude: '20%' })
  const original = structuredClone({ effects: [flat, percentage] })
  expect(correctCombatContentEntries('skill', original).definition).toEqual(original)
})
it('uses the old flat capture and current label without rebinding a percentage-only template', () => {
  const percentCapture = {
    ...captured,
    tagId: 'mp-recovery',
    name: 'MP Recovery',
    full: 'PERCENT ONLY',
    compact: 'PERCENT ONLY',
  }
  const result = previewEffectWithTag(flat, [percentCapture, captured])
  expect(result.label).toBe('MP Recovery')
  expect(result.explanation).toContain('Saved flat recovery:')
  expect(result.explanation).not.toContain('PERCENT ONLY')
  expect(result.explanation).not.toContain('20%')
  expect(result.tagPresentation).toMatchObject({ tagId: 'mp-restore', contentVersion: 7 })
  expect(captured.name).toBe('MP Restore')
  expect(
    battleTagForStatus([captured, percentCapture], {
      statusId: 'mp-recovery',
      recovery: { basis: 'flat', resource: 'mp', amount: 20 },
    } as never),
  ).toMatchObject({ name: 'MP Recovery', tagId: 'mp-restore', contentVersion: 7 })
})
it('labels retained flat recovery controls in MP amounts and applications, without mutating saved values', () => {
  const before = JSON.stringify(flat)
  const html = renderToStaticMarkup(
    createElement(SkillEffectEditor, { value: flat, onChange: vi.fn() }),
  )
  expect(html).toContain('aria-label="Amount (MP)"')
  expect(html).toContain('aria-label="Applications"')
  expect(html).toContain('value="20"')
  expect(html).not.toContain('MP delta')
  expect(JSON.stringify(flat)).toBe(before)
})
it.each([
  [flat, 20],
  [percentage, 10],
] as const)(
  'retains actual recovery after current editing and a saved encounter roundtrip: %j',
  (effect, expected) => {
    const initial = percentageDotEncounter()
    const state = JSON.parse(
      JSON.stringify({
        ...initial,
        tactical: {
          ...initial.tactical,
          battle: {
            ...initial.tactical.battle,
            combatants: initial.tactical.battle.combatants.map((unit) =>
              unit.id === 'actor' ? { ...unit, mp: 0, maxMp: 50 } : unit,
            ),
          },
        },
      }),
    ) as typeof initial
    const current = correctCombatContentEntries('skill', { effects: [effect] }).definition.effects
    const action: CombatActionDefinition = {
      id: 'test.mp-recovery',
      version: 1,
      sourceType: 'discipline-skill',
      tags: ['utility'],
      target: {
        kind: 'self',
        teamPolicy: 'self',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 0,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
        friendlyFire: 'allies-only',
      },
      cost: { spendsAction: false, mp: 0 },
      requirements: [],
      effects: current,
    }
    const result = executeCombatAction(state, action, { kind: 'self' }, PV1F_COMBAT_CONTENT)
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.mp).toBe(
      expected,
    )
    expect(previewEffect(effect).magnitude).toBe(effect === flat ? '20' : '20%')
    expect(current).toEqual([effect])
  },
)
