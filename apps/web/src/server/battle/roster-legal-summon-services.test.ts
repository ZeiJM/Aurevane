import { appendFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import type {
  BattleSessionCommitRecord,
  BattleSessionRecord,
  BattleSessionRepository,
  CommitBattleIntentInput,
} from '@aurevane/db/battle-session'
import type { CharacterRepository } from '@aurevane/db/character'
import {
  finishPv1fTurn,
  PV1F_BASIC_ATTACK_ID,
  readPv1fActionEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  createAiQualityResources,
  createPvpQualityResources,
} from '@aurevane/game-core/combat/pvp-quality'
import { validateStatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { StaleBattleVersionError } from '@aurevane/game-core/errors'
import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import { createLegalRosterDuel, legalRosterCycleKits } from './roster-legal-duel.test-utils'
import { resolver } from './roster-legal-build.test-utils'
import {
  createBattleSessionService,
  type BattleAuthoritativeEncounterState,
  type BattleSessionView,
} from './battle-session-service'
import { createBattleRecruitAiService } from './battle-recruit-ai-service'

vi.mock('server-only', () => ({}))
const adapters = vi.hoisted(() => ({
  repository: null as BattleSessionRepository | null,
  rpc: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc: adapters.rpc }),
}))
vi.mock('@/server/character/supabase-character-repository', () => ({
  createSupabaseCharacterRepository: () => ({}),
}))
vi.mock('./supabase-battle-session-repository', () => ({
  createSupabaseBattleSessionRepository: () => adapters.repository,
}))
import { tickAiTurnClock } from './ai-battle-quality-service'
import { tickPvpTurnClock } from './pvp-battle-quality-service'

const call = 'wildwarden.renewing-herbs'
const sessionId = '33333333-3333-4333-8333-333333333333'
const at = '2026-10-17T10:40:00.000Z'
const base = legalRosterCycleKits.find((k) => k.primary === 'wildwarden' && !k.secondary)!
const kit = {
  ...base,
  name: `${base.name}:earned-summon`,
  ids: base.ids.map((id) => (id === 'wildwarden.field-remedy' ? call : id)),
}
const opponentKit = legalRosterCycleKits.find((k) => k.primary === 'vanguard' && !k.secondary)!
const cases = ([1, 100] as const).flatMap((level) =>
  (['pve', 'pvp'] as const).map((context) => ({ name: `${level}:${context}`, level, context })),
)
type State = BattleAuthoritativeEncounterState
const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x))
const eventsOf = (events: readonly unknown[], name: string) =>
  events.filter(
    (e): e is Record<string, unknown> =>
      !!e && typeof e === 'object' && 'event' in e && e.event === name,
  )
const unit = (state: State, id: string) =>
  state.tactical.battle.combatants.find((u) => u.id === id)!
const summon = (state: State) => state.effectState?.summons?.[0]

async function fixture(scenario: (typeof cases)[number]) {
  const duel = await createLegalRosterDuel({
    kit,
    opponentKit,
    level: scenario.level,
    context: scenario.context,
    seed: 1,
    board: {
      width: 6,
      height: 4,
      positions: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
    },
  })
  const owner = duel.participants[0]!,
    opponent = duel.participants[1]!
  let initial = duel.state
  for (let n = 0; initial.tactical.battle.currentTurn!.combatantId !== owner.actorId; n++) {
    expect(n).toBeLessThan(3)
    const actor = initial.tactical.battle.currentTurn!.combatantId
    initial = finishPv1fTurn(
      initial,
      initial.tactical.placements.find((p) => p.combatantId === actor)!.facing,
    ).state
  }
  // Match creation's quality tracking metadata without changing combat resources.
  const quality = scenario.context === 'pvp' ? createPvpQualityResources : createAiQualityResources
  let state: State = copy({
    ...initial,
    buildAuthority: duel.authority,
    tactical: {
      ...initial.tactical,
      battle: {
        ...initial.tactical.battle,
        combatants: initial.tactical.battle.combatants.map((u) => ({
          ...u,
          temporaryResources: [...u.temporaryResources, ...quality()].sort((a, b) =>
            a.key.localeCompare(b.key),
          ),
        })),
      },
    },
  })
  expect(validateStatDrivenCombatEncounterState(state)).toEqual([])
  const admitted = copy(state)
  let version = 1,
    serial = 0
  const commits: CommitBattleIntentInput[] = []
  const replay = new Map<string, { fingerprint: string; result: BattleSessionCommitRecord }>()
  const userFor = (id: string) => duel.participants.find((p) => p.actorId === id)!.character.userId
  const controlled = (userId: string) =>
    duel.participants.filter((p) => p.character.userId === userId).map((p) => p.actorId)
  const record = (userId: string): BattleSessionRecord => ({
    battleSessionId: sessionId,
    battleId: state.tactical.battle.battleId,
    battleVersion: version,
    rulesVersion: state.tactical.battle.rulesVersion,
    contentVersion: state.tactical.battle.contentVersion,
    lifecycle: state.tactical.battle.lifecycle,
    snapshot: copy(state),
    controlledCombatantIds: controlled(userId),
    updatedAt: at,
  })
  const repository: BattleSessionRepository = {
    createBattleSession: async () => {
      throw Error(
        'This fixture restores an earned encounter; creation is covered by the shared helper.',
      )
    },
    findBattleSession: async (userId, id) =>
      id === sessionId && controlled(userId).length ? record(userId) : null,
    findBattleIntentReplay: async (input) => {
      const saved = replay.get(`${input.actorKey}:${input.idempotencyKey}`)
      return saved?.fingerprint === input.requestFingerprint ? copy(saved.result) : null
    },
    commitBattleIntent: async (input) => {
      const key = `${input.actorKey}:${input.idempotencyKey}`,
        saved = replay.get(key)
      if (saved?.fingerprint === input.requestFingerprint)
        return { replayed: true, result: copy(saved.result) }
      if (input.expectedBattleVersion !== version) throw new StaleBattleVersionError(version)
      const next = copy(input.nextSnapshot) as State
      expect(validateStatDrivenCombatEncounterState(next)).toEqual([])
      expect(next.buildAuthority).toEqual(duel.authority)
      expect(next.capturedAbilitySources).toEqual(initial.capturedAbilitySources)
      expect(input.privacyJournal).toMatchObject({ schemaVersion: 1 })
      state = next
      version++
      commits.push(copy(input))
      const result = {
        battleSessionId: sessionId,
        battleVersion: version,
        snapshot: copy(state),
        committedAt: at,
      }
      replay.set(key, { fingerprint: input.requestFingerprint, result })
      return { replayed: false, result: copy(result) }
    },
  }
  const service = () =>
    createBattleSessionService({
      characters: {} as CharacterRepository,
      battles: repository,
      combatContentResolver: resolver,
    })
  const intent = (actorId: string, value: BattleIntent) => ({
    userId: userFor(actorId),
    battleSessionId: sessionId,
    expectedBattleVersion: version,
    idempotencyKey: `44444444-4444-4444-8444-${String(++serial).padStart(12, '0')}`,
    intent: value,
  })
  const face = async () => {
    const actor = state.tactical.battle.currentTurn!.combatantId
    const facing = state.tactical.placements.find((p) => p.combatantId === actor)!.facing
    return service().submitIntent(intent(actor, { kind: 'face', facing }))
  }
  const advance = async (targetId: string) => {
    for (let n = 0; state.tactical.battle.currentTurn!.combatantId !== targetId; n++) {
      expect(n).toBeLessThan(8)
      const actor = state.tactical.battle.currentTurn!.combatantId
      if (state.effectState?.summons?.some((s) => s.combatantId === actor))
        await createBattleRecruitAiService(repository).runTurn({
          userId: owner.character.userId,
          battleSessionId: sessionId,
          expectedBattleVersion: version,
        })
      else await face()
    }
  }
  let expiredTurn: number | null = null,
    staleClock: Record<string, unknown> | null = null
  const clock = () => {
    const t = state.tactical.battle.currentTurn
    if (
      !t ||
      state.tactical.battle.lifecycle !== 'active' ||
      t.combatantId.startsWith('summon:') ||
      (scenario.context === 'pve' && t.combatantId !== owner.actorId)
    )
      return { active: false, turn_timer_seconds: 60 }
    return {
      active: true,
      turn_number: state.tactical.battle.turnNumber,
      combatant_id: t.combatantId,
      deadline_at: at,
      expired: expiredTurn === state.tactical.battle.turnNumber,
      turn_timer_seconds: 60,
    }
  }
  adapters.repository = repository
  adapters.rpc.mockImplementation(async (name: string) => {
    if (name.startsWith('ensure_')) {
      const result = staleClock ?? clock()
      staleClock = null
      return { data: result, error: null }
    }
    if (name === 'get_ai_timeout_context_v1' || name === 'get_pvp_timeout_context_v1')
      return { data: { previous_turn_missed: false }, error: null }
    throw Error(`Unexpected external RPC ${name}`)
  })
  const tick = () =>
    (scenario.context === 'pvp' ? tickPvpTurnClock : tickAiTurnClock)(
      owner.character.userId,
      sessionId,
    )
  const spawn = async () => {
    const before = copy(state),
      command = intent(owner.actorId, {
        kind: 'action',
        actionId: call,
        target: { kind: 'tile', position: { x: 1, y: 2 } },
      })
    const result = await service().submitIntent(command)
    expect(result.battleVersion).toBe(2)
    expect(unit(state, owner.actorId).mp).toBe(unit(before, owner.actorId).mp - 6)
    expect(readPv1fActionEconomy(state, owner.actorId)!.current).toBe(50)
    expect(summon(state)).toMatchObject({
      sourceSkillId: call,
      sourceSkillVersion: 7,
      ownerCombatantId: owner.actorId,
      turnsCompleted: 0,
      profile: { maxHp: 36, maxMp: 12, lifetimeTurns: 5 },
    })
    expect(eventsOf(commits[0]!.events, 'summon_spawned')).toHaveLength(1)
    return { command, result, child: copy(summon(state)!) }
  }
  const trace = (kind: string) => {
    const path = process.env.AUREVANE_SUMMON_SERVICE_EVIDENCE
    if (path)
      appendFileSync(
        path,
        JSON.stringify({
          kind,
          ...scenario,
          seed: 1,
          initial: admitted,
          commits,
          final: copy(state),
          version,
        }) + '\n',
      )
  }
  return {
    owner,
    opponent,
    repository,
    service,
    intent,
    face,
    advance,
    spawn,
    tick,
    commits,
    trace,
    get state() {
      return copy(state)
    },
    get version() {
      return version
    },
    expire() {
      expiredTurn = state.tactical.battle.turnNumber
      return copy(clock())
    },
    stale(value: Record<string, unknown>) {
      staleClock = value
    },
  }
}

it.each(cases)(
  '$name persists one earned summon across replay, reload and five real AI turns',
  async (scenario) => {
    const f = await fixture(scenario),
      { command, result, child } = await f.spawn()
    const saved = JSON.stringify(f.state)
    const repeated = await f.service().submitIntent(command)
    expect(repeated).toMatchObject({ replayed: true, battleVersion: 2, snapshot: result.snapshot })
    expect(f.version).toBe(2)
    expect(JSON.stringify(f.state)).toBe(saved)
    await expect(
      f
        .service()
        .submitIntent({ ...command, idempotencyKey: '55555555-5555-4555-8555-555555555555' }),
    ).rejects.toBeInstanceOf(StaleBattleVersionError)
    expect(JSON.stringify(f.state)).toBe(saved)
    const restored = await f.service().getSession(f.owner.character.userId, sessionId)
    expect(restored.snapshot).toEqual(result.snapshot)
    expect(JSON.stringify(restored)).not.toMatch(
      /capturedAbilitySources|abilityRuntime|sourceInstanceId|effectOrigin/,
    )
    let childTurns = 0
    for (let n = 0; summon(f.state); n++) {
      expect(n).toBeLessThan(25)
      if (f.state.tactical.battle.currentTurn!.combatantId === child.combatantId) {
        await createBattleRecruitAiService(f.repository).runTurn({
          userId: f.owner.character.userId,
          battleSessionId: sessionId,
          expectedBattleVersion: f.version,
        })
        childTurns++
      } else await f.face()
    }
    expect(childTurns).toBe(5)
    const events = f.commits.flatMap((c) => c.events)
    expect(eventsOf(events, 'summon_expired')).toEqual([
      expect.objectContaining({ combatantId: child.combatantId, sourceSkillVersion: 7 }),
    ])
    expect(eventsOf(events, 'summon_defeated')).toEqual([])
    expect(eventsOf(events, 'summon_ability_used').length).toBeGreaterThan(0)
    expect(f.state.tactical.battle.lifecycle).toBe('active')
    expect(f.state.tactical.battle.combatants.some((u) => u.id === child.combatantId)).toBe(false)
    expect(f.state.tactical.placements.some((p) => p.combatantId === child.combatantId)).toBe(false)
    expect(f.state.tactical.battle.initiativeOrder).not.toContain(child.combatantId)
    expect(f.state.statBridge.combatants.some((p) => p.combatantId === child.combatantId)).toBe(
      false,
    )
    expect(
      f.state.turnTriggerState?.combatants.some((p) => p.combatantId === child.combatantId),
    ).toBe(false)
    f.trace('persisted-expiry')
  },
)

it.each(cases)(
  '$name exempts the paid summon turn from idle penalties and ignores its stale expired clock',
  async (scenario) => {
    const f = await fixture(scenario)
    await f.spawn()
    const before = f.state,
      expired = f.expire(),
      result = await f.tick()
    expect(result.timedOut).toBe(true)
    expect(f.version).toBe(3)
    const eventName = scenario.context === 'pvp' ? 'pvp_turn_timed_out' : 'ai_turn_timed_out'
    expect(eventsOf(f.commits[1]!.events, eventName)).toEqual([
      expect.objectContaining({
        combatantId: f.owner.actorId,
        hadActivity: true,
        consecutiveMisses: 0,
      }),
    ])
    expect(JSON.stringify(f.commits[1]!.events)).not.toContain('lowered_guard_applied')
    expect(summon(f.state)).toEqual(summon(before))
    expect(f.state.tactical.battle.turnNumber).toBe(before.tactical.battle.turnNumber + 1)
    const saved = JSON.stringify(f.state)
    f.stale(expired)
    expect((await f.tick()).timedOut).toBe(false)
    expect(JSON.stringify(f.state)).toBe(saved)
    expect(f.version).toBe(3)
    f.trace('paid-timeout-and-stale-clock')
  },
)

it.each(cases)(
  '$name saves actual player Basic defeat cleanup and replays its lethal command once',
  async (scenario) => {
    const f = await fixture(scenario)
    const { child } = await f.spawn()
    let lethal: ReturnType<typeof f.intent> | undefined
    let lethalView: BattleSessionView | undefined
    for (let n = 0; summon(f.state); n++) {
      expect(n).toBeLessThan(30)
      const actor = f.state.tactical.battle.currentTurn!.combatantId
      if (actor === f.opponent.actorId && readPv1fActionEconomy(f.state, actor)!.current >= 30) {
        const position = f.state.tactical.placements.find((p) => p.combatantId === actor)!.position
        if (position.y === 1) {
          const before = readPv1fActionEconomy(f.state, actor)!.current
          await f.service().submitIntent(
            f.intent(actor, {
              kind: 'move',
              path: [position, { x: 2, y: 2 }],
            }),
          )
          expect(readPv1fActionEconomy(f.state, actor)!.current).toBe(before - 20)
        }
        const command = f.intent(actor, {
          kind: 'action',
          actionId: PV1F_BASIC_ATTACK_ID,
          target: { kind: 'unit', combatantId: child.combatantId },
        })
        const before = readPv1fActionEconomy(f.state, actor)!.current
        const view = await f.service().submitIntent(command)
        expect(readPv1fActionEconomy(f.state, actor)!.current).toBe(before - 30)
        if (!summon(f.state)) {
          lethal = command
          lethalView = view
        }
      } else if (actor === child.combatantId) {
        await createBattleRecruitAiService(f.repository).runTurn({
          userId: f.owner.character.userId,
          battleSessionId: sessionId,
          expectedBattleVersion: f.version,
        })
      } else await f.face()
    }
    expect(lethal).toBeDefined()
    const saved = JSON.stringify(f.state),
      version = f.version
    const repeated = await f.service().submitIntent(lethal!)
    expect(repeated).toMatchObject({
      replayed: true,
      battleVersion: version,
      snapshot: lethalView!.snapshot,
    })
    expect(JSON.stringify(f.state)).toBe(saved)
    expect(f.version).toBe(version)
    expect(
      eventsOf(
        f.commits.flatMap((c) => c.events),
        'summon_defeated',
      ),
    ).toEqual([expect.objectContaining({ combatantId: child.combatantId, sourceSkillVersion: 7 })])
    expect(
      eventsOf(
        f.commits.flatMap((c) => c.events),
        'summon_expired',
      ),
    ).toEqual([])
    expect(f.state.tactical.battle.combatants.some((u) => u.id === child.combatantId)).toBe(false)
    expect(f.state.tactical.placements.some((p) => p.combatantId === child.combatantId)).toBe(false)
    expect(f.state.statBridge.combatants.some((p) => p.combatantId === child.combatantId)).toBe(
      false,
    )
    expect(
      f.state.turnTriggerState?.combatants.some((p) => p.combatantId === child.combatantId),
    ).toBe(false)
    expect(f.state.tactical.battle.initiativeOrder).not.toContain(child.combatantId)
    expect(f.state.tactical.battle.lifecycle).toBe('active')
    f.trace('persisted-player-defeat')
  },
)

it.each(cases)(
  '$name penalizes an idle owner timeout without consuming the living summon turn',
  async (scenario) => {
    const f = await fixture(scenario)
    await f.spawn()
    await f.face()
    await f.advance(f.owner.actorId)
    const before = f.state,
      child = summon(before)!,
      start = f.commits.length
    // The deferred child has not acted when its owner starts the next round.
    expect(child.turnsCompleted).toBe(0)
    f.expire()
    expect((await f.tick()).timedOut).toBe(true)
    const last = f.commits[start]!,
      eventName = scenario.context === 'pvp' ? 'pvp_turn_timed_out' : 'ai_turn_timed_out'
    expect(eventsOf(last.events, eventName)).toEqual([
      expect.objectContaining({
        combatantId: f.owner.actorId,
        hadActivity: false,
        consecutiveMisses: 1,
      }),
    ])
    expect(
      eventsOf(
        last.events,
        scenario.context === 'pvp' ? 'pvp_lowered_guard_applied' : 'ai_lowered_guard_applied',
      ),
    ).toEqual([expect.objectContaining({ combatantId: f.owner.actorId, timingState: 'pending' })])
    expect(summon(f.state)).toEqual(child)
    expect(f.state.pendingEffects).toContainEqual(
      expect.objectContaining({
        recipientIds: [f.owner.actorId],
        activationRound: before.tactical.battle.round + 1,
        effect: expect.objectContaining({ type: 'apply-status', statusId: 'lowered-guard' }),
      }),
    )
    expect(f.state.tactical.battle.lifecycle).toBe('active')
    expect(unit(f.state, f.owner.actorId).hp).toBe(unit(before, f.owner.actorId).hp)
    expect(f.commits).toHaveLength(start + 1)
    expect(JSON.stringify(last.privacyJournal)).not.toMatch(
      /capturedAbilitySources|sourceInstanceId/,
    )
    f.trace('idle-owner-timeout')
  },
)
