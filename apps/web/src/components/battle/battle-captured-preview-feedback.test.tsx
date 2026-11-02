import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[], desktop: false }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (initial: unknown) => {
    const index = hooks.index++
    if (!(index in hooks.cells))
      hooks.cells[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [
      hooks.cells[index],
      (next: unknown) => {
        hooks.cells[index] =
          typeof next === 'function'
            ? (next as (old: unknown) => unknown)(hooks.cells[index])
            : next
      },
    ]
  },
  useRef: (initial: unknown) => {
    const index = hooks.index++
    if (!(index in hooks.cells)) hooks.cells[index] = { current: initial }
    return hooks.cells[index]
  },
  useCallback: (callback: unknown) => callback,
  useMemo: (callback: () => unknown) => callback(),
  useEffect: () => {},
  useLayoutEffect: () => {},
  useContext: (context: { _currentValue: unknown }) => context._currentValue,
  useSyncExternalStore: (_subscribe: unknown, _get: unknown, server: () => unknown) => server(),
}))
vi.mock('server-only', () => ({}))
vi.mock('./battle-responsive-layout', async (original) => ({
  ...(await original<typeof import('./battle-responsive-layout')>()),
  useDesktopBattleLayout: () => hooks.desktop,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
import { BattleExperience } from './battle-experience'
import { BattleSkillCommand } from './battle-skill-command'
import { BattleActionPreview } from './battle-action-preview'
import { BattleCombatantCard } from './battle-combatant-card'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { capturedBasicBattle } from './battle-basic-actions.test-utils'
import type { BattleRuntime } from './battle-runtime'
import { createBattlePreviewService } from '@/server/battle/battle-preview-service'
import type { BattleSessionRecord, BattleSessionRepository } from '@aurevane/db/battle-session'
import type { SupportActionId } from '@aurevane/game-core/combat/support-actions'
import { projectBattleSnapshot } from '@/server/battle/battle-session-service'
import { deriveParticipantBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'
import {
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'
import { createCurrentStatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { spawnCombatSummon } from '@aurevane/game-core/combat/combat-summons'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { commitCombatAbilityCommand } from '@aurevane/game-core/combat/combat-ability-command'
import { combatAbilityCommandContext } from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  readPv1fActionEconomy,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  AUTHORABLE_EFFECT_TAGS,
  createAuthorableEffectPayload,
} from '@aurevane/game-core/combat/combat-effect-authoring'
import type { CombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'

type Props = Record<string, unknown> & { children?: ReactNode }
function find(
  node: ReactNode,
  predicate: (node: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, predicate)
      if (found) return found
    }
  }
  if (!isValidElement<Props>(node)) return null
  return predicate(node) ? node : find(node.props.children, predicate)
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  hooks.desktop = false
  vi.stubGlobal('document', {
    querySelector: () => null,
    hidden: false,
    hasFocus: () => true,
    activeElement: null,
  })
  vi.stubGlobal('HTMLElement', class {})
  vi.stubGlobal('window', { requestAnimationFrame: () => 0 })
})
afterEach(() => vi.unstubAllGlobals())
function fixture(
  support: SupportActionId,
  mode: 'pve' | 'pvp',
  options: {
    controlledAttack?: boolean
    delayed?: boolean
    stale?: boolean
    blocked?: boolean
    withMove?: boolean
    targetPreview?: 'utility' | 'healing' | 'damage' | 'circle' | 'ground' | 'line' | 'all'
    allHealingAim?: 'self' | 'enemy'
    blindAttack?: boolean
    withDamage?: boolean
    largeBoard?: boolean
    targetPayload?: CombatTagPayload
    selfTarget?: boolean
    commitResult?: 'success' | 'failure' | 'network-error'
    dualGroundIntent?: boolean
    spatialAttack?: boolean
    currentSupportDefaults?: boolean
    guidedPractice?: boolean
  } = {},
) {
  const input = capturedBasicBattle(support, false, {}, options.currentSupportDefaults)
  let state: StatDrivenCombatEncounterState = {
    ...input.state,
    tactical: {
      ...input.state.tactical,
      battle: {
        ...input.state.tactical.battle,
        combatants: input.state.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor' ? { ...unit, hp: 500, mp: 10 } : unit,
        ),
      },
    },
  }
  if (options.currentSupportDefaults) {
    state = createCurrentStatDrivenCombatEncounterState(
      state,
      state.statBridge.combatants.map((row) => ({
        ...row,
        physicalPower: row.physicalPower ?? 20,
        mysticPower: row.mysticPower ?? 20,
        level: 1,
        criticalChance: 0,
      })),
    )
  }
  if (options.guidedPractice) {
    const recovery = captureBasicSkillSources({
      ownerCombatantId: 'actor',
      supportActionId: 'basic.recover',
      definitions: defaultBasicSkills(),
    }).find((row) => row.abilityId === 'basic.recover')!
    state = {
      ...reconcileCombatAbilitySources(state, [...state.capturedAbilitySources!, recovery]),
      supportActionPolicyVersion: 1,
      statBridge: {
        ...state.statBridge,
        combatants: state.statBridge.combatants.map((row) =>
          row.combatantId === 'enemy'
            ? {
                ...row,
                provenance: {
                  kind: 'scenario',
                  sourceId: 'scenario:p2-7-recruit:duel-yard:guided-fundamentals:easy',
                  sourceRulesVersion: 1,
                },
              }
            : row,
        ),
      },
    }
  }
  if (options.largeBoard) {
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        width: 9,
        height: 7,
        tiles: Array.from({ length: 63 }, (_, index) => ({
          position: { x: index % 9, y: Math.floor(index / 9) },
          elevation: index % 4,
          terrainId: 'open',
        })),
      },
    }
  }
  if (options.dualGroundIntent) state = { ...state, elementalDamagePolicyVersion: 2 }
  if (options.targetPreview) {
    const kind = options.targetPreview
    const sources = state.capturedAbilitySources!.map((source) => {
      if (source.abilityId !== support) return source
      const definition = parseAbilityDefinition({
        ...source.definition,
        behaviors: source.definition.behaviors.map((behavior) => ({
          ...behavior,
          classification:
            kind === 'healing'
              ? 'recovery'
              : kind === 'damage' || options.blindAttack
                ? 'attack'
                : 'utility',
          ...(kind === 'damage' || options.blindAttack ? { attackFamily: 'physical' } : {}),
          targeting: {
            ...behavior.targeting,
            geometryVersion: options.dualGroundIntent ? 2 : 3,
            kind:
              options.allHealingAim === 'self' || options.selfTarget
                ? 'self'
                : kind === 'ground'
                  ? options.targetPayload?.type === 'summon'
                    ? 'empty-tile'
                    : 'ground-tile'
                  : 'unit',
            categories: options.dualGroundIntent
              ? undefined
              : [
                  options.allHealingAim === 'self' || options.selfTarget
                    ? 'self'
                    : kind === 'ground'
                      ? 'ground'
                      : 'enemy',
                ],
            teamPolicy:
              options.allHealingAim === 'self' || options.selfTarget
                ? 'self'
                : kind === 'ground'
                  ? 'any'
                  : 'enemy',
            minimumRange:
              options.blindAttack || (options.targetPayload && !options.selfTarget) ? 1 : 0,
            maximumRange:
              options.allHealingAim === 'self' || options.selfTarget || kind === 'all'
                ? 0
                : options.largeBoard
                  ? 15
                  : 3,
            maximumElevationDifference: options.spatialAttack
              ? 0
              : options.blindAttack
                ? 3
                : (behavior.targeting?.maximumElevationDifference ?? null),
            shape:
              kind === 'circle'
                ? { kind: 'circle', radius: 3 }
                : kind === 'line'
                  ? { kind: 'line', length: 3 }
                  : kind === 'all'
                    ? { kind: 'all' }
                    : { kind: 'single' },
            requiresLineOfSight: options.spatialAttack === true,
          },
          effects: [
            ...(options.dualGroundIntent
              ? [
                  {
                    id: 'fire-cleanse',
                    payload: {
                      type: 'remove-status',
                      recipient: 'actor',
                      target: 'self',
                      statusIds: ['frozen'],
                      removalMode: 'specified',
                    },
                  },
                ]
              : []),
            ...(options.withMove
              ? [
                  {
                    id: 'move',
                    timing: 'instant',
                    payload: { type: 'move', recipient: 'actor', maximumTiles: 3 },
                  },
                ]
              : []),
            ...(options.withDamage
              ? [
                  {
                    id: 'damage',
                    payload: { type: 'damage', recipient: 'affected-units', amount: 1 },
                  },
                ]
              : []),
            {
              id: 'targeted',
              ...(options.targetPayload?.type === 'reversal' ? { timing: 'controlled' } : {}),
              payload:
                options.targetPayload ??
                (kind === 'damage'
                  ? {
                      type: 'damage',
                      recipient: 'affected-units',
                      amount: 5,
                      ...(options.dualGroundIntent ? { element: 'fire' } : {}),
                    }
                  : kind === 'healing'
                    ? {
                        type: 'healing',
                        recipient: 'affected-units',
                        amount: 5,
                        ...(options.allHealingAim ? { target: 'all' } : {}),
                      }
                    : {
                        type: 'apply-status',
                        recipient: 'affected-units',
                        statusId: options.blindAttack ? 'blind' : 'guarded',
                        stacks: 1,
                        ...(options.blindAttack
                          ? { potencyBasisPoints: 10000, durationTurns: 2 }
                          : {}),
                      }),
            },
          ],
        })),
      })
      return {
        ...source,
        definition,
        basic: {
          ...source.basic!,
          ability: definition,
          ...(options.targetPayload?.type === 'percentage-recovery'
            ? { execution: { kind: 'basic-action' as const, recoveryRounding: 'floor' as const } }
            : {}),
        },
      }
    })
    state = {
      ...reconcileCombatAbilitySources(
        { ...state, capturedAbilitySources: undefined, abilityRuntime: undefined },
        sources,
      ),
      statBridge: state.statBridge,
    }
  }
  // Build a separate initial Controlled encounter; captured definitions cannot be edited in place.
  if (options.controlledAttack) {
    const sources = state.capturedAbilitySources!.map((source) => {
      if (source.abilityId !== 'unarmed.basic') return source
      const definition = parseAbilityDefinition({
        ...source.definition,
        behaviors: source.definition.behaviors.map((behavior) => ({
          ...behavior,
          effects: behavior.effects.map((effect) => ({ ...effect, timing: 'controlled' })),
        })),
      })
      return {
        ...source,
        sourceInstanceId: source.sourceInstanceId + '.controlled',
        contentVersion: 3,
        definition,
        basic: { ...source.basic!, contentVersion: 3, ability: definition },
      }
    })
    state = {
      ...reconcileCombatAbilitySources(
        { ...state, capturedAbilitySources: undefined, abilityRuntime: undefined },
        sources,
      ),
      statBridge: state.statBridge,
    }
    const source = sources.find((source) => source.abilityId === 'unarmed.basic')!
    state = {
      ...primeCombatControlledAbility({
        state,
        actorId: 'actor',
        sourceInstanceId: source.sourceInstanceId,
        behaviorId: 'use',
      }).state,
      statBridge: state.statBridge,
    }
  }
  if (options.allHealingAim) {
    state = createCurrentStatDrivenCombatEncounterState(
      state,
      state.statBridge.combatants.map((row) => ({
        ...row,
        physicalPower: row.physicalPower ?? 20,
        mysticPower: row.mysticPower ?? 20,
        level: 1,
        criticalChance: 0,
      })),
    )
    state = spawnCombatSummon(state, {
      ownerCombatantId: 'actor',
      sourceSkillId: 'test.all-healing-summon',
      sourceSkillVersion: 1,
      profile: resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!,
      position: { x: 0, y: 3 },
      facing: 'east',
    }).state
  }
  const view = {
    ...input.view,
    snapshot: projectBattleSnapshot(
      state,
      deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['actor']),
    ),
  }
  const record: BattleSessionRecord = {
    battleSessionId: view.battleSessionId,
    battleId: state.tactical.battle.battleId,
    battleVersion: view.battleVersion,
    rulesVersion: state.tactical.battle.rulesVersion,
    contentVersion: state.tactical.battle.contentVersion,
    lifecycle: state.tactical.battle.lifecycle,
    snapshot: state,
    controlledCombatantIds: ['actor'],
    updatedAt: '2026-10-16T20:40:43Z',
  }
  const commit = vi.fn(async () => {
    throw new Error('A forecast cannot commit')
  })
  const unused = async () => {
    throw new Error('Unexpected repository operation')
  }
  const repository: BattleSessionRepository = {
    findBattleSession: async () => record,
    createBattleSession: unused,
    findBattleIntentReplay: unused,
    commitBattleIntent: commit,
  }
  const service = createBattlePreviewService(repository)
  const previews: Awaited<ReturnType<typeof service.previewIntent>>[] = []
  const requests: {
    expectedBattleVersion: number
    intent: Parameters<typeof service.previewIntent>[0]['intent']
  }[] = []
  let release: (() => void) | undefined
  const network = vi.fn<typeof fetch>(async (_url, requestOptions) => {
    const body = JSON.parse(String(requestOptions?.body))
    requests.push(body)
    if (options.commitResult && !String(_url).endsWith('/preview')) {
      if (options.commitResult === 'network-error')
        throw new Error('The chosen Ground cast was rejected.')
      if (options.commitResult === 'failure')
        return Response.json(
          { error: { code: 'ILLEGAL_COMMAND', message: 'The chosen Ground cast was rejected.' } },
          { status: 400 },
        )
      if (options.currentSupportDefaults && body.intent.kind === 'action') {
        const source = state.capturedAbilitySources!.find(
          (row) => row.abilityId === body.intent.actionId,
        )!
        const result = commitCombatAbilityCommand({
          state,
          actorId: 'actor',
          root: { kind: 'canonical', source, behaviorId: body.intent.behaviorId },
          selection: body.intent.target,
          movementPath: body.intent.movementPath,
          content: PV1F_COMBAT_CONTENT,
          context: combatAbilityCommandContext(state, source),
        })
        state = result.state as StatDrivenCombatEncounterState
        record.snapshot = state
        return Response.json({
          battle: {
            ...view,
            battleVersion: view.battleVersion + 1,
            snapshot: projectBattleSnapshot(
              state,
              deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['actor']),
            ),
          },
        })
      }
      return Response.json({
        battle: {
          ...view,
          battleVersion: view.battleVersion + 1,
          snapshot: {
            ...view.snapshot,
            ...(options.targetPreview === 'ground'
              ? {
                  groundAreas: [
                    {
                      id: 'ground.area.1',
                      tiles: [{ x: 0, y: 0 }],
                      activationRound: state.tactical.battle.round,
                      expiresAtRound: state.tactical.battle.round + 2,
                      visualPresetId: 'arcane-pulse',
                      effectVisualIds: ['status:guarded'],
                    },
                  ],
                }
              : {}),
          },
        },
      })
    }
    const battlePreview = await service.previewIntent({
      ...body,
      userId: 'owner',
      battleSessionId: view.battleSessionId,
    })
    previews.push(battlePreview)
    if (options.delayed)
      await new Promise<void>((resolve) => {
        release = resolve
      })
    return Response.json({
      battlePreview: options.stale
        ? { ...battlePreview, battleVersion: 0 }
        : options.blocked
          ? {
              ...battlePreview,
              preview: {
                ...battlePreview.preview,
                legal: false,
                issues: [{ code: 'blocked', message: 'Release is blocked.' }],
              },
            }
          : battlePreview,
    })
  })
  vi.stubGlobal('fetch', network)
  const runtime: BattleRuntime =
    mode === 'pve'
      ? {
          kind: 'pve',
          playerName: 'Wayfarer',
          playerLevel: 1,
          playerPortraitAssetId: 'character.creation.square-portrait-01',
          playerProfileImageUrl: null,
          supportActionId: support,
        }
      : {
          kind: 'pvp',
          playerName: 'Wayfarer',
          supportActionId: support,
          metadata: {
            lobbyId: 'lobby',
            battleKey: 'key',
            mode: '1v1',
            localCharacterId: 'owner',
            participants: state.tactical.battle.combatants.map((unit, index) => ({
              combatantId: unit.id,
              characterId: index === 0 ? 'owner' : 'other',
              characterName: unit.id,
              teamIndex: index,
              seatIndex: 0,
              characterLevel: 1,
              portraitRef: STARTER_CHARACTER_PORTRAITS[0]!.ref,
              profileImageUrl: null,
            })),
          },
        }
  const render = () => {
    hooks.index = 0
    const wrapper = BattleExperience({ initialBattle: view, runtime })
    const content = wrapper.props.children.props.children
    return content.type(content.props)
  }
  const notice = () => {
    const row = find(render(), (node) => node.props['data-battle-notice'] === 'true')!
    return find(row, (node) => node.type === 'span')!.props.children
  }
  const begin = (slot = 'guard') => {
    const button = find(
      render(),
      (node) => node.type === BattleSkillCommand && node.props.slot === slot,
    )!
    expect(button.props.disabled).not.toBe(true)
    ;(button.props.onActivate as () => void)()
  }
  const activate = async (slot = 'guard') => {
    begin(slot)
    await vi.waitFor(() => expect(previews, String(notice())).toHaveLength(1))
    await vi.waitFor(() =>
      expect(notice()).not.toBe('Your turn. Choose any action when you are ready.'),
    )
  }
  return {
    state,
    view,
    record,
    network,
    requests,
    previews,
    commit,
    render,
    notice,
    activate,
    begin,
    release: () => release!(),
    currentState: () => state,
  }
}
it('current Guided Fundamentals offers actual captured HP Recovery without resurrecting Guard or changing slot 3', async () => {
  const input = fixture('basic.pilfer', 'pve', {
    currentSupportDefaults: true,
    guidedPractice: true,
    commitResult: 'success',
  })
  const practice = () =>
    find(
      input.render(),
      (node) =>
        node.type === 'button' &&
        String(node.props['aria-label']).startsWith('Practice HP Recovery'),
    )!
  expect(practice()).not.toBeNull()
  expect(
    find(input.render(), (node) => String(node.props['aria-label']).startsWith('Practice Guard')),
  ).toBeNull()
  const before = input
    .currentState()
    .tactical.battle.combatants.find((row) => row.id === 'actor')!.hp
  ;(practice().props.onClick as () => void)()
  const choices = find(
    input.render(),
    (node) => node.type === 'select' && node.props['aria-label'] === 'Ability action',
  )!
  if (choices) {
    const action = find(
      choices.props.children,
      (node) => node.type === 'option' && !node.props.disabled,
    )!
    ;(choices.props.onChange as (event: unknown) => void)({ target: { value: action.props.value } })
  }
  ;(practice().props.onClick as () => void)()
  await vi.waitFor(() =>
    expect(
      input.currentState().tactical.battle.combatants.find((row) => row.id === 'actor')!.hp,
      JSON.stringify({ notice: input.notice(), requests: input.requests }),
    ).toBeGreaterThan(before),
  )
  expect(
    input.requests.flatMap((row) => (row.intent.kind === 'action' ? [row.intent.actionId] : [])),
  ).toContain('basic.recover')
  expect(
    input.network.mock.calls.filter(([url]) => !String(url).endsWith('/preview')),
  ).toHaveLength(1)
  expect(
    find(input.render(), (node) => node.type === BattleSkillCommand && node.props.slot === 'guard')!
      .props.label,
  ).toBe('Pilfer')
})

for (const mode of ['pve', 'pvp'] as const) {
  it.each(['self', 'enemy'] as const)(
    mode + ' paints every living All recovery recipient green with a %s Single aim',
    (allHealingAim) => {
      const input = fixture('basic.recover', mode, { targetPreview: 'healing', allHealingAim })
      input.begin('guard')
      const tree = input.render()
      expect(input.state.effectState?.summons).toHaveLength(1)
      for (const placement of input.state.tactical.placements) {
        const tile = find(
          tree,
          (node) =>
            node.type === 'button' &&
            String(node.props['aria-label']).startsWith(
              `Tile ${placement.position.x + 1}, ${placement.position.y + 1};`,
            ),
        )!
        expect(tile.props['data-heal-target'], placement.combatantId).toBe(true)
      }
      expect(
        find(
          tree,
          (node) =>
            node.type === 'button' && String(node.props['aria-label']).startsWith('Tile 5, 5;'),
        )!.props['data-heal-target'],
      ).not.toBe(true)
      expect(input.commit).not.toHaveBeenCalled()
    },
  )
  it(mode + ' clears stale quotes, Inspect and nonlocal-turn resource proposals', async () => {
    const stale = fixture('basic.guard', mode, { stale: true })
    await stale.activate()
    expect(
      find(
        stale.render(),
        (node) => node.type === BattleCombatantCard && node.props.role === 'local',
      )!.props.proposedCosts,
    ).toBeNull()
    hooks.cells = []
    const input = fixture('basic.guard', mode)
    await input.activate()
    input.begin('inspect')
    expect(
      find(
        input.render(),
        (node) => node.type === BattleCombatantCard && node.props.role === 'local',
      )!.props.proposedCosts,
    ).toBeNull()
    input.begin()
    input.view.snapshot.tactical.battle.currentTurn = {
      ...input.view.snapshot.tactical.battle.currentTurn!,
      combatantId: 'enemy',
    }
    expect(
      find(
        input.render(),
        (node) => node.type === BattleCombatantCard && node.props.role === 'local',
      )!.props.proposedCosts,
    ).toBeNull()
  })
  it(
    mode + ' keeps composed costs while hovering a line after choosing the Move destination',
    async () => {
      const input = fixture('basic.guard', mode, { withMove: true, targetPreview: 'line' })
      input.begin()
      const destination = find(
        input.render(),
        (node) =>
          node.type === 'button' &&
          node.props['data-reachable'] === true &&
          String(node.props['aria-label']).startsWith('Tile 3, 1;'),
      )!
      ;(destination.props.onClick as () => void)()
      const target = find(
        input.render(),
        (node) =>
          node.type === 'button' && String(node.props['aria-label']).startsWith('Tile 3, 2;'),
      )!
      ;(target.props.onPointerEnter as (event: unknown) => void)({ pointerType: 'mouse' })
      await vi.waitFor(() =>
        expect(
          input.requests.some(
            (request) => request.intent.kind === 'action' && request.intent.movementPath?.length,
          ),
        ).toBe(true),
      )
      await vi.waitFor(() => expect(input.notice()).toBe('Second Wind forecast ready.'))
      expect(
        find(
          input.render(),
          (node) => node.type === BattleCombatantCard && node.props.role === 'local',
        )!.props.proposedCosts,
      ).toEqual({ actorId: 'actor', ap: 47, mp: 3, hp: 2 })
      expect(input.commit).not.toHaveBeenCalled()
    },
  )
  it.each([false, true])(
    mode +
      ' proposes captured AP, HP and MP before a Move target, then clears on cancel (desktop=%s)',
    (desktop) => {
      hooks.desktop = desktop
      const input = fixture('basic.guard', mode, { withMove: true, targetPreview: 'damage' })
      const proposal = () =>
        find(
          input.render(),
          (node) => node.type === BattleCombatantCard && node.props.role === 'local',
        )!.props.proposedCosts
      expect(proposal()).toBeNull()
      input.begin()
      expect(input.requests).toHaveLength(0)
      expect(proposal()).toEqual({ actorId: 'actor', ap: 47, mp: 3, hp: 2 })
      expect(
        find(
          input.render(),
          (node) =>
            node.type === 'small' &&
            Array.isArray(node.props.children) &&
            node.props.children.includes(47),
        ),
      ).not.toBeNull()
      const cancel = find(input.render(), (node) => node.props['aria-label'] === 'Cancel Action')!
      ;(cancel.props.onClick as () => void)()
      expect(proposal()).toBeNull()
      expect(input.commit).not.toHaveBeenCalled()
    },
  )
  it.each([false, true])(
    mode +
      ' passes actual mixed quoted costs only to the caster card without spending resources (desktop=%s)',
    async (desktop) => {
      hooks.desktop = desktop
      const input = fixture('basic.recover', mode)
      const original = JSON.stringify(input.state)
      await input.activate()
      const tree = input.render()
      const local = find(
        tree,
        (node) => node.type === BattleCombatantCard && node.props.role === 'local',
      )!
      const selected = find(
        tree,
        (node) => node.type === BattleCombatantCard && node.props.role === 'selected',
      )!
      expect(local.props.proposedCosts).toEqual({ actorId: 'actor', ap: 47, mp: 3, hp: 2 })
      expect(selected.props.proposedCosts).toBeUndefined()
      expect(JSON.stringify(input.state)).toBe(original)
    },
  )
  it(mode + ' opens final facing only in the preview without duplicate cockpit arrows', () => {
    const input = fixture('basic.guard', mode)
    input.begin('finish')
    const tree = input.render()
    const deck = find(tree, (node) => node.props['data-unified-command-deck'] === 'true')!
    const finish = find(
      deck,
      (node) => node.type === BattleSkillCommand && node.props.slot === 'finish',
    )!
    expect(finish.props.children).toBeUndefined()
    const preview = find(tree, (node) => node.props['data-battle-preview-strip'] === 'true')!
    const facing = find(preview, (node) => node.props['aria-label'] === 'Choose final facing')!
    expect(facing).not.toBeNull()
    for (const direction of ['north', 'south', 'west', 'east']) {
      expect(
        find(facing, (node) => node.props['aria-label'] === `Face ${direction}`),
      ).not.toBeNull()
    }
    expect(input.commit).not.toHaveBeenCalled()
  })
  it.each(['basic.guard', 'basic.recover', 'basic.recover.mp'] as const)(
    mode + ' feedback uses the captured %s name without restoring stock cost or effect claims',
    async (support) => {
      const input = fixture(support, mode)
      const before = JSON.stringify(input.state)
      await input.activate()
      expect(input.previews[0]!.preview).toMatchObject({
        kind: 'action',
        legal: true,
        commandCosts: [
          { resource: 'ap', amount: 47 },
          { resource: 'mp', amount: 3 },
          { resource: 'hp', amount: 2 },
        ],
      })
      expect(input.notice()).toBe('Second Wind forecast ready.')
      expect(input.requests[0]!.intent).toMatchObject({
        kind: 'action',
        actionId: support,
        target: { kind: 'self' },
      })
      expect(input.commit).not.toHaveBeenCalled()
      expect(JSON.stringify(input.state)).toBe(before)
    },
  )
}

for (const mode of ['pve', 'pvp'] as const) {
  it(mode + ' announces the renamed Basic Attack from the real legal forecast', async () => {
    const input = fixture('basic.guard', mode)
    await input.activate('attack')
    expect(input.notice()).toBe('Open Palm forecast ready.')
    expect(input.previews[0]!.preview).toMatchObject({
      kind: 'action',
      legal: true,
      actionId: 'basic.attack.unarmed.basic',
    })
    expect(input.commit).not.toHaveBeenCalled()
  })
  it(
    mode + ' lights only the current native primed Controlled Attack after its legal forecast',
    async () => {
      const input = fixture('basic.guard', mode, { controlledAttack: true })
      const before = JSON.stringify(input.state)
      const artwork = () =>
        find(
          input.render(),
          (node) => node.type === BattleSkillCommand && node.props.slot === 'attack',
        )!.props
      expect(artwork().controlledReady).toBe(false)
      await input.activate('attack')
      expect(input.previews[0]!.preview).toMatchObject({
        kind: 'action',
        legal: true,
        controlledReady: true,
      })
      expect(input.notice()).toBe('Open Palm ready to release.')
      expect(artwork().controlledReady).toBe(true)
      expect(JSON.stringify(input.state)).toBe(before)
      expect(input.commit).not.toHaveBeenCalled()
    },
  )
  it(mode + ' rejects a stale-version response without a ready notice or glow', async () => {
    const input = fixture('basic.guard', mode, { controlledAttack: true, stale: true })
    await input.activate('attack')
    expect(input.notice()).toBe('That forecast is out of date. Choose a target to check it again.')
    expect(
      find(
        input.render(),
        (node) => node.type === BattleSkillCommand && node.props.slot === 'attack',
      )!.props.controlledReady,
    ).toBe(false)
    expect(input.commit).not.toHaveBeenCalled()
  })
  it(mode + ' keeps the blocked response explanation and suppresses readiness', async () => {
    const input = fixture('basic.guard', mode, { blocked: true })
    await input.activate()
    expect(input.notice()).toBe('Release is blocked.')
    expect(
      find(
        input.render(),
        (node) => node.type === BattleSkillCommand && node.props.slot === 'guard',
      )!.props.controlledReady,
    ).toBe(false)
    expect(input.commit).not.toHaveBeenCalled()
  })
  it(mode + ' discards a late legal Controlled forecast after leaving the action', async () => {
    const input = fixture('basic.guard', mode, { controlledAttack: true, delayed: true })
    input.begin('attack')
    await vi.waitFor(() => expect(input.previews, String(input.notice())).toHaveLength(1))
    const inspect = find(
      input.render(),
      (node) => node.type === BattleSkillCommand && node.props.slot === 'inspect',
    )!
    ;(inspect.props.onActivate as () => void)()
    expect(input.network.mock.calls[0]![1]!.signal!.aborted).toBe(true)
    input.release()
    await input.network.mock.results[0]!.value
    await Promise.resolve()
    await vi.waitFor(() =>
      expect(input.notice()).toBe('Choose a character or tile to inspect. No AP is spent.'),
    )
    expect(
      find(
        input.render(),
        (node) => node.type === BattleSkillCommand && node.props.slot === 'attack',
      )!.props.controlledReady,
    ).toBe(false)
    expect(input.commit).not.toHaveBeenCalled()
  })
}

function authoredPayload(id: string): CombatTagPayload {
  const payload = createAuthorableEffectPayload(id)
  if (!payload) throw new Error(`Expected implemented authoring payload: ${id}`)
  return payload
}
const utilityPayloads = [
  ...new Set([
    'copy-buffs',
    'copy-debuffs',
    'cleanse',
    'conditional-cleanse',
    'dispel',
    'mp-drain',
    'barrier',
    'counter',
    'status:guarded',
    'status:mark',
    'status:inspired',
    'status:invisible',
    'status:covert',
    'status:frozen',
    'reveal',
    'push',
    'pull',
    ...AUTHORABLE_EFFECT_TAGS.filter(
      (tag) => tag.opcode === 'apply-status' && !tag.unavailableReason,
    ).map((tag) => tag.id),
  ]),
].map((id) => ({
  id,
  payload: { ...authoredPayload(id), recipient: 'primary-unit' } as CombatTagPayload,
}))
const recoveryPayloads = ['hp-recovery', 'mp-recovery'].map((id) => ({
  id,
  payload: { ...authoredPayload(id), recipient: 'primary-unit' } as CombatTagPayload,
}))
const capturedPayloadCases = [
  ...utilityPayloads.map((row) => ({
    ...row,
    kind: 'utility' as const,
    palette: 'data-buff-path',
  })),
  ...recoveryPayloads.map((row) => ({
    ...row,
    kind: 'healing' as const,
    palette: 'data-heal-target',
  })),
  {
    id: 'retained-flat-mp-recovery',
    kind: 'healing' as const,
    palette: 'data-heal-target',
    payload: {
      type: 'resource-change',
      recipient: 'primary-unit',
      resource: 'mp',
      delta: 2,
    } as CombatTagPayload,
  },
  // Current Chilled Ground and retained Freeze Ground share this captured opcode.
  {
    id: 'chilled-ground',
    kind: 'ground' as const,
    palette: 'data-ground-path',
    payload: {
      type: 'create-terrain',
      recipient: 'affected-tiles',
      terrain: 'frozen',
      skillApSurcharge: 10,
    } as CombatTagPayload,
  },
  {
    id: 'copy-plus-damage',
    kind: 'utility' as const,
    palette: 'data-attack-path',
    payload: authoredPayload('copy-buffs'),
    withDamage: true,
  },
  ...['damage', 'pierce', 'burn', 'bleed', 'poison'].map((id) => ({
    id,
    kind: 'damage' as const,
    palette: 'data-attack-path',
    payload: authoredPayload(id),
  })),
  ...['weak-point', 'spike', 'ruin'].map((id) => ({
    id,
    kind: 'damage' as const,
    palette: 'data-attack-path',
    payload: authoredPayload(id),
    withDamage: true,
  })),
  {
    id: 'summon',
    kind: 'ground' as const,
    palette: 'data-ground-path',
    payload: createAuthorableEffectPayload('summon', {
      summonProfile: resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!,
    })!,
  },
]

for (const [mode, desktop] of [
  ['pve', false],
  ['pvp', true],
] as const) {
  it.each(capturedPayloadCases)(
    `${mode} ${desktop ? 'desktop' : 'mobile'} keeps the full captured $id Single reach and its canonical palette`,
    ({ payload, kind, palette, ...row }) => {
      hooks.desktop = desktop
      const input = fixture(kind === 'healing' ? 'basic.recover' : 'basic.guard', mode, {
        targetPreview: kind,
        targetPayload: payload,
        withDamage: 'withDamage' in row && row.withDamage,
      })
      const before = JSON.stringify(input.state)
      input.begin('guard')
      const tree = input.render()
      const actor = input.state.tactical.placements.find(
        (placement) => placement.combatantId === 'actor',
      )!
      for (const tile of input.state.tactical.tiles) {
        const button = find(
          tree,
          (node) =>
            node.type === 'button' &&
            String(node.props['aria-label']).startsWith(
              `Tile ${tile.position.x + 1}, ${tile.position.y + 1};`,
            ),
        )!
        const distance =
          Math.abs(tile.position.x - actor.position.x) +
          Math.abs(tile.position.y - actor.position.y)
        const occupied = input.state.tactical.placements.some(
          (placement) =>
            placement.position.x === tile.position.x &&
            placement.position.y === tile.position.y &&
            input.state.tactical.battle.combatants.some(
              (unit) => unit.id === placement.combatantId && unit.hp > 0,
            ),
        )
        const eligible = distance >= 1 && distance <= 3 && (payload.type !== 'summon' || !occupied)
        for (const attr of [
          'data-buff-path',
          'data-heal-target',
          'data-ground-path',
          'data-attack-path',
        ])
          expect(
            button.props[attr],
            `${row.id}: ${String(button.props['aria-label'])} ${attr}`,
          ).toBe(attr === palette && eligible ? true : undefined)
      }
      expect(JSON.stringify(input.state)).toBe(before)
      expect(input.commit).not.toHaveBeenCalled()
    },
  )

  it.each(['copy-buffs', 'copy-debuffs', 'cleanse', 'dispel'])(
    `${mode} a highlighted empty tile cannot commit captured %s`,
    (id) => {
      hooks.desktop = desktop
      const input = fixture('basic.guard', mode, {
        targetPreview: 'utility',
        targetPayload: authoredPayload(id),
      })
      input.begin('guard')
      const button = find(
        input.render(),
        (node) =>
          node.type === 'button' && String(node.props['aria-label']).startsWith('Tile 1, 2;'),
      )!
      expect(button.props['data-buff-path']).toBe(true)
      const beforeRequests = input.requests.length
      ;(button.props.onClick as () => void)()
      expect(input.notice()).toBe('Choose an eligible target in range.')
      expect(input.requests).toHaveLength(beforeRequests)
      expect(input.commit).not.toHaveBeenCalled()
    },
  )

  it.each(['reversal', 'endure', 'rewind'])(
    `${mode} captured Self-only %s never paints unrelated range`,
    (id) => {
      hooks.desktop = desktop
      const input = fixture('basic.guard', mode, {
        targetPreview: 'utility',
        targetPayload: authoredPayload(id),
        selfTarget: true,
      })
      input.begin('guard')
      const tree = input.render()
      const actor = input.state.tactical.placements.find(
        (placement) => placement.combatantId === 'actor',
      )!
      for (const tile of input.state.tactical.tiles) {
        const button = find(
          tree,
          (node) =>
            node.type === 'button' &&
            String(node.props['aria-label']).startsWith(
              `Tile ${tile.position.x + 1}, ${tile.position.y + 1};`,
            ),
        )!
        const isSelf = tile.position.x === actor.position.x && tile.position.y === actor.position.y
        expect(button.props['data-buff-path']).toBe(isSelf ? true : undefined)
        expect(button.props['data-attack-path']).not.toBe(true)
        expect(button.props['data-heal-target']).not.toBe(true)
        expect(button.props['data-ground-path']).not.toBe(true)
      }
      expect(input.commit).not.toHaveBeenCalled()
    },
  )
}

for (const desktop of [false, true]) {
  for (const mode of ['pve', 'pvp'] as const) {
    it.each(['utility', 'healing'] as const)(
      `${mode} ${desktop ? 'desktop' : 'mobile'} paints the complete Single %s potential range`,
      (kind) => {
        hooks.desktop = desktop
        const input = fixture(kind === 'healing' ? 'basic.recover' : 'basic.guard', mode, {
          targetPreview: kind,
        })
        const before = JSON.stringify(input.state)
        input.begin('guard')
        const tree = input.render()
        const actor = input.state.tactical.placements.find((row) => row.combatantId === 'actor')!
        const attr = kind === 'healing' ? 'data-heal-target' : 'data-buff-path'
        for (const tile of input.state.tactical.tiles) {
          const button = find(
            tree,
            (node) =>
              node.type === 'button' &&
              String(node.props['aria-label']).startsWith(
                `Tile ${tile.position.x + 1}, ${tile.position.y + 1};`,
              ),
          )!
          const distance =
            Math.abs(tile.position.x - actor.position.x) +
            Math.abs(tile.position.y - actor.position.y)
          expect(button.props[attr], String(button.props['aria-label'])).toBe(
            distance <= 3 ? true : undefined,
          )
          expect(button.props['data-attack-path']).not.toBe(true)
          expect(button.props['data-ground-path']).not.toBe(true)
        }
        expect(JSON.stringify(input.state)).toBe(before)
        expect(input.commit).not.toHaveBeenCalled()
      },
    )
    it.each([false, true])(
      `${mode} ${desktop ? 'desktop' : 'mobile'} keeps Attack Physical Blind Single15 reach with damage=%s`,
      (withDamage) => {
        hooks.desktop = desktop
        const input = fixture('basic.guard', mode, {
          targetPreview: 'utility',
          blindAttack: true,
          withDamage,
          largeBoard: true,
        })
        const before = JSON.stringify(input.state)
        input.begin('guard')
        const tree = input.render()
        const actor = input.state.tactical.placements.find((row) => row.combatantId === 'actor')!
        for (const tile of input.state.tactical.tiles) {
          const button = find(
            tree,
            (node) =>
              node.type === 'button' &&
              String(node.props['aria-label']).startsWith(
                `Tile ${tile.position.x + 1}, ${tile.position.y + 1};`,
              ),
          )!
          const isActor =
            tile.position.x === actor.position.x && tile.position.y === actor.position.y
          expect(
            button.props[withDamage ? 'data-attack-path' : 'data-buff-path'],
            String(button.props['aria-label']),
          ).toBe(isActor ? undefined : true)
          expect(button.props[withDamage ? 'data-buff-path' : 'data-attack-path']).not.toBe(true)
          expect(button.props['data-heal-target']).not.toBe(true)
          expect(button.props['data-ground-path']).not.toBe(true)
        }
        const ally = input.state.tactical.placements.find((row) => row.combatantId === 'ally')!
        const allyTile = find(
          tree,
          (node) =>
            node.type === 'button' &&
            String(node.props['aria-label']).startsWith(
              `Tile ${ally.position.x + 1}, ${ally.position.y + 1};`,
            ),
        )!
        if (mode === 'pve') expect(allyTile.props['data-target']).toBeUndefined()
        expect(JSON.stringify(input.state)).toBe(before)
        expect(input.commit).not.toHaveBeenCalled()
      },
    )
  }
}

for (const mode of ['pve', 'pvp'] as const) {
  it.each(['damage', 'line', 'circle', 'all', 'ground'] as const)(
    mode + ' retains empty-tile %s footprints',
    (kind) => {
      const input = fixture('basic.guard', mode, {
        targetPreview: kind,
      })
      input.begin('guard')
      const tree = input.render()
      const attr =
        kind === 'damage'
          ? 'data-attack-path'
          : kind === 'ground'
            ? 'data-ground-path'
            : 'data-buff-path'
      const actor = input.state.tactical.placements.find((row) => row.combatantId === 'actor')!
      for (const tile of input.state.tactical.tiles) {
        const button = find(
          tree,
          (node) =>
            node.type === 'button' &&
            String(node.props['aria-label']).startsWith(
              `Tile ${tile.position.x + 1}, ${tile.position.y + 1};`,
            ),
        )!
        const dx = Math.abs(tile.position.x - actor.position.x)
        const dy = Math.abs(tile.position.y - actor.position.y)
        const expected =
          kind === 'all' ||
          (kind === 'line'
            ? (dx === 0 || dy === 0) && dx + dy >= 1 && dx + dy <= 3
            : kind === 'circle'
              ? Math.max(dx, dy) >= 1 && Math.max(dx, dy) <= 3
              : dx + dy <= 3)
        expect(button.props[attr], String(button.props['aria-label'])).toBe(
          expected ? true : undefined,
        )
        if (kind !== 'damage') expect(button.props['data-attack-path']).not.toBe(true)
        if (kind !== 'ground') expect(button.props['data-ground-path']).not.toBe(true)
      }
      expect(input.commit).not.toHaveBeenCalled()
    },
  )
  it(mode + ' separates legal Move destinations from post-move potential range', () => {
    const input = fixture('basic.guard', mode, { targetPreview: 'utility', withMove: true })
    input.begin('guard')
    const tree = input.render()
    const enemy = find(
      tree,
      (node) => node.type === 'button' && String(node.props['aria-label']).startsWith('Tile 3, 2;'),
    )!
    expect(enemy.props['data-reachable']).not.toBe(true)
    const destination = find(
      tree,
      (node) =>
        node.type === 'button' &&
        node.props['data-reachable'] === true &&
        String(node.props['aria-label']).startsWith('Tile 2, 1;'),
    )!
    expect(destination).not.toBeNull()
    ;(destination.props.onClick as () => void)()
    const aimed = input.render()
    expect(
      find(
        aimed,
        (node) =>
          node.type === 'button' && String(node.props['aria-label']).startsWith('Tile 3, 2;'),
      )!.props['data-buff-path'],
    ).toBe(true)
    expect(
      find(
        aimed,
        (node) =>
          node.type === 'button' &&
          String(node.props['aria-label']).startsWith('Tile ') &&
          !String(node.props['aria-label']).includes('occupied by') &&
          node.props['data-buff-path'] === true,
      ),
    ).not.toBeNull()
    expect(input.commit).not.toHaveBeenCalled()
  })
}

for (const mode of ['pve', 'pvp'] as const) {
  it.each(['success', 'failure', 'network-error'] as const)(
    `${mode} clears Ground targeting only after a successful cast (%s)`,
    async (commitResult) => {
      const input = fixture('basic.guard', mode, { targetPreview: 'ground', commitResult })
      input.begin('guard')
      const tile = () =>
        find(
          input.render(),
          (node) =>
            node.type === 'button' && String(node.props['aria-label']).startsWith('Tile 1, 1;'),
        )!
      expect(tile().props['data-ground-path']).toBe(true)
      ;(tile().props.onClick as () => void)()
      await vi.waitFor(() =>
        expect(input.notice()).toContain(
          commitResult === 'success' ? 'AP remains.' : 'The chosen Ground cast was rejected.',
        ),
      )
      expect(tile().props['data-ground-path']).toBe(commitResult === 'success' ? undefined : true)
      expect(
        input.network.mock.calls.filter(([url]) => !String(url).endsWith('/preview')),
      ).toHaveLength(1)
    },
  )
  it(`${mode} keeps a successful ordinary unit cast armed`, async () => {
    const input = fixture('basic.guard', mode, {
      targetPreview: 'utility',
      commitResult: 'success',
    })
    input.begin('guard')
    const tile = () =>
      find(
        input.render(),
        (node) =>
          node.type === 'button' && String(node.props['aria-label']).startsWith('Tile 3, 2;'),
      )!
    expect(tile().props['data-buff-path']).toBe(true)
    ;(tile().props.onClick as () => void)()
    await vi.waitFor(() => expect(input.notice()).toContain('AP remains.'))
    expect(tile().props['data-buff-path']).toBe(true)
  })
}

for (const mode of ['pve', 'pvp'] as const) {
  it.each(['unit', 'ground'] as const)(
    `${mode} keeps dual Fire unit casts armed and clears actual Ground casts (%s)`,
    async (aim) => {
      const input = fixture('basic.guard', mode, {
        targetPreview: 'damage',
        dualGroundIntent: true,
        commitResult: 'success',
      })
      expect(
        input.view.snapshot.manualActionTargets?.find((row) => row.actionId === 'basic.guard')
          ?.groundIntentCapable,
      ).toBe(true)
      input.begin('guard')
      const tile = () =>
        find(
          input.render(),
          (node) =>
            node.type === 'button' &&
            String(node.props['aria-label']).startsWith(
              aim === 'unit' ? 'Tile 3, 2;' : 'Tile 1, 1;',
            ),
        )!
      expect(tile().props['data-ground-path']).toBe(true)
      ;(tile().props.onClick as () => void)()
      await vi.waitFor(() => expect(input.notice()).toContain('AP remains.'))
      const commands = input.requests.filter((row) => row.intent.kind === 'action')
      expect(commands.at(-1)?.intent).toMatchObject({
        target: { kind: aim === 'unit' ? 'unit' : 'tile' },
      })
      expect(tile().props['data-ground-path']).toBe(aim === 'unit' ? true : undefined)
    },
  )
}

function updateFixtureBoard(
  input: ReturnType<typeof fixture>,
  change: (
    board: StatDrivenCombatEncounterState['tactical'],
  ) => StatDrivenCombatEncounterState['tactical'],
) {
  const tactical = change(input.state.tactical)
  input.state.tactical = tactical
  input.view.snapshot.tactical = tactical
}

for (const mode of ['pve', 'pvp'] as const) {
  it.each([
    { id: 'basic.pilfer', label: 'Pilfer', ap: 15, mp: 0, cooldown: 1, tile: 'Tile 3, 2;' },
    { id: 'basic.fleetstep', label: 'Fleetstep', ap: 30, mp: 0, cooldown: 2, tile: 'Tile 1, 2;' },
    {
      id: 'basic.invocation',
      label: 'Invocation',
      ap: 45,
      mp: 10,
      cooldown: 4,
      tile: 'Tile 2, 1;',
    },
  ] as const)(
    `${mode} slot3 uses captured $label targeting, payment and cooldown in a single command`,
    async ({ id, label, ap, mp, cooldown, tile: tileLabel }) => {
      const input = fixture(id, mode, { currentSupportDefaults: true, commitResult: 'success' })
      const support = () =>
        find(
          input.render(),
          (node) => node.type === BattleSkillCommand && node.props.slot === 'guard',
        )!
      expect(support().props.label).toBe(label)
      expect(support().props.cost).toBe(mp ? `${ap} AP / ${mp} MP` : `${ap} AP`)
      input.begin('guard')
      const tile = find(
        input.render(),
        (node) => node.type === 'button' && String(node.props['aria-label']).startsWith(tileLabel),
      )!
      expect(tile).not.toBeNull()
      ;(tile.props.onClick as () => void)()
      await vi.waitFor(() =>
        expect(support().props.cooldownTurns, String(input.notice())).toBe(cooldown),
      )
      const sent = input.requests.filter(
        (row) => row.intent.kind === 'action' && row.intent.actionId === id,
      )
      expect(
        input.network.mock.calls.filter(([url]) => !String(url).endsWith('/preview')),
      ).toHaveLength(1)
      expect(sent.at(-1)?.intent).toMatchObject({ kind: 'action', actionId: id })
      expect(readPv1fActionEconomy(input.currentState(), 'actor')?.current).toBe(100 - ap)
      expect(
        input.currentState().tactical.battle.combatants.find((row) => row.id === 'actor')?.mp,
      ).toBe(10 - mp)
      expect(support().props.cooldownTurns).toBe(cooldown)
      if (id === 'basic.pilfer')
        expect(
          input.currentState().tactical.battle.combatants.find((row) => row.id === 'enemy')?.hp,
        ).toBe(996)
      if (id === 'basic.fleetstep')
        expect(
          input.currentState().tactical.placements.find((row) => row.combatantId === 'actor')
            ?.position,
        ).toEqual({ x: 0, y: 1 })
      if (id === 'basic.invocation')
        expect(input.currentState().effectState?.summons).toHaveLength(1)
    },
  )
}

for (const mode of ['pve', 'pvp'] as const) {
  for (const desktop of [false, true]) {
    it.each(['basic', 'skill'] as const)(
      `${mode} ${desktop ? 'desktop' : 'mobile'} keeps an out-of-range Single %s enemy quiet after hover and selection`,
      (kind) => {
        hooks.desktop = desktop
        const input = fixture('basic.guard', mode, {
          ...(kind === 'skill' ? { targetPreview: 'damage' as const } : {}),
        })
        const position = kind === 'basic' ? { x: 3, y: 1 } : { x: 4, y: 2 }
        updateFixtureBoard(input, (board) => ({
          ...board,
          placements: board.placements.map((row) => ({
            ...row,
            position:
              row.combatantId === 'enemy'
                ? position
                : row.combatantId === 'other'
                  ? { x: 4, y: 4 }
                  : row.position,
          })),
        }))
        input.begin(kind === 'basic' ? 'attack' : 'guard')
        const tile = () =>
          find(
            input.render(),
            (node) =>
              node.type === 'button' &&
              String(node.props['aria-label']).startsWith(
                `Tile ${position.x + 1}, ${position.y + 1};`,
              ),
          )!
        const quiet = () => {
          expect(tile().props['data-attack-path']).not.toBe(true)
          expect(tile().props['data-target']).not.toBe('enemy')
          expect(tile().props['data-affected']).not.toBe(true)
        }
        quiet()
        const before = input.requests.length
        ;(tile().props.onPointerEnter as (event: unknown) => void)({ pointerType: 'mouse' })
        quiet()
        ;(tile().props.onClick as () => void)()
        quiet()
        expect(input.requests).toHaveLength(before)
        expect(input.notice()).toBe('Choose an eligible target in range.')
      },
    )
    it.each([
      { kind: 'basic', moved: 'actor' },
      { kind: 'basic', moved: 'enemy' },
      { kind: 'skill', moved: 'actor' },
      { kind: 'skill', moved: 'enemy' },
    ] as const)(
      `${mode} ${desktop ? 'desktop' : 'mobile'} removes the old Single $kind forecast when the $moved moves out of range`,
      async ({ kind, moved }) => {
        hooks.desktop = desktop
        const input = fixture('basic.guard', mode, {
          ...(kind === 'skill' ? { targetPreview: 'damage' as const } : {}),
        })
        await input.activate(kind === 'basic' ? 'attack' : 'guard')
        expect(
          find(input.render(), (node) => node.type === BattleActionPreview)!.props.preview,
        ).not.toBeNull()
        updateFixtureBoard(input, (board) => ({
          ...board,
          placements: board.placements.map((row) =>
            row.combatantId === moved
              ? { ...row, position: moved === 'actor' ? { x: 0, y: 4 } : { x: 4, y: 2 } }
              : row,
          ),
        }))
        input.view.battleVersion += 1
        const tree = input.render()
        const enemyPosition = moved === 'actor' ? { x: 2, y: 1 } : { x: 4, y: 2 }
        const tile = find(
          tree,
          (node) =>
            node.type === 'button' &&
            String(node.props['aria-label']).startsWith(
              `Tile ${enemyPosition.x + 1}, ${enemyPosition.y + 1};`,
            ),
        )!
        expect(tile.props['data-attack-path']).not.toBe(true)
        expect(tile.props['data-target']).not.toBe('enemy')
        expect(tile.props['data-affected']).not.toBe(true)
        expect(find(tree, (node) => node.type === BattleActionPreview)!.props.preview).toBeNull()
      },
    )
    it.each(['elevation', 'line-of-sight'] as const)(
      `${mode} ${desktop ? 'desktop' : 'mobile'} does not paint a spatially invalid Single enemy (%s)`,
      (boundary) => {
        hooks.desktop = desktop
        const input = fixture('basic.guard', mode, { targetPreview: 'damage', spatialAttack: true })
        const enemyPosition = boundary === 'elevation' ? { x: 2, y: 1 } : { x: 3, y: 1 }
        updateFixtureBoard(input, (board) => ({
          ...board,
          terrains: [...board.terrains, { id: 'wall', traversalCost: null }],
          tiles: board.tiles.map((tile) => ({
            ...tile,
            elevation:
              boundary === 'elevation' && tile.position.x === 2 && tile.position.y === 1 ? 1 : 0,
            terrainId:
              boundary === 'line-of-sight' && tile.position.x === 2 && tile.position.y === 1
                ? 'wall'
                : tile.terrainId,
          })),
          placements: board.placements.map((row) =>
            row.combatantId === 'enemy'
              ? { ...row, position: enemyPosition }
              : row.combatantId === 'other'
                ? { ...row, position: { x: 4, y: 4 } }
                : row,
          ),
        }))
        input.begin('guard')
        const tile = () =>
          find(
            input.render(),
            (node) =>
              node.type === 'button' &&
              String(node.props['aria-label']).startsWith(
                `Tile ${enemyPosition.x + 1}, ${enemyPosition.y + 1};`,
              ),
          )!
        expect(tile().props['data-attack-path']).not.toBe(true)
        expect(tile().props['data-target']).not.toBe('enemy')
        ;(tile().props.onPointerEnter as (event: unknown) => void)({ pointerType: 'mouse' })
        expect(tile().props['data-attack-path']).not.toBe(true)
      },
    )
    it(`${mode} ${desktop ? 'desktop' : 'mobile'} keeps Line hover inside its authored length toward an out-of-range enemy`, async () => {
      hooks.desktop = desktop
      const input = fixture('basic.guard', mode, {
        targetPreview: 'line',
        withDamage: true,
      })
      updateFixtureBoard(input, (board) => ({
        ...board,
        tiles: board.tiles.map((tile) => ({ ...tile, elevation: 0 })),
        placements: board.placements.map((row) =>
          row.combatantId === 'enemy'
            ? { ...row, position: { x: 4, y: 1 } }
            : row.combatantId === 'actor'
              ? { ...row, position: { x: 0, y: 1 } }
              : row,
        ),
      }))
      input.begin('guard')
      const tile = (x: number) =>
        find(
          input.render(),
          (node) =>
            node.type === 'button' &&
            String(node.props['aria-label']).startsWith(`Tile ${x + 1}, 2;`),
        )!
      expect(tile(4).props['data-attack-path']).not.toBe(true)
      ;(tile(4).props.onPointerEnter as (event: unknown) => void)({ pointerType: 'mouse' })
      await vi.waitFor(() => expect(input.previews.length).toBeGreaterThan(0))
      expect(tile(3).props['data-attack-path']).toBe(true)
      expect(tile(4).props['data-attack-path']).not.toBe(true)
      expect(tile(4).props['data-target']).not.toBe('enemy')
    })
  }
}
