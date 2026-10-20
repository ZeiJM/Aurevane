import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { finishPv1fTurn } from '../packages/game-core/src/combat/pv1f-action-economy'
import { source } from '../packages/game-core/src/combat/combat-behavior.test-utils'
import { commitCombatAbilityCommand } from '../packages/game-core/src/combat/combat-ability-command'
import { combatAbilitySubject } from '../packages/game-core/src/combat/combat-behavior-runtime'
import {
  identitySource,
  identityState,
  identityCommand,
  identityUnit,
  type IdentityRow,
} from '../packages/game-core/src/combat/essence-resonance-identity.test-utils'
import {
  parseAbilityDefinition,
  type AbilityDefinition,
} from '../packages/game-core/src/combat/combat-definition'
import {
  isSimpleRequirement,
  SIMPLE_AUTOMATIC_TRIGGER_OPTIONS,
  SIMPLE_REQUIREMENT_TAG_OPTIONS,
} from '../packages/game-core/src/combat/combat-simple-requirements'
import {
  validateEssenceDefinition,
  type EssenceDefinition,
} from '../packages/game-core/src/combat/essence'
import {
  validateResonanceDefinition,
  type AnyResonanceDefinition,
} from '../packages/game-core/src/combat/resonance'

type Row = {
  id: string
  kind: 'skill' | 'essence' | 'resonance' | 'basic'
  after: {
    contentVersion: number
    ability: AbilityDefinition
    [key: string]: unknown
  }
}
const file = (name: string) => new URL(`../docs/superpowers/specs/${name}.json`, import.meta.url)
const cohort = JSON.parse(readFileSync(file('2026-10-19-simple-requirements-cohort'), 'utf8')) as {
  records: Row[]
  designManifestSha256: string
  changes: { historyBefore: number; historyAfter: number; unchangedCurrentCount: number }
}
const design = JSON.parse(readFileSync(file('2026-10-19-simple-requirements-designs'), 'utf8')) as {
  registeredStatusIds: string[]
}

it('pins the new 166-version cohort, exact frozen registry and 953-history release boundary', () => {
  expect(cohort.records).toHaveLength(166)
  expect(new Set(cohort.records.map((row) => row.id)).size).toBe(166)
  expect(cohort.changes).toMatchObject({
    historyBefore: 787,
    historyAfter: 953,
    unchangedCurrentCount: 128,
  })
  expect(cohort.designManifestSha256).toBe(
    createHash('sha256')
      .update(readFileSync(file('2026-10-19-simple-requirements-designs')))
      .digest('hex'),
  )
  expect(
    SIMPLE_REQUIREMENT_TAG_OPTIONS.filter((option) =>
      design.registeredStatusIds.includes(option.id),
    ).map((option) => option.id),
  ).toEqual(design.registeredStatusIds)
})

it.each(cohort.records)(
  '$id validates with exactly one current native simple requirement',
  (row) => {
    const definition = parseAbilityDefinition(row.after.ability)
    for (const behavior of definition.behaviors) {
      expect(behavior.requirementMode).toBe('simple')
      expect(isSimpleRequirement(behavior.requirements)).toBe(true)
      if (behavior.automaticTrigger)
        expect(
          SIMPLE_AUTOMATIC_TRIGGER_OPTIONS.some(
            (option) => option.id === behavior.automaticTrigger,
          ),
        ).toBe(true)
      for (const effect of behavior.effects)
        expect(isSimpleRequirement(effect.requirements ?? null)).toBe(true)
    }
    if (row.kind === 'resonance')
      expect(validateResonanceDefinition(row.after as unknown as AnyResonanceDefinition)).toEqual(
        [],
      )
    if (row.kind === 'essence')
      expect(validateEssenceDefinition(row.after as unknown as EssenceDefinition)).toEqual([])
  },
)

it('preserves 136 distinct Resonance mechanics after removing identity-only fields', () => {
  const signatures = cohort.records
    .filter((row) => row.kind === 'resonance')
    .map((row) => {
      const behavior = structuredClone(row.after.ability.behaviors[0]!)
      return JSON.stringify({
        ...behavior,
        id: undefined,
        cooldown: behavior.cooldown ? { ownerTurns: behavior.cooldown.ownerTurns } : null,
        effects: behavior.effects.map(({ id: _id, ...effect }) => effect),
      })
    })
  expect(new Set(signatures).size).toBe(136)
})

it('Steamfront executes from Burn alone without a Tidecaller Heal or Drenched prerequisite', () => {
  const row = cohort.records.find(
    (entry) => entry.id === 'resonance.cinderweaver-tidecaller.linked-sequence',
  )!
  const resonance = identitySource(row as unknown as IdentityRow)
  const burn = {
    ...source(
      {
        id: 'self-burn',
        activation: 'manual',
        classification: 'utility',
        attackFamily: undefined,
        costs: [],
        requirements: null,
        targeting: {
          kind: 'self',
          teamPolicy: 'self',
          friendlyFire: 'allies-only',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 0,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          maximumSelections: 1,
        },
        effects: [
          {
            id: 'burn',
            payload: {
              type: 'apply-status',
              recipient: 'actor',
              statusId: 'burn',
              stacks: 1,
              durationTurns: 2,
            },
          },
        ],
      },
      'self-burn-source',
    ),
    tags: [],
  }
  const state = identityState([resonance, burn])
  expect(combatAbilitySubject(state, 'actor')!.statusIds).not.toContain('wet')
  const output = commitCombatAbilityCommand(identityCommand(state, burn, { kind: 'self' }))
  let settled = output.state as typeof state
  const turns = Array.from({ length: state.tactical.battle.combatants.length }, () => {
    const turn = finishPv1fTurn(settled, 'east')
    settled = turn.state
    return turn
  })
  const events = [...output.events, ...turns.flatMap((turn) => turn.events)]
  expect(combatAbilitySubject(settled, 'actor')!.statusIds).not.toContain('burn')
  expect(
    events.some(
      (event) =>
        event.event === 'effect_pending' &&
        event.effectTag === 'warded' &&
        event.actionId === row.id,
    ),
  ).toBe(true)
  expect(
    events.some(
      (event) => event.event === 'barrier_changed' && event.amount > 0 && event.actionId === row.id,
    ),
  ).toBe(true)
  expect(identityUnit(settled).mp).toBeLessThan(identityUnit(state).mp)
})
