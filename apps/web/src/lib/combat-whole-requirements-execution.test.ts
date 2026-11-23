import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  prepareCombatAbilityCommand,
  commitCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  endCombatTurn,
  validateCombatEncounterState,
  type CombatEncounterState,
} from '@aurevane/game-core/combat/actions'
import { selectCurrentFinalFacing } from '@aurevane/game-core/combat/board'
import { percentageDotEncounter } from '../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'

const candidate = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/verification/release-assets/2026-11-03-whole-requirements-candidate.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  records: {
    id: string
    after: { contentVersion: number; ability: AbilityDefinition; tags: readonly string[] }
  }[]
}

it('Open Wound applies Bleed to a fresh enemy, ticks exactly three times and retains its captured state after reload', () => {
  const row = candidate.records.find((row) => row.id === 'ravager.open-wound')!
  const root = captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: 'source.open-wound',
    ownerCombatantId: 'actor',
    abilityId: row.id,
    contentVersion: row.after.contentVersion,
    sourceKind: 'discipline-skill',
    sourceDisciplineId: 'ravager',
    tags: row.after.tags,
    definition: row.after.ability,
  })
  let state: CombatEncounterState = preparePv1fTurnEconomy(percentageDotEncounter())
  state.tactical.placements.find((unit) => unit.combatantId === 'actor')!.facing = 'east'
  state.tactical.placements.find((unit) => unit.combatantId === 'enemy')!.facing = 'east'
  state = reconcileCombatAbilitySources(state, [root])
  const input = {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: root },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, root),
    manualModifiers: [],
  }
  expect(state.effectState?.bleed ?? []).toEqual([])
  expect(prepareCombatAbilityCommand(input).evaluation.issues).toEqual([])
  const committed = commitCombatAbilityCommand(input)
  const hits = committed.events.filter((event) => event.event === 'damage_applied')
  expect(hits.length).toBeGreaterThan(0)
  state = JSON.parse(JSON.stringify(committed.state)) as typeof state
  expect(state.effectState?.bleed).toHaveLength(1)
  expect(state.effectState!.bleed[0]).toMatchObject({
    targetCombatantId: 'enemy',
    remainingTicks: 3,
  })
  const tickEvents: unknown[] = []
  for (let count = 0; count < 20; count++) {
    const result = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
      PV1F_COMBAT_CONTENT,
    )
    tickEvents.push(
      ...result.events.filter(
        (event) => event.event === 'damage_applied' && event.statusId === 'bleed',
      ),
    )
    state = JSON.parse(JSON.stringify(result.state)) as typeof state
  }
  expect(tickEvents).toHaveLength(3)
  expect(state.effectState?.bleed ?? []).toEqual([])
  expect(validateCombatEncounterState(state)).toEqual([])
})

it.each(candidate.records)(
  'executes current $id through canonical admission and settlement when its visible whole prerequisites hold',
  (row) => {
    const root = captureCombatAbilitySource({
      schemaVersion: 1,
      sourceInstanceId: 'source.reviewed',
      ownerCombatantId: 'actor',
      abilityId: row.id,
      contentVersion: row.after.contentVersion,
      sourceKind: row.id.startsWith('essence.') ? 'essence' : 'discipline-skill',
      tags: row.after.tags ?? [],
      definition: row.after.ability,
    })
    const ready = (satisfy: boolean) => {
      let state: CombatEncounterState = preparePv1fTurnEconomy(percentageDotEncounter())
      state.tactical.placements.find((unit) => unit.combatantId === 'actor')!.facing = 'east'
      state.tactical.placements.find((unit) => unit.combatantId === 'enemy')!.facing = 'east'
      if ((root.definition.behaviors[0]!.targeting?.minimumRange ?? 0) >= 2) {
        state.tactical.placements.find((unit) => unit.combatantId === 'enemy')!.position = {
          x: 3,
          y: 0,
        }
      }
      if (row.id === 'wildwarden.close-quarry') {
        state.tactical.placements.find((unit) => unit.combatantId === 'enemy')!.position = {
          x: 2,
          y: 0,
        }
        state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.mp = 17
      }
      if (row.id === 'tidecaller.crushing-wave')
        state.tactical.placements.find((unit) => unit.combatantId === 'other')!.position = {
          x: 4,
          y: 4,
        }
      function configure(
        node: import('@aurevane/game-core/combat/combat-definition').RequirementNode | null,
      ) {
        if (!node) return
        if (node.kind === 'all' || node.kind === 'any') {
          node.children.forEach(configure)
          return
        }
        if (!('subject' in node)) return
        const id = node.subject === 'owner' ? 'actor' : 'enemy'
        if (node.kind === 'status-presence' && satisfy) {
          const owner = state.statusState.find((unit) => unit.combatantId === id)!
          owner.statuses = [
            ...owner.statuses,
            {
              statusId: node.statusId,
              statusVersion:
                PV1F_COMBAT_CONTENT.statuses.find((status) => status.id === node.statusId)
                  ?.version ?? 1,
              stacks: 1,
              remainingOwnerTurnStarts: 3,
              sourceCombatantId: 'actor',
              ...(node.statusId === 'mark' ? { sourceScopedMark: true as const } : {}),
            },
          ]
        }
        if (node.kind === 'resource-state') {
          const owner = state.tactical.battle.combatants.find((unit) => unit.id === id)!
          if (node.resource === 'hp') owner.hp = satisfy ? 300 : 1000
          else if (node.resource === 'mp') owner.mp = satisfy ? 20 : 0
        }
      }
      configure(root.definition.behaviors[0]!.requirements)
      state = reconcileCombatAbilitySources(state, [root])
      return {
        state,
        actorId: 'actor',
        root: { kind: 'canonical' as const, source: root },
        selection:
          root.definition.behaviors[0]!.targeting?.shape.kind === 'circle'
            ? { kind: 'activate' as const }
            : { kind: 'unit' as const, combatantId: 'enemy' },
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(state, root),
        manualModifiers: [],
        ...(row.id === 'wildwarden.close-quarry'
          ? {
              movementPath: [
                { x: 1, y: 1 },
                { x: 1, y: 0 },
              ],
            }
          : {}),
      }
    }
    if (root.definition.behaviors[0]!.requirements) {
      const blocked = ready(false)
      const before = JSON.stringify(blocked.state)
      expect(
        prepareCombatAbilityCommand(blocked).evaluation.issues.some(
          (issue) => issue.code === 'requirement-not-met',
        ),
      ).toBe(true)
      expect(() => commitCombatAbilityCommand(blocked)).toThrow()
      expect(JSON.stringify(blocked.state)).toBe(before)
    }
    const input = ready(true)
    expect(prepareCombatAbilityCommand(input).evaluation.issues).toEqual([])
    const result = commitCombatAbilityCommand(input)
    expect(
      result.events.some(
        (event) => event.event === 'damage_applied' && event.targetCombatantId === 'enemy',
      ),
    ).toBe(true)
    const programmedDamagePackets = root.definition.behaviors[0]!.effects.filter(
      (effect) => effect.payload.type === 'damage',
    ).length
    expect(
      result.events.filter(
        (event) =>
          event.event === 'damage_applied' &&
          event.targetCombatantId === 'enemy' &&
          !event.statusId,
      ).length,
    ).toBeGreaterThanOrEqual(programmedDamagePackets)
    if (row.id === 'frostweaver.brittle-ice')
      expect(
        result.state.statusState
          .find((unit) => unit.combatantId === 'enemy')!
          .statuses.some((status) => status.statusId === 'exposed'),
      ).toBe(true)
    if (row.id === 'tidecaller.crushing-wave')
      expect(
        result.state.tactical.placements.find((unit) => unit.combatantId === 'enemy')!.position,
      ).not.toEqual(
        input.state.tactical.placements.find((unit) => unit.combatantId === 'enemy')!.position,
      )
    if (row.id === 'wildwarden.close-quarry') {
      expect(
        result.state.tactical.placements.find((unit) => unit.combatantId === 'actor')!.position,
      ).toEqual({ x: 1, y: 0 })
      expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.mp).toBe(
        16,
      )
    }
  },
)
