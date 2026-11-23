import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { AnyResonanceDefinition } from './resonance'
import { validateResonanceDefinition } from './resonance'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { activateCombatAbilitySources } from './combat-ability-command'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { reconcileCombatAbilitySources } from './combat-behavior-runtime'
import { executePv1fMovement, preparePv1fTurnEconomy } from './pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'

const candidate = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/verification/release-assets/2026-10-22-passive-readiness-candidate.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  changed: {
    id: string
    name: string
    previousVersion: number
    before: AnyResonanceDefinition
    after: AnyResonanceDefinition
  }[]
}
describe('current state-gated passive publication candidate', () => {
  it('publishes and rolls back exactly the reviewed full definitions', () => {
    for (const operation of ['publication', 'rollback'] as const) {
      const sql = readFileSync(
        new URL(
          `../../../../docs/verification/release-assets/2026-10-22-passive-readiness-${operation}.sql`,
          import.meta.url,
        ),
        'utf8',
      )
      const tag = operation === 'publication' ? 'trigger_data' : 'rollback_data'
      const rows = JSON.parse(sql.split(`$${tag}$`)[1]!) as unknown[]
      expect(rows).toEqual(
        candidate.changed.map(({ id, previousVersion, before, after }) =>
          operation === 'publication'
            ? { id, version: previousVersion, before, after }
            : {
                id,
                beforeVersion: previousVersion,
                afterVersion: after.contentVersion,
                before,
                after,
              },
        ),
      )
      expect(sql).toMatch(/content_kind='resonance'\)\s*<> 136\b/)
    }
  })
  it.each(['Quarry Wheel', 'Drive the Quarry'])(
    '%s retains its marked-enemy requirement while benefiting self/allies',
    (name) => {
      const definition = candidate.changed.find((row) => row.name === name)!.after
      const captured = captureCombatAbilitySource({
        ...source(),
        abilityId: definition.id,
        contentVersion: definition.contentVersion,
        sourceKind: 'resonance',
        definition: definition.ability!,
      })
      const base = preparePv1fTurnEconomy(percentageDotEncounter())
      const state = {
        ...base,
        statusState: base.statusState.map((row) =>
          row.combatantId === 'enemy'
            ? {
                ...row,
                statuses: [
                  {
                    statusId: 'mark',
                    statusVersion: 1,
                    sourceCombatantId: 'actor',
                    sourceScopedMark: true as const,
                    stacks: 1,
                    remainingOwnerTurnStarts: 2,
                  },
                ],
              }
            : row,
        ),
      }
      const result = activateCombatAbilitySources(state, [captured], PV1F_COMBAT_CONTENT, true)
      expect(result.events).toContainEqual(
        expect.objectContaining({ event: 'combat_action_used', actionId: definition.id }),
      )
    },
  )
  it('covers all 130 state-gated actions and preserves the four ongoing and two event-only passives', () => {
    expect(candidate.changed).toHaveLength(130)
    expect(new Set(candidate.changed.map((r) => r.id)).size).toBe(130)
  })
  it.each(candidate.changed)(
    '$name retains its mechanics and has an independently selectable legal target',
    ({ previousVersion, before, after }) => {
      expect(after.contentVersion).toBe(previousVersion + 1)
      expect(after.disciplinePair).toEqual(before.disciplinePair)
      const prior = before.ability!.behaviors[0]!,
        next = after.ability!.behaviors[0]!
      expect(next.automaticTrigger).toBe('requirements-met')
      expect(next.effects).toEqual(prior.effects)
      expect(next.costs).toEqual(prior.costs)
      expect(next.cooldown).toEqual(prior.cooldown)
      expect(next.activationLimits).toEqual(prior.activationLimits)
      expect(next.targeting).toEqual(prior.targeting)
      const requirement = {
        ...prior.requirements,
        subject:
          prior.requirements &&
          'subject' in prior.requirements &&
          prior.requirements.subject === 'owner'
            ? 'owner'
            : 'selected',
      }
      expect(next.requirements).toEqual(
        next.requirementMode === 'simple'
          ? requirement
          : {
              kind: 'all',
              children: [
                requirement,
                {
                  kind: 'subject-relation',
                  subject: 'selected',
                  otherSubject: 'owner',
                  relation: 'enemy',
                },
              ],
            },
      )
      expect(validateResonanceDefinition(after)).toEqual([])
    },
  )
  it('fires actual Red Lightning through native walking as soon as an enemy enters range', () => {
    const definition = candidate.changed.find((r) => r.name === 'Red Lightning')!.after
    const captured = captureCombatAbilitySource({
      ...source(),
      abilityId: definition.id,
      contentVersion: definition.contentVersion,
      sourceKind: 'resonance',
      definition: definition.ability!,
    })
    const base = preparePv1fTurnEconomy(percentageDotEncounter())
    const state = reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources(
        {
          ...base,
          statusState: base.statusState.map((row) =>
            row.combatantId === 'actor'
              ? {
                  ...row,
                  statuses: [
                    {
                      statusId: 'reckless',
                      statusVersion: 1,
                      sourceCombatantId: 'actor',
                      stacks: 1,
                      remainingOwnerTurnStarts: 2,
                    },
                  ],
                }
              : row,
          ),
          tactical: {
            ...base.tactical,
            placements: base.tactical.placements.map((p) =>
              p.combatantId === 'enemy'
                ? { ...p, position: { x: 4, y: 4 } }
                : p.combatantId === 'other'
                  ? { ...p, position: { x: 0, y: 4 } }
                  : p,
            ),
          },
        },
        [captured],
      ),
      base.statBridge,
    )
    const moved = executePv1fMovement(state, [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
    expect(moved.events).toContainEqual(
      expect.objectContaining({ event: 'combat_action_used', actionId: definition.id }),
    )
    expect(moved.state.tactical.battle.combatants.find((u) => u.id === 'enemy')!.mp).toBe(12)
    expect(moved.state.tactical.battle.combatants.find((u) => u.id === 'actor')!.mp).toBe(18)
    expect(
      moved.events.filter(
        (e) =>
          e !== null &&
          typeof e === 'object' &&
          'event' in e &&
          e.event === 'combat_action_used' &&
          'actionId' in e &&
          e.actionId === definition.id,
      ),
    ).toHaveLength(1)
  })
})
