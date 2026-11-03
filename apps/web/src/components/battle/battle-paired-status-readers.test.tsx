import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { battleEffectStrengthInformation } from './battle-effect-strength-information'
import { BattleCombatantEffects } from './battle-combatant-effects'
import { canonicalStatusExplanation } from '../character/canonical-status-explanation'
import { previewEffect } from '../character/skill-effect-preview'
import {
  SkillEffectTimingProvider,
  useSkillGroundInteractionRules,
} from '../character/skill-effect-timing-context'
import { SkillEffectEditor } from '../master/combat-content/skill-effect-editor'

const fortified = {
  statusId: 'fortified',
  statusVersion: 1,
  stacks: 1,
  sourceCombatantId: 'actor',
  remainingOwnerTurnStarts: 2,
  defenseIncreaseBasisPoints: 1500,
  effectStackingPolicyVersion: 1 as const,
}
it('reports configured Fortified actual Defense and outgoing tradeoff without incoming mitigation', () => {
  const info = battleEffectStrengthInformation(fortified)
  expect(info.rows).toEqual(
    expect.arrayContaining([
      { label: 'Physical and Mystic Defense from this effect', magnitude: '115%' },
      { label: 'Outgoing damage from this effect', magnitude: '85%' },
    ]),
  )
  expect(info.rows.some((row) => row.label.startsWith('Incoming'))).toBe(false)
  const html = renderToStaticMarkup(<BattleCombatantEffects name="Actor" statuses={[fortified]} />)
  expect(html).toContain('Physical and Mystic Defense')
  expect(html).not.toContain('30%')
  expect(html).not.toContain('20%')
})
it('keeps literal historical Fortified readers', () => {
  const old = { ...fortified, defenseIncreaseBasisPoints: undefined }
  const info = battleEffectStrengthInformation(old)
  expect(info.rows.map((row) => row.magnitude)).toEqual(['70%', '80%'])
})
it('shows equal current defaults and literal historical Reckless preview', () => {
  const payload = {
    type: 'apply-status' as const,
    recipient: 'actor' as const,
    statusId: 'reckless',
    stacks: 1,
  }
  expect(previewEffect(payload).magnitude).toBe('+40% outgoing / +40% incoming')
  expect(previewEffect(payload, { legacyPairedStatus: true }).magnitude).toBe(
    '+40% outgoing / +25% incoming',
  )
  const html = renderToStaticMarkup(<SkillEffectEditor value={payload} onChange={() => {}} />)
  expect(html).toMatch(/aria-label="Status potency \(percent\)"[^>]*value="40"/)
})

it('combines each configured Fortified application independently', () => {
  const info = battleEffectStrengthInformation({
    ...fortified,
    stacks: 2,
    applicationModifiers: [
      { stacks: 1, sourceCombatantId: 'actor', defenseIncreaseBasisPoints: 1500 },
      { stacks: 1, sourceCombatantId: 'actor', defenseIncreaseBasisPoints: 2500 },
    ],
  })
  expect(info.rows).toEqual([
    { label: 'Physical and Mystic Defense from this effect', magnitude: '143.75%' },
    { label: 'Outgoing damage from this effect', magnitude: '63.75%' },
  ])
})

it.each([null, 1] as const)(
  'uses the captured policy in shared battle previews (policy=%s)',
  (policy) => {
    function Reader() {
      const rules = useSkillGroundInteractionRules()
      return (
        <span>
          {
            previewEffect(
              { type: 'apply-status', recipient: 'actor', statusId: 'reckless', stacks: 1 },
              rules,
            ).magnitude
          }
        </span>
      )
    }
    const html = renderToStaticMarkup(
      <SkillEffectTimingProvider policy={null} pairedStatusPolicyVersion={policy}>
        <Reader />
      </SkillEffectTimingProvider>,
    )
    expect(html).toContain(
      policy === 1 ? '+40% outgoing / +40% incoming' : '+40% outgoing / +25% incoming',
    )
  },
)

it('describes current default Fortified as Defense in full canonical readers', () => {
  const effect = {
    type: 'apply-status' as const,
    recipient: 'actor' as const,
    statusId: 'fortified',
    stacks: 1,
  }
  expect(canonicalStatusExplanation(effect, {})?.description).toContain(
    'Physical and Mystic Defense',
  )
  expect(canonicalStatusExplanation(effect, { legacyPairedStatus: true })?.description).toContain(
    'incoming and outgoing damage',
  )
})
