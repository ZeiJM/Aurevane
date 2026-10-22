import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { AnyResonanceDefinition } from './resonance'
import { validateResonanceDefinition } from './resonance'
import { automaticAbilityExecutionRequirements } from './combat-simple-requirements'
import { evaluateAbilityRequirements } from './combat-requirements'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { prepareCombatAbilityCommand } from './combat-ability-command'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import {
  captureCombatAbilityMutation,
  createCombatAbilityEventSession,
  processCombatAbilityEvent,
} from './combat-ability-events'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'

const cohort = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/verification/release-assets/2026-10-22-resonance-owner-state-trigger-recovery.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  readonly records: readonly {
    readonly id: string
    readonly name: string
    readonly oldVersion: number
    readonly newVersion: number
    readonly before: AnyResonanceDefinition
    readonly after: AnyResonanceDefinition
  }[]
}

describe('owner-status automatic Resonance recovery', () => {
  it('covers Red Lightning and every other owner-status enemy-target damage-gated Resonance', () => {
    expect(cohort.records).toHaveLength(13)
    expect(new Set(cohort.records.map((row) => row.id)).size).toBe(13)
    expect(cohort.records.some((row) => row.name === 'Red Lightning')).toBe(true)
  })
  it.each(cohort.records)(
    '$name has one native opponent turn-start trigger and preserves range and effects',
    ({ before, after, oldVersion, newVersion }) => {
      expect(newVersion).toBe(oldVersion + 1)
      expect(after.contentVersion).toBe(newVersion)
      expect(after.id).toBe(before.id)
      expect(after.name).toBe(before.name)
      expect(after.disciplinePair).toEqual(before.disciplinePair)
      expect(after.media).toEqual(before.media)
      const original = before.ability!.behaviors[0]!
      const behavior = after.ability!.behaviors[0]!
      expect(behavior.activation).toBe('automatic')
      expect(behavior.mode).toBe('action')
      expect(behavior.requirementMode).toBe('simple')
      expect(behavior.requirements).toEqual(original.requirements)
      expect(behavior.targeting).toEqual(original.targeting)
      expect(behavior.costs).toEqual(original.costs)
      expect(behavior.effects).toEqual(original.effects)
      expect(behavior.cooldown).toEqual(original.cooldown)
      expect(behavior.activationLimits).toEqual(original.activationLimits)
      expect(original.automaticTrigger).toBe('damage-dealt')
      expect(original.automaticTarget?.subject).toBe('affected')
      expect(behavior.automaticTrigger).toBe('enemy-turn-started')
      expect(behavior.automaticTarget).toEqual({ subject: 'triggering' })
      expect(automaticAbilityExecutionRequirements(behavior)).toMatchObject({
        kind: 'all',
        children: expect.arrayContaining([
          { kind: 'event', eventType: 'turn_started', phase: 'after' },
          {
            kind: 'subject-relation',
            subject: 'triggering',
            otherSubject: 'owner',
            relation: 'enemy',
          },
          original.requirements,
        ]),
      })
      expect(validateResonanceDefinition(after)).toEqual([])
    },
  )

  it('Red Lightning schedules against the opposing turn start while owner has Reckless, without requiring outgoing damage', () => {
    const red = cohort.records.find((row) => row.name === 'Red Lightning')!.after
    const behavior = red.ability!.behaviors[0]!
    const captured = captureCombatAbilitySource(source({ ...behavior }, 'red-lightning-source'))
    const base = percentageDotEncounter()
    const withReckless = {
      ...base,
      statusState: [
        ...base.statusState.filter((row) => row.combatantId !== 'actor'),
        {
          combatantId: 'actor',
          statuses: [
            {
              statusId: 'reckless',
              statusVersion: 1,
              stacks: 1,
              sourceCombatantId: 'actor',
              remainingOwnerTurnStarts: 1,
            },
          ],
        },
      ],
    }
    const active = reconcileCombatAbilitySources(withReckless, [captured])
    const context = combatAbilityCommandContext(active, captured)
    const session = createCombatAbilityEventSession(context.triggerGuard)
    const mutation = captureCombatAbilityMutation(active, active, 'recruit-turn-ended', session, {
      events: [{ type: 'turn_started', phase: 'after' }],
      triggeringCombatantId: 'enemy',
      affectedCombatantIds: ['enemy'],
      resourceMutations: [],
    })
    let dispatched = 0
    const child = processCombatAbilityEvent(
      mutation.state,
      mutation.frame,
      PV1F_COMBAT_CONTENT,
      context,
      session,
      0,
      (input) => {
        dispatched += 1
        expect(input.actorId).toBe('actor')
        expect(input.selection).toEqual({ kind: 'unit', combatantId: 'enemy' })
        expect(input.trigger?.type).toBe('turn_started')
        expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
        return { state: input.state, events: [] }
      },
    )
    expect(dispatched).toBe(1)
    expect(child.events).toEqual([])
    // The same frame cannot fire twice even without an explicit outgoing Attack.
    processCombatAbilityEvent(
      mutation.state,
      mutation.frame,
      PV1F_COMBAT_CONTENT,
      context,
      session,
      0,
      () => {
        dispatched += 1
        throw new Error('repeat dispatch')
      },
    )
    expect(dispatched).toBe(1)
    const raw = automaticAbilityExecutionRequirements(behavior)!
    expect(
      evaluateAbilityRequirements(raw, {
        owner: { combatantId: 'actor', teamId: 'players', statusIds: [] },
      }),
    ).toBe(false)
  })
})
