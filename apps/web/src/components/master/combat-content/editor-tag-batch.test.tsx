import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import { SkillEffectEditor } from './skill-effect-editor'
import { EffectTagPicker } from './effect-tag-picker'
import { SkillTargetingEditor } from './skill-targeting-editor'
import { ABILITY_EDITOR_SECTIONS } from '@/lib/ability-editor-sections'

const render = (value: CombatEffectDefinition) =>
  renderToStaticMarkup(<SkillEffectEditor value={value} onChange={() => {}} />)
it('combines execution controls in one tab', () => {
  expect(ABILITY_EDITOR_SECTIONS.map((row) => row.label)).toEqual([
    'Details & Text',
    'Media',
    'Range & Area',
    'Execution Characteristics',
    'Effects',
  ])
})
it.each(['covert', 'invisible', 'mark', 'root'])('hides stacks for %s', (statusId) => {
  expect(
    render({
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId,
      stacks: 1,
      durationTurns: 2,
    }),
  ).not.toContain('aria-label="Status stacks"')
})
it.each(['root', 'invisible', 'challenged'])(
  'fixes the redundant status selector for %s',
  (statusId) => {
    expect(
      render({
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId,
        stacks: 1,
        durationTurns: 2,
      }),
    ).not.toContain('aria-label="Status"')
  },
)
it('keeps Pull direction fixed while exposing distance', () => {
  const html = render({
    type: 'displace',
    recipient: 'primary-unit',
    direction: 'pull',
    distance: 3,
  })
  expect(html).not.toContain('aria-label="Push or Pull"')
  expect(html).toContain('aria-label="Tiles moved"')
})
it.each(['burn', 'bleed'] as const)('removes the Curse-copyable option from %s', (type) => {
  const value: CombatEffectDefinition =
    type === 'bleed'
      ? {
          type,
          recipient: 'primary-unit',
          ticks: 3,
          damageProfile: { kind: 'attack-percentage', basisPoints: 2000 },
        }
      : {
          type,
          recipient: 'primary-unit',
          durationTurns: 3,
          damageProfile: {
            kind: 'attack-percentage',
            basisPoints: 2500,
            decayBasisPointsPerTick: 500,
          },
        }
  expect(render(value)).not.toContain('Curse-copyable')
})
it('keeps help only in the picker rather than the editable tag area', () => {
  expect(
    render({ type: 'apply-status', recipient: 'primary-unit', statusId: 'root', stacks: 1 }),
  ).not.toContain('aria-label="About')
  expect(renderToStaticMarkup(<EffectTagPicker onAdd={() => {}} />)).toContain(
    'aria-label="About Damage"',
  )
})
it('allows a minimum of three and maximum of six, with minimum starting at one', () => {
  const html = renderToStaticMarkup(
    <SkillTargetingEditor
      v51Rules
      value={{
        kind: 'unit',
        teamPolicy: 'enemy',
        shape: { kind: 'single' },
        minimumRange: 3,
        maximumRange: 6,
        requiresLineOfSight: true,
        maximumElevationDifference: 1,
        friendlyFire: 'enemies-only',
      }}
      onChange={() => {}}
    />,
  )
  expect(html).toMatch(/aria-label="Minimum target range"[^>]*min="1"/)
  expect(html).not.toMatch(/aria-label="Maximum target range"[^>]*max="5"/)
  expect(html).toMatch(/aria-label="Maximum target range"[^>]*value="6"/)
})
it.each([
  ['wet', 'Initiative reduction (%)', 35],
  ['fortified', 'Defense increase / outgoing damage reduction (%)', 25],
  ['lowered-guard', 'Damage taken (%)', 175],
  ['haste', 'Movement AP reduction', 20],
  ['slow', 'Movement AP increase', 30],
] as const)('exposes the saved %s tuning field', (statusId, label, saved) => {
  const tuning =
    statusId === 'wet'
      ? { initiativeReductionBasisPoints: saved * 100 }
      : statusId === 'fortified'
        ? { defenseIncreaseBasisPoints: saved * 100 }
        : statusId === 'lowered-guard'
          ? { damageTakenMultiplierBasisPoints: saved * 100 }
          : { movementApAdjustment: saved }
  const html = render({
    type: 'apply-status',
    recipient: 'primary-unit',
    statusId,
    stacks: 1,
    durationTurns: 2,
    ...tuning,
  } as CombatEffectDefinition)
  expect(html).toContain(`aria-label="${label}"`)
  expect(html).toContain(`value="${saved}"`)
})
it('offers the captured extra Skill AP cost for Frozen Ground', () => {
  const html = render({
    type: 'create-terrain',
    recipient: 'affected-tiles',
    terrain: 'frozen',
    skillApSurcharge: 23,
  } as CombatEffectDefinition)
  expect(html).toContain('aria-label="Extra Skill AP cost"')
  expect(html).toContain('value="23"')
})
