import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { percentageDotEncounter } from '../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { source } from '../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
  cancelCombatControlledAbility,
  combatAbilityCommandContext,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  commitCombatAbilityCommand,
  prepareCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import {
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { BattleSkillCommand } from '@/components/battle/battle-skill-command'
import type { CombatEncounterState } from '@aurevane/game-core/combat/actions'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { BattleSelectedSkills } from '@/components/battle/battle-selected-skills'
import type { BattleRuntime } from '@/components/battle/battle-runtime'
import { battleCapturedActionCost } from '@/components/battle/battle-captured-action-cost'
import {
  resolveBattleCapturedSkill,
  selectInitialBattleSkillPreviewIntent,
} from '@/components/battle/battle-preview-selection'
vi.mock('server-only', () => ({}))
import { projectBattleManualActionTargets } from '@/server/battle/battle-live-viewer-projection'
import {
  deriveParticipantBattleViewerEntitlement,
  createSpectatorBattleViewerEntitlement,
} from '@/server/battle/battle-viewer-entitlement'

function setup(ordinary = false) {
  const draft = source({
    effects: [
      {
        id: 'hit',
        timing: 'controlled',
        payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
      },
    ],
  })
  const captured = captureCombatAbilitySource({
    ...draft,
    definition: {
      ...draft.definition,
      behaviors: ordinary
        ? [
            ...draft.definition.behaviors,
            {
              ...draft.definition.behaviors[0]!,
              id: 'ordinary',
              effects: [
                {
                  id: 'ordinary-hit',
                  timing: 'instant',
                  payload: { type: 'damage', recipient: 'primary-unit', amount: 5 },
                },
              ],
            },
          ]
        : draft.definition.behaviors,
    },
  })
  const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
    captured,
  ])
  return { state, captured }
}
function rows(state: CombatEncounterState) {
  return projectBattleManualActionTargets(
    state as StatDrivenCombatEncounterState,
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['actor']),
  )
}
function prime(input: ReturnType<typeof setup>) {
  return primeCombatControlledAbility({
    state: input.state,
    actorId: 'actor',
    sourceInstanceId: input.captured.sourceInstanceId,
    behaviorId: 'strike',
  }).state
}
function command(
  state: CombatEncounterState,
  captured: ReturnType<typeof setup>['captured'],
  behaviorId = 'strike',
) {
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured, behaviorId },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }
}
function finish(kind: 'release' | 'cancel', input: ReturnType<typeof setup>) {
  const primed = prime(input)
  return kind === 'release'
    ? commitCombatAbilityCommand(command(primed, input.captured)).state
    : cancelCombatControlledAbility({
        state: primed,
        actorId: 'actor',
        sourceInstanceId: input.captured.sourceInstanceId,
        behaviorId: 'strike',
      }).state
}
const skill = {
  id: 'test.ability',
  contentVersion: 1,
  sourceDisciplineId: 'vanguard',
  name: 'Controlled Fixture',
  apCost: 11,
  mpCost: 2,
  cooldownOwnerTurns: null,
  category: 'attack' as const,
  targetKind: 'unit' as const,
  targetTeamPolicy: 'enemy' as const,
  minimumRange: 1,
  maximumRange: 4,
  tags: [],
  effectDescriptions: [],
  requirementDescriptions: [],
}
const base: BattleRuntime = {
  kind: 'pve',
  playerName: 'Fixture',
  playerLevel: 1,
  playerPortraitAssetId: 'character.portrait.starter.wayfarer-01',
  playerProfileImageUrl: null,
  techniques: [],
  essence: null,
  resonance: null,
}
function markup(
  state: CombatEncounterState,
  slot: 'skill' | 'essence' | 'resonance',
  behaviorId: string | null = 'strike',
) {
  const runtime: BattleRuntime =
    slot === 'skill'
      ? { ...base, techniques: [skill] }
      : slot === 'essence'
        ? { ...base, essence: { ...skill, description: '' } }
        : {
            ...base,
            resonance: { id: skill.id, contentVersion: 1, name: skill.name, description: '' },
          }
  return renderToStaticMarkup(
    <BattleSelectedSkills
      runtime={runtime}
      disabled={false}
      actionEconomy={100}
      actorId="actor"
      resources={{ mp: 20, hp: 1000 }}
      manualActionTargets={rows(state)}
      selectedBehavior={behaviorId ? { actionId: skill.id, behaviorId } : undefined}
      primeAvailableIds={rows(state)
        .filter((row) => row.controlled?.canPrime)
        .map((row) => row.actionId)}
      readyActionId={skill.id}
      onSelect={() => undefined}
    />,
  )
}
function artwork(html: string) {
  return html
    .match(/<button\b[^>]*>/g)!
    .find(
      (tag) =>
        tag.includes('aria-label="Selected Controlled Fixture') ||
        tag.includes('aria-label="Controlled Fixture, Essence') ||
        tag.includes('aria-label="Controlled Fixture, Resonance'),
    )!
}
it.each(
  (['release', 'cancel'] as const).flatMap((kind) =>
    (['skill', 'essence', 'resonance'] as const).map((slot) => ({ kind, slot })),
  ),
)(
  'retains deliberate group choice for $slot after spending its selected group via $kind',
  ({ kind, slot }) => {
    const input = setup(true)
    const state = finish(kind, input)
    const captures = rows(state)
    const selected = battleCapturedActionCost(captures, [], { ap: 0, mp: 0, hp: 1000 }, 'strike')
    expect(selected.controlledSpent).toBe(true)
    expect(selected.chooseAction).toBe(true)
    const html = markup(state, slot)
    expect(artwork(html)).not.toContain('disabled')
    expect(artwork(html)).toContain('choose another action')
    expect(html).not.toContain('data-battle-controlled-ready="true"')
    // No replacement action is chosen by resolving the spent group.
    expect(resolveBattleCapturedSkill(skill, captures, 'strike')!.unavailable).toBe(true)
    expect(resolveBattleCapturedSkill(skill, captures)).toBeNull()
    expect(
      prepareCombatAbilityCommand(command(state, input.captured, 'ordinary')).evaluation.legal,
    ).toBe(true)
  },
)
it.each(['skill', 'essence', 'resonance'] as const)(
  'keeps unprimed and legally primed %s available',
  (slot) => {
    const input = setup()
    expect(rows(input.state)[0]!.controlled?.phase).toBe('unprimed')
    const initial = markup(input.state, slot)
    expect(artwork(initial)).not.toContain('disabled')
    expect(artwork(initial)).toContain('prime without payment')
    expect(initial).not.toContain('data-battle-controlled-ready="true"')
    const state = prime(input)
    expect(rows(state)[0]!.controlled?.phase).toBe('primed')
    expect(prepareCombatAbilityCommand(command(state, input.captured)).evaluation.legal).toBe(true)
    const primed = markup(state, slot)
    expect(artwork(primed)).not.toContain('disabled')
    expect(primed).toContain('data-battle-controlled-ready="true"')
    expect(primed).toContain('data-battle-controlled-primed="true"')
    expect(primed).not.toMatch(/>Release</)
  },
)
it.each(['release', 'cancel'] as const)(
  'blocks a spent captured descriptor after native %s',
  (kind) => {
    const input = setup()
    const state = finish(kind, input)
    const captures = rows(state)
    expect(captures[0]!.controlled?.phase).toBe('spent')
    expect(() =>
      primeCombatControlledAbility({
        state,
        actorId: 'actor',
        sourceInstanceId: input.captured.sourceInstanceId,
        behaviorId: 'strike',
      }),
    ).toThrow('controlled-prime-used')
    const descriptor = resolveBattleCapturedSkill(skill, captures, 'strike')!
    const intent = selectInitialBattleSkillPreviewIntent(descriptor, {
      actorId: 'actor',
      selectedCombatantId: 'enemy',
      selectedTile: null,
      combatants: [
        { combatantId: 'actor', teamIndex: 0, hp: 1000, position: { x: 1, y: 1 } },
        { combatantId: 'enemy', teamIndex: 1, hp: 1000, position: { x: 2, y: 1 } },
      ],
    })
    expect(intent).toBeNull()
  },
)
it.each(
  (['release', 'cancel'] as const).flatMap((kind) =>
    (['skill', 'essence', 'resonance'] as const).map((slot) => ({ kind, slot })),
  ),
)(
  'disables spent $slot artwork after native $kind despite a stale ready signal',
  ({ kind, slot }) => {
    const input = setup()
    const state = finish(kind, input)
    const before = structuredClone(state)
    const html = markup(state, slot)
    expect(artwork(html)).toContain('disabled=""')
    expect(html).not.toContain('data-battle-controlled-ready="true"')
    expect(html).toContain('aria-label="About Controlled Fixture"')
    expect(artwork(html)).toContain('already used this battle')
    expect(state).toEqual(before)
  },
)
it.each(['release', 'cancel'] as const)(
  'leaves another ordinary Manual group usable after native %s',
  (kind) => {
    const input = setup(true)
    const state = finish(kind, input)
    const captures = rows(state)
    expect(captures.find((r) => r.behaviorId === 'strike')!.controlled?.phase).toBe('spent')
    expect(captures.find((r) => r.behaviorId === 'ordinary')!.controlled).toBeUndefined()
    expect(
      prepareCombatAbilityCommand(command(state, input.captured, 'ordinary')).evaluation.legal,
    ).toBe(true)
    expect(artwork(markup(state, 'skill', 'ordinary'))).not.toContain('disabled')
    const descriptor = resolveBattleCapturedSkill(skill, captures, 'ordinary')!
    expect(descriptor.unavailable).not.toBe(true)
  },
)
it('retains the price and owner privacy of a spent action rather than calling it free', () => {
  const input = setup()
  const state = finish('cancel', input)
  const cost = battleCapturedActionCost(rows(state), [], { ap: 100, mp: 20, hp: 1000 }, 'strike')
  expect(cost.costLabel).toBe('11 AP / 2 MP / 1 HP')
  expect(cost.affordable).toBe(true)
  expect(
    projectBattleManualActionTargets(
      state as StatDrivenCombatEncounterState,
      createSpectatorBattleViewerEntitlement(),
    ),
  ).toEqual([])
  expect(state.tactical.battle.combatants.find((r) => r.id === 'actor')!.mp).toBe(20)
  expect(state.tactical.battle.combatants.find((r) => r.id === 'actor')!.hp).toBe(1000)
})
it.each([
  'basic.move',
  'unarmed.basic',
  'basic.guard',
  'basic.recover',
  'basic.recover.mp',
] as const)('disables the real captured %s Basic artwork after cancellation', (id) => {
  const definitions = defaultBasicSkills().map((definition) => ({
    ...definition,
    ...(definition.id === 'basic.move'
      ? { execution: { kind: 'basic-move' as const, costBasis: 'flat' as const } }
      : {}),
    ability: {
      ...definition.ability,
      behaviors: definition.ability.behaviors.map((behavior) => ({
        ...behavior,
        effects: [
          ...behavior.effects,
          {
            id: 'controlled-fixture-hit',
            timing: 'controlled' as const,
            payload: { type: 'damage' as const, recipient: 'actor' as const, amount: 1 },
          },
        ],
      })),
    },
  }))
  const captures = captureBasicSkillSources({
    ownerCombatantId: 'actor',
    supportActionId: id === 'basic.recover' || id === 'basic.recover.mp' ? id : 'basic.guard',
    definitions,
  })
  const captured = captures.find((row) => row.abilityId === id)!
  let state = reconcileCombatAbilitySources(
    preparePv1fTurnEconomy(percentageDotEncounter()),
    captures,
  )
  const input = { actorId: 'actor', sourceInstanceId: captured.sourceInstanceId, behaviorId: 'use' }
  state = primeCombatControlledAbility({ state, ...input }).state
  state = cancelCombatControlledAbility({ state, ...input }).state
  const actionId = id === 'unarmed.basic' ? 'basic.attack.unarmed.basic' : id
  const controlled = rows(state).find((row) => row.actionId === actionId)!.controlled!
  expect(controlled.phase).toBe('spent')
  const html = renderToStaticMarkup(
    <BattleSkillCommand
      slot={id === 'basic.move' ? 'move' : id === 'unarmed.basic' ? 'attack' : 'guard'}
      hotkey="1"
      label="Controlled Basic"
      cost="30 AP"
      artworkSrc="/media/skills/guard.webp"
      active={false}
      disabled={false}
      controlledAvailability={battleCapturedActionCost(
        rows(state).filter((row) => row.actionId === actionId),
        [],
        { ap: 100, mp: 20, hp: 1000 },
        'use',
      )}
      controlledReady={true}
      primeAvailable={true}
      onActivate={() => undefined}
    />,
  )
  const button = html.match(/<button\b[^>]*data-command-slot[^>]*>/)![0]
  expect(button).toContain('disabled=""')
  expect(button).toContain('already used this battle')
  expect(html).not.toContain('data-battle-controlled-ready="true"')
  expect(html).toContain('aria-label="About Controlled Basic"')
})
it.each(
  (
    ['basic.move', 'unarmed.basic', 'basic.guard', 'basic.recover', 'basic.recover.mp'] as const
  ).flatMap((id) => [false, true].map((mixed) => ({ id, mixed }))),
)('handles ambiguous $id captures mixed=$mixed', ({ id, mixed }) => {
  const definitions = defaultBasicSkills().map((definition) => ({
    ...definition,
    ...(definition.id === 'basic.move'
      ? { execution: { kind: 'basic-move' as const, costBasis: 'flat' as const } }
      : {}),
    ability: {
      ...definition.ability,
      behaviors: ['first', 'second'].map((behaviorId) => ({
        ...definition.ability.behaviors[0]!,
        id: behaviorId,
        effects: [
          ...definition.ability.behaviors[0]!.effects,
          {
            id: 'controlled-fixture-hit',
            timing:
              mixed && behaviorId === 'second' ? ('instant' as const) : ('controlled' as const),
            payload: { type: 'damage' as const, recipient: 'actor' as const, amount: 1 },
          },
        ],
      })),
    },
  }))
  const sources = captureBasicSkillSources({
    ownerCombatantId: 'actor',
    definitions,
    supportActionId: id === 'basic.recover' || id === 'basic.recover.mp' ? id : 'basic.guard',
  })
  const captured = sources.find((row) => row.abilityId === id)!
  let state = reconcileCombatAbilitySources(
    preparePv1fTurnEconomy(percentageDotEncounter()),
    sources,
  )
  const input = {
    actorId: 'actor',
    sourceInstanceId: captured.sourceInstanceId,
    behaviorId: 'first',
  }
  state = primeCombatControlledAbility({ state, ...input }).state
  state = cancelCombatControlledAbility({ state, ...input }).state
  const actionId = id === 'unarmed.basic' ? 'basic.attack.unarmed.basic' : id
  const captures = rows(state).filter((row) => row.actionId === actionId)
  expect(captures).toHaveLength(2)
  expect(captures.map((row) => row.controlled?.phase)).toEqual(
    mixed ? ['spent', undefined] : ['spent', 'spent'],
  )
  expect(resolveBattleCapturedSkill({ ...skill, id: actionId }, captures)).toBeNull()
  const availability = battleCapturedActionCost(
    captures,
    [],
    { ap: 100, mp: 20, hp: 1000 },
    mixed ? 'first' : undefined,
  )
  expect(availability.chooseAction).toBe(mixed)
  const html = renderToStaticMarkup(
    <BattleSkillCommand
      slot="guard"
      hotkey="3"
      label="All-spent Basic"
      cost="Choose action"
      artworkSrc="/media/skills/guard.webp"
      active={false}
      disabled={false}
      controlledAvailability={availability}
      onActivate={() => undefined}
    />,
  )
  const button = html.match(/<button\b[^>]*data-command-slot[^>]*>/)![0]
  if (mixed) {
    expect(button).not.toContain('disabled')
    expect(button).toContain('choose another action')
    expect(
      resolveBattleCapturedSkill({ ...skill, id: actionId }, captures, 'first')!.unavailable,
    ).toBe(true)
  } else {
    expect(button).toContain('disabled=""')
    expect(html).toContain('already used this battle')
  }
  expect(html).toContain('aria-label="About All-spent Basic"')
})

it.each(['skill', 'essence', 'resonance'] as const)(
  'retains %s Primed artwork with another group selected or after local selection resets',
  (slot) => {
    const input = setup(true)
    const state = prime(input)
    for (const selected of [null, 'ordinary']) {
      const html = markup(state, slot, selected)
      expect(html).toContain('data-battle-controlled-primed="true"')
      expect(artwork(html)).toContain(', primed')
    }
    expect(markup(finish('cancel', input), slot, null)).not.toContain(
      'data-battle-controlled-primed',
    )
  },
)
