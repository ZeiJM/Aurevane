import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  parseAbilityDefinition,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import { nativeCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import { materializeCombatAbilityAction } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { executeCombatAction, endCombatTurn } from '@aurevane/game-core/combat/actions'
import { selectCurrentFinalFacing } from '@aurevane/game-core/combat/board'
import { defaultCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { SkillDetails } from './skill-details'
import { previewEffect } from './skill-effect-preview'
import { skillEffectDescription } from './skill-detail-presentation'
import { AbilityDefinitionParameters } from './ability-definition-parameters'
import { ResonanceParameters } from './resonance-parameters'

interface Row {
  id: string
  after: { contentVersion: number; ability: AbilityDefinition }
}
const rows: Row[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
const statuses = [
  'guarded',
  'inspired',
  'hexed',
  'exposed',
  'suppress',
  'slow',
  'mark',
  'covert',
  'invisible',
  'root',
  'challenged',
  'fortified',
  'reckless',
  'warded',
  'frozen',
  'conductive',
] as const
const counts = [32, 2, 4, 9, 10, 14, 8, 7, 6, 15, 6, 6, 3, 4, 11, 17]
it.each(statuses)(
  'keeps all actual %s values structured and explains its purpose plainly',
  (statusId) => {
    let count = 0
    for (const row of rows) {
      const definition = parseAbilityDefinition(row.after.ability)
      const before = JSON.stringify(definition)
      for (const group of definition.behaviors) {
        const report = abilityBehaviorInformation(group)
        group.effects.forEach((effect, index) => {
          if (effect.payload.type !== 'apply-status' || effect.payload.statusId !== statusId) return
          count++
          expect(report.effects[index]!.parts).toMatchObject({
            details: expect.arrayContaining([
              { label: 'Stacks', value: String(effect.payload.stacks) },
            ]),
          })
          expect(report.effectDescriptions[index]).not.toMatch(/\d/)
        })
      }
      expect(JSON.stringify(definition)).toBe(before)
    }
    expect(count).toBe(counts[statuses.indexOf(statusId)])
  },
)

const clockCases = [
  [
    'resonance.chronist-frostweaver.linked-sequence',
    'frozen',
    'next-round',
    3,
    'Next global round boundary after matching damage settles',
  ],
  [
    'resonance.chronist-stormsinger.linked-sequence',
    'conductive',
    'delayed',
    5,
    'Two global round boundaries after matching damage settles',
  ],
] as const
it.each(clockCases)(
  'reports the actual captured packet clock for %s in local/public readers',
  (id, statusId, mode, activationRound, activation) => {
    const row = rows.find((r) => r.id === id)!
    const definition = parseAbilityDefinition(row.after.ability),
      group = definition.behaviors[0]!
    const index = group.effects.findIndex(
      (e) => e.payload.type === 'apply-status' && e.payload.statusId === statusId,
    )
    const before = JSON.stringify(row)
    // Exercise this exact materialized packet/capture clock, not learned-build admission or its costs.
    const source = captureCombatAbilitySource({
      schemaVersion: 1,
      sourceInstanceId: 'reader.' + id,
      ownerCombatantId: 'actor',
      abilityId: id,
      contentVersion: row.after.contentVersion,
      sourceKind: 'resonance',
      tags: ['resonance'],
      definition,
    })
    const action = materializeCombatAbilityAction(source, group)
    expect(action.effectTimingModes?.[index]).toBe(mode)
    let state = executeCombatAction(
      {
        ...percentageDotEncounter(),
        elementalDamagePolicyVersion: 2,
        effectTimingPolicy: defaultCombatEffectTimingPolicy(),
      },
      action,
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    ).state
    const status = () =>
      state.statusState
        .find((s) => s.combatantId === 'enemy')
        ?.statuses.find((s) => s.statusId === statusId)
    let turns = 0
    while (!status() && turns++ < 24)
      state = endCombatTurn(
        { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
        PV1F_COMBAT_CONTENT,
      ).state
    expect(state.tactical.battle.round).toBe(activationRound)
    expect(status()).toMatchObject({ durationScope: 'rounds', remainingRoundBoundaries: 2 })
    const report = abilityBehaviorInformation(group)
    expect(report.effects[index]!.parts).toMatchObject({
      duration: '2 full rounds',
      details: expect.arrayContaining([{ label: 'Activation', value: activation }]),
    })
    expect(report.effectDescriptions[index]).not.toContain('(Instant)')
    expect(report.effectDescriptions[index]).not.toContain('Activates')
    expect(report.effectDescriptions[index]).toContain('positive hostile HP damage')
    expect(report.effectDescriptions[index]).toContain('survives')
    for (const definition of [row.after, projectPublicCombat(row.after)]) {
      const html = renderToStaticMarkup(
        <ResonanceParameters definition={definition as unknown as AnyResonanceDefinition} />,
      )
      expect(html).toContain('[2 full rounds]')
      expect(html).toContain(activation)
      expect(html).not.toContain('Lasts 2 affected turns starting when damage settles (Instant)')
    }
    expect(JSON.stringify(row)).toBe(before)
  },
)
function withStatus(statusId: string, extra: Record<string, unknown> = {}) {
  const base = rows.find((r) => r.id === 'vanguard.brace')!.after.ability.behaviors[0]!
  return parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        effects: [
          {
            id: 'status',
            timing: 'instant',
            payload: {
              type: 'apply-status',
              recipient: 'actor',
              statusId,
              stacks: 1,
              durationTurns: 2,
              ...extra,
            },
          },
        ],
      },
    ],
  })
}
it.each([
  ['mark', 3, 1625, '+16.25 pp Accuracy'],
  ['fortified', 2, 1700, '−17% incoming / −17% outgoing'],
  ['reckless', 2, 1250, '+12.5% outgoing / +12.5% incoming'],
] as const)(
  'preserves captured %s magnitude units, direction and stack count',
  (statusId, stacks, potencyBasisPoints, magnitude) => {
    const definition = withStatus(statusId, { stacks, potencyBasisPoints })
    const report = abilityBehaviorInformation(definition.behaviors[0]!)
    expect(report.effects[0]!.parts).toMatchObject({
      magnitude,
      details: expect.arrayContaining([{ label: 'Stacks', value: String(stacks) }]),
    })
    const html = renderToStaticMarkup(
      <AbilityDefinitionParameters definition={projectPublicCombat(definition)} />,
    )
    expect(html).toContain(`[${magnitude}]`)
    expect(html).toContain(`[Stacks: ${stacks}]`)
    expect(report.effectDescriptions[0]).not.toMatch(/\d/)
  },
)
it('keeps a standalone elemental status independent of a matching damage gate', () => {
  const report = abilityBehaviorInformation(
    withStatus('conductive', { potencyBasisPoints: 2300 }).behaviors[0]!,
  )
  expect(report.effectDescriptions[0]).not.toContain('positive hostile HP damage')
  expect(report.effects[0]!.parts).toMatchObject({
    magnitude: '+23% Storm',
    duration: '2 affected turns',
    details: expect.arrayContaining([{ label: 'Activation', value: 'On effect activation' }]),
  })
})
it.each([true, false])(
  'retains captured old elemental policy prose (legacy=%s)',
  (legacyElemental) => {
    const definition = withStatus('conductive', { potencyBasisPoints: 2300 })
    const options = { legacyElemental, explicitElemental: false }
    const native = nativeCombatTagPayload(definition.behaviors[0]!.effects[0]!.payload)
    expect(
      abilityBehaviorInformation(definition.behaviors[0]!, { effectContext: options })
        .effectDescriptions[0],
    ).toBe(
      skillEffectDescription(native, {
        ...options,
        explicitElemental: false,
        rewindPrimeAnchor: false,
      }),
    )
  },
)
it.each([
  ['airborne', 'ironfist.breakfall', 5],
  ['blindside', 'shadehand.backstab', 5],
  ['haste', 'chronist.haste', 4],
  ['wet', 'tidecaller.water-lance', 7],
] as const)(
  'preserves the actual pinned historical %s reader (%s v%s)',
  (statusId, id, version) => {
    const skill = resolveMatureSkillVersion(id, version)!
    const before = JSON.stringify(skill)
    expect(skill.contentVersion).toBe(version)
    expect(skill.ability).toBeUndefined()
    const effect = skill.effects.find((e) => e.type === 'apply-status' && e.statusId === statusId)!
    const explanation = previewEffect(effect, {
      legacyTriggers: true,
      legacyPoisonMovement: true,
      skillEffects: skill.effects,
    }).explanation
    const html = renderToStaticMarkup(<SkillDetails skill={skill} />)
    expect(html).toContain(renderToStaticMarkup(<span>{explanation}</span>).slice(6, -7))
    expect(JSON.stringify(skill)).toBe(before)
  },
)

it.each([true, false])(
  'preserves the captured Healing Down scope (legacy=%s)',
  (legacyHealingDown) => {
    const group = withStatus('hexed', { potencyBasisPoints: 2500 }).behaviors[0]!
    const report = abilityBehaviorInformation(group, { effectContext: { legacyHealingDown } })
    expect(report.effects[0]!.parts.magnitude).toBe(
      legacyHealingDown ? '−25% healing' : '−25% HP/MP recovery',
    )
    expect(report.effectDescriptions[0]).toBe(
      legacyHealingDown ? 'Receive less healing.' : 'Receive less HP and MP recovery.',
    )
  },
)
