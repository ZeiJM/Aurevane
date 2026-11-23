import { describe, expect, it } from 'vitest'
import {
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
} from './combat-behavior-runtime'
import { commitCombatAbilityCommand, prepareCombatAbilityCommand } from './combat-ability-command'
import { currentBarrierAmount, grantBarrier } from './combat-barrier'
import { applyCurrentPoisonState, hasCurrentPoison } from './combat-dots'
import { finishPv1fTurn, executePv1fMovement } from './pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'
import type { CombatEncounterState } from './actions'
import {
  captured,
  pair,
  fixture,
  input,
  unit,
  ap,
  give,
  damage,
  hasStatus,
} from './roster-outcome.test-utils'

describe('actual proposed roster mechanic outcomes, not balance acceptance', () => {
  it('Dissolving Formula trades the owner Guarded for mana and concealment, while Quick Hands still borrows an enemy buff', () => {
    const id = pair('aetherist', 'shadehand'),
      quick = 'shadehand.quick-hands'
    let state = give(fixture([id, quick]), 'guarded', 'actor')
    unit(state).mp = 8
    state = reattachStatDrivenCombatBridge(
      grantBarrier(state, 'actor', 'actor', 'test.mana-shield', 20).state,
      state.statBridge,
    )
    const result = commitCombatAbilityCommand(input(state, id, { kind: 'self' }))
    expect(unit(result.state).mp).toBe(12)
    expect(ap(result.state)).toBe(65)
    expect(hasStatus(result.state, 'guarded')).toBe(false)
    expect(hasStatus(result.state, 'covert')).toBe(true)
    expect(currentBarrierAmount(result.state, 'actor')).toBe(20)
    expect(
      prepareCombatAbilityCommand(input(result.state, id, { kind: 'self' })).evaluation.legal,
    ).toBe(false)
    const donor = give(fixture([id, quick]), 'guarded')
    const copied = commitCombatAbilityCommand(input(donor, quick))
    expect(hasStatus(copied.state, 'guarded')).toBe(true)
    expect(hasStatus(copied.state, 'guarded', 'enemy')).toBe(true)
    expect(hasStatus(copied.state, 'covert')).toBe(false)
    expect(unit(copied.state).mp).toBe(16)
  })
  it.each(['no-guard', 'full-mp'])(
    'Dissolving Formula rejects %s without sacrificing protection or spending',
    (counter) => {
      const id = pair('aetherist', 'shadehand'),
        state = fixture([id])
      if (counter === 'full-mp') give(state, 'guarded', 'actor')
      else unit(state).mp = 8
      const before = JSON.stringify(state)
      expect(prepareCombatAbilityCommand(input(state, id, { kind: 'self' })).evaluation.legal).toBe(
        false,
      )
      expect(JSON.stringify(state)).toBe(before)
    },
  )
  it.each([false, true])(
    'Pursuit Angle changes a marked quarry position from the reached route, not through Flanking Cut damage; rooted quarry=%s',
    (rooted) => {
      const id = pair('edgedancer', 'wildwarden'),
        state = give(fixture([id]), 'mark')
      state.tactical.placements.find((p) => p.combatantId === 'actor')!.position = { x: 0, y: 1 }
      state.tactical.placements.find((p) => p.combatantId === 'enemy')!.position = { x: 3, y: 1 }
      state.tactical.placements.find((p) => p.combatantId === 'other')!.position = { x: 4, y: 4 }
      if (rooted) give(state, 'root')
      const result = commitCombatAbilityCommand({
        ...input(state, id),
        movementPath: [
          { x: 0, y: 1 },
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      })
      expect(
        result.state.tactical.placements.find((p) => p.combatantId === 'actor')!.position,
      ).toEqual({ x: 1, y: 0 })
      const quarry = result.state.tactical.placements.find(
        (p) => p.combatantId === 'enemy',
      )!.position
      expect(quarry).toEqual(rooted ? { x: 3, y: 1 } : { x: 1, y: 1 })
      expect(damage(result.events)).toEqual([])
      expect(hasStatus(result.state, 'blindside')).toBe(false)
      expect(ap(result.state)).toBe(60)
      expect(unit(result.state).mp).toBe(16)
      expect(hasStatus(result.state, 'mark', 'enemy')).toBe(true)
    },
  )
  it('Pursuit Angle cannot bypass missing Mark or an owner Rooted route and pays no failed command', () => {
    const id = pair('edgedancer', 'wildwarden')
    for (const counter of ['no-mark', 'rooted-owner']) {
      const state = fixture([id])
      if (counter === 'rooted-owner') {
        give(state, 'mark')
        give(state, 'root', 'actor')
      }
      const before = JSON.stringify(state)
      expect(
        prepareCombatAbilityCommand({
          ...input(state, id),
          movementPath: [
            { x: 1, y: 1 },
            { x: 1, y: 0 },
          ],
        }).evaluation.legal,
      ).toBe(false)
      expect(JSON.stringify(state)).toBe(before)
    }
  })
  it.each([false, true])(
    'Disrupting Inscription spends actual Mark on mana/outgoing-damage denial instead of Aimed Shot pressure; miss=%s',
    (miss) => {
      const id = pair('farstrider', 'runeblade'),
        shot = 'farstrider.aimed-shot',
        state = give(fixture([id, shot]), 'mark')
      state.tactical.placements.find((p) => p.combatantId === 'enemy')!.position = { x: 4, y: 1 }
      if (miss) state.statBridge.combatants.find((p) => p.combatantId === 'actor')!.accuracy = 0
      const result = commitCombatAbilityCommand(input(state, id))
      expect(unit(result.state, 'enemy').hp).toBe(1000)
      expect(unit(result.state, 'enemy').mp).toBe(miss ? 20 : 16)
      expect(hasStatus(result.state, 'mark', 'enemy')).toBe(miss)
      expect(hasStatus(result.state, 'suppress', 'enemy')).toBe(!miss)
      expect(ap(result.state)).toBe(60)
      expect(unit(result.state).mp).toBe(15)
      const comparison = commitCombatAbilityCommand(input(state, shot))
      expect(unit(comparison.state, 'enemy').mp).toBe(20)
      expect(hasStatus(comparison.state, 'mark', 'enemy')).toBe(true)
      expect(hasStatus(comparison.state, 'suppress', 'enemy')).toBe(false)
      if (!miss) expect(unit(comparison.state, 'enemy').hp).toBeLessThan(1000)
      const unmarked = fixture([id])
      unmarked.tactical.placements.find((p) => p.combatantId === 'enemy')!.position = { x: 4, y: 1 }
      const before = JSON.stringify(unmarked)
      expect(prepareCombatAbilityCommand(input(unmarked, id)).evaluation.legal).toBe(false)
      expect(JSON.stringify(unmarked)).toBe(before)
    },
  )
  it.each(['hit', 'miss', 'full-barrier'] as const)(
    'Burn the Thicket spends Poison for immediate containment while Cinder Bolt preserves attrition; %s',
    (scenario) => {
      const id = pair('cinderweaver', 'wildwarden'),
        bolt = 'cinderweaver.cinder-bolt'
      let state = give(fixture([id, bolt]), 'mark')
      state = reattachStatDrivenCombatBridge(
        applyCurrentPoisonState(
          state,
          'actor',
          'enemy',
          'wildwarden.venom-shot',
          true,
          undefined,
          4,
          { capturedDamage: 100, profile: { kind: 'attack-percentage', basisPoints: 1500 } },
        ),
        state.statBridge,
      )
      if (scenario === 'miss')
        state.statBridge.combatants.find((p) => p.combatantId === 'actor')!.accuracy = 0
      if (scenario === 'full-barrier')
        state = reattachStatDrivenCombatBridge(
          grantBarrier(state, 'enemy', 'enemy', 'test.barrier', 1000).state,
          state.statBridge,
        )
      expect(hasCurrentPoison(state, 'enemy')).toBe(true)
      const result = commitCombatAbilityCommand(input(state, id))
      expect(hasCurrentPoison(result.state, 'enemy')).toBe(scenario === 'miss')
      expect(hasStatus(result.state, 'root', 'enemy')).toBe(scenario !== 'miss')
      expect(hasStatus(result.state, 'mark', 'enemy')).toBe(true)
      expect(ap(result.state)).toBe(50)
      expect(unit(result.state).mp).toBe(14)
      const comparison = commitCombatAbilityCommand(input(state, bolt))
      expect(hasCurrentPoison(comparison.state, 'enemy')).toBe(true)
      expect(hasStatus(comparison.state, 'root', 'enemy')).toBe(false)
    },
  )
  it('Burn the Thicket needs both prior Poison and Mark, unlike Cinder Bolt', () => {
    const id = pair('cinderweaver', 'wildwarden')
    for (const marked of [false, true]) {
      let state = fixture([id])
      if (marked) give(state, 'mark')
      else
        state = reattachStatDrivenCombatBridge(
          applyCurrentPoisonState(
            state,
            'actor',
            'enemy',
            'wildwarden.venom-shot',
            true,
            undefined,
            4,
            { capturedDamage: 100, profile: { kind: 'attack-percentage', basisPoints: 1500 } },
          ),
          state.statBridge,
        )
      const before = JSON.stringify(state)
      expect(prepareCombatAbilityCommand(input(state, id)).evaluation.legal).toBe(false)
      expect(JSON.stringify(state)).toBe(before)
    }
  })
  it('rejects Exploit Opening without setup, then pays once for a real Vulnerable payoff', () => {
    const id = 'shadehand.exploit-opening'
    let state = fixture([id])
    const before = JSON.stringify(state)
    expect(prepareCombatAbilityCommand(input(state, id)).evaluation.legal).toBe(false)
    expect(JSON.stringify(state)).toBe(before)
    state = give(state, 'exposed')
    const result = commitCombatAbilityCommand(input(state, id))
    expect(result.events.some((e) => e.event === 'damage_applied')).toBe(true)
    expect(ap(result.state)).toBe(50)
    expect(unit(result.state).mp).toBe(20)
  })
  it('Hundredfold Rush scales offense once across its three packets and has no walking surcharge', () => {
    const id = 'essence.ironfist.hundredfold-rush'
    const state = fixture([id])
    state.tactical.placements.find((p) => p.combatantId === 'actor')!.position = { x: 0, y: 1 }
    const result = commitCombatAbilityCommand({
      ...input(state, id),
      movementPath: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
    })
    expect(damage(result.events)).toEqual([23, 5, 5])
    expect(ap(result.state)).toBe(30)
    expect(unit(result.state).mp).toBe(14)
  })
  it.each(['restore', 'source-removed', 'barrier-before-boundary', 'terminal'] as const)(
    'Sevenfold Cut preserves its captured future commitment through %s',
    (scenario) => {
      const id = 'essence.edgedancer.sevenfold-cut'
      const state = fixture([id])
      const result = commitCombatAbilityCommand(input(state, id))
      expect(damage(result.events)).toEqual([18])
      expect(ap(result.state)).toBe(25)
      expect(unit(result.state).mp).toBe(12)
      expect(result.state.pendingEffects).toHaveLength(6)
      const exit = executePv1fMovement(
        reattachStatDrivenCombatBridge(result.state, state.statBridge),
        [
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
      )
      expect(ap(exit.state)).toBe(5)
      let later = reattachStatDrivenCombatBridge(
        JSON.parse(JSON.stringify(exit.state)) as CombatEncounterState,
        state.statBridge,
      )
      if (scenario === 'source-removed') {
        later = reattachStatDrivenCombatBridge(
          reconcileCombatAbilitySources(later, []),
          state.statBridge,
        )
        expect(later.abilityRuntime?.activeSourceIds).toEqual([])
      }
      if (scenario === 'barrier-before-boundary') {
        later = reattachStatDrivenCombatBridge(
          grantBarrier(later, 'enemy', 'enemy', 'test.response', 1000).state,
          state.statBridge,
        )
      }
      if (scenario === 'terminal') {
        later.tactical.battle.lifecycle = 'completed'
        later.tactical.battle.currentTurn = null
        const before = JSON.stringify(later)
        expect(() => finishPv1fTurn(later, 'west')).toThrow('active battle turn')
        expect(JSON.stringify(later)).toBe(before)
        expect(unit(later, 'enemy').hp).toBe(982)
        return
      }
      const laterDamage: number[] = []
      for (let i = 0; i < 4; i++) {
        const turn = finishPv1fTurn(later, 'west')
        laterDamage.push(...damage(turn.events))
        later = turn.state
      }
      expect(laterDamage).toEqual(
        scenario === 'barrier-before-boundary' ? [0, 0, 0, 0, 0, 0] : [2, 2, 2, 2, 2, 2],
      )
      expect(unit(later, 'enemy').hp).toBe(scenario === 'barrier-before-boundary' ? 982 : 970)
      if (scenario === 'barrier-before-boundary')
        expect(currentBarrierAmount(later, 'enemy')).toBe(988)
    },
  )
  it('Last Light rejects a healthy friend and rescues a living low-HP friend without revival', () => {
    const id = 'dawnshield.last-light'
    const state = fixture([id])
    const selection = { kind: 'unit' as const, combatantId: 'ally' }
    expect(prepareCombatAbilityCommand(input(state, id, selection)).evaluation.legal).toBe(false)
    unit(state, 'ally').hp = 200
    const result = commitCombatAbilityCommand(input(state, id, selection))
    expect(unit(result.state, 'ally').hp).toBe(340)
    expect(ap(result.state)).toBe(50)
    expect(unit(result.state).mp).toBe(12)
  })
  it('Cauterized Relief is a real flat20 heal and canonical Cleanse rather than percentage reskin', () => {
    const id = pair('cinderweaver', 'lifebinder')
    const state = give(fixture([id]), 'slow', 'ally')
    unit(state, 'ally').hp = 600
    const result = commitCombatAbilityCommand(
      input(state, id, { kind: 'unit', combatantId: 'ally' }),
    )
    expect(unit(result.state, 'ally').hp).toBe(620)
    expect(
      result.state.statusState
        .find((r) => r.combatantId === 'ally')
        ?.statuses.some((s) => s.statusId === 'slow'),
    ).toBe(false)
    expect(ap(result.state)).toBe(65)
  })
  it('Shatter checks prior Chilled and adds only its fixed conditional packet', () => {
    const id = 'frostweaver.shatter'
    const plain = commitCombatAbilityCommand(input(fixture([id]), id))
    const prepared = commitCombatAbilityCommand(input(give(fixture([id]), 'frozen'), id))
    expect(damage(plain.events)).toEqual([25])
    expect(damage(prepared.events)).toEqual([25, 4])
  })
  it('Unbinding Rune copies first and changes the donor only through its explicit Dispel', () => {
    const id = 'runeblade.unbinding-rune'
    const result = commitCombatAbilityCommand(input(give(fixture([id]), 'guarded'), id))
    expect(
      result.state.statusState
        .find((r) => r.combatantId === 'actor')
        ?.statuses.some((s) => s.statusId === 'guarded'),
    ).toBe(true)
    expect(
      result.state.statusState
        .find((r) => r.combatantId === 'enemy')
        ?.statuses.some((s) => s.statusId === 'guarded'),
    ).toBe(false)
    expect(ap(result.state)).toBe(60)
  })
  it('Ironfist owner-action reaction pays its finite resource budget after the owner attack', () => {
    const root = 'ironfist.rising-fist',
      reaction = 'ironfist.counter-palm'
    const result = commitCombatAbilityCommand(input(fixture([root, reaction]), root))
    expect(unit(result.state).mp).toBe(17)
    expect(result.events.filter((e) => e.event === 'barrier_changed')).toHaveLength(1)
  })
  it('the reserve modifier uses prepayment mana and the actual explicit command flow', () => {
    const root = 'farstrider.aimed-shot',
      modifier = pair('aetherist', 'farstrider'),
      state = fixture([root, modifier])
    state.tactical.placements.find((p) => p.combatantId === 'enemy')!.position = { x: 3, y: 1 }
    state.tactical.placements.find((p) => p.combatantId === 'other')!.position = { x: 4, y: 4 }
    unit(state).mp = 11
    const m = captured(modifier).definition.behaviors[0]!
    const command = {
      ...input(state, root),
      manualModifiers: [{ sourceInstanceId: modifier, behaviorId: m.id }],
    }
    expect(() => prepareCombatAbilityCommand(command)).toThrow('modifier-requirement-not-met')
    unit(state).mp = 12
    const result = commitCombatAbilityCommand(command)
    expect(ap(result.state)).toBe(45)
    expect(unit(result.state).mp).toBe(9)
  })
  it('Crystal Impact requires own-kit Chilled at distance and creates a real rooted contact transition', () => {
    const id = pair('frostweaver', 'ironfist'),
      state = fixture([id])
    state.tactical.placements.find((p) => p.combatantId === 'enemy')!.position = { x: 3, y: 1 }
    state.tactical.placements.find((p) => p.combatantId === 'other')!.position = { x: 4, y: 4 }
    expect(prepareCombatAbilityCommand(input(state, id)).evaluation.legal).toBe(false)
    give(state, 'frozen')
    const result = commitCombatAbilityCommand(input(state, id))
    expect(
      result.state.tactical.placements.find((p) => p.combatantId === 'enemy')!.position,
    ).toEqual({ x: 2, y: 1 })
    expect(
      result.state.statusState
        .find((s) => s.combatantId === 'enemy')
        ?.statuses.some((s) => s.statusId === 'root'),
    ).toBe(true)
    expect(ap(result.state)).toBe(55)
    expect(unit(result.state).mp).toBe(15)
  })
  it('HP payment leaves1HP, emits no damage reaction, and is rejected atomically when unavailable', () => {
    const id = 'ravager.cleaving-blow'
    const state = fixture([id])
    unit(state).hp = 10
    expect(
      prepareCombatAbilityCommand(input(state, id, { kind: 'activate' })).evaluation.legal,
    ).toBe(false)
    unit(state).hp = 11
    const result = commitCombatAbilityCommand(input(state, id, { kind: 'activate' }))
    expect(unit(result.state).hp).toBe(1)
    expect(
      result.events.filter((e) => e.event === 'damage_applied' && e.targetCombatantId === 'actor'),
    ).toHaveLength(0)
  })
  it.each(['hit', 'miss', 'full-barrier'] as const)(
    'Mercys Edge has actual confirmed-hit recovery for %s',
    (scenario) => {
      const id = pair('lifebinder', 'vanguard')
      let state = fixture([id])
      unit(state).hp = 600
      if (scenario === 'miss')
        state.statBridge!.combatants.find((p) => p.combatantId === 'actor')!.accuracy = 0
      if (scenario === 'full-barrier')
        state = reattachStatDrivenCombatBridge(
          grantBarrier(state, 'enemy', 'enemy', 'test.barrier', 1000).state,
          state.statBridge,
        )
      const result = commitCombatAbilityCommand(input(state, id))
      expect(unit(result.state).hp).toBe(scenario === 'miss' ? 600 : 650)
      expect(unit(result.state, 'enemy').hp).toBe(scenario === 'hit' ? 977 : 1000)
      expect(ap(result.state)).toBe(50)
      expect(unit(result.state).mp).toBe(15)
    },
  )
  it.each([false, true])('Circuit after Contact is a useful finite1MP rebate; miss=%s', (miss) => {
    const root = 'runeblade.arc-edge',
      second = 'runeblade.aether-cut',
      reaction = pair('runeblade', 'stormsinger')
    const initial = fixture([root, second, reaction])
    if (miss) initial.statBridge!.combatants.find((p) => p.combatantId === 'actor')!.accuracy = 0
    const first = commitCombatAbilityCommand(
      input(initial, root, { kind: 'direction', direction: 'east' }),
    )
    expect(unit(first.state).mp).toBe(17) //20 - paid root4 - reaction2 + recovery3.
    expect(() =>
      commitCombatAbilityCommand(
        input(first.state, root, { kind: 'direction', direction: 'east' }),
      ),
    ).toThrow()
    const restored: CombatEncounterState = JSON.parse(JSON.stringify(first.state))
    const next = commitCombatAbilityCommand(input(restored, second))
    expect(unit(next.state).mp).toBe(11) //Second real paid root6; owner-turn reaction already spent.
    let idle = reattachStatDrivenCombatBridge(next.state, initial.statBridge!)
    for (let i = 0; i < 4; i++) idle = finishPv1fTurn(idle, 'west').state
    expect(unit(idle).mp).toBe(11) //No input grants no rebate even after a real round/reset.
  })
  it('a registered Automatic reaction does nothing during a complete no-input round', () => {
    const id = pair('ironfist', 'lifebinder')
    const initial = fixture([id])
    unit(initial).hp = 600
    let idle = reattachStatDrivenCombatBridge(initial, initial.statBridge!)
    for (let i = 0; i < 4; i++) idle = finishPv1fTurn(idle, 'west').state
    expect(unit(idle).hp).toBe(600)
    expect(unit(idle).mp).toBe(20)
    expect(currentBarrierAmount(idle, 'actor')).toBe(0)
  })
  it.each([false, true])(
    'Renewed Force skips fullHP without spending its usage, then recovers on a wounded paid attack; miss=%s',
    (miss) => {
      const first = 'ironfist.rising-fist',
        second = 'ironfist.pressure-palm',
        reaction = pair('ironfist', 'lifebinder'),
        state = fixture([first, second, reaction])
      if (miss) state.statBridge.combatants.find((p) => p.combatantId === 'actor')!.accuracy = 0
      const opening = commitCombatAbilityCommand(input(state, first))
      expect(unit(opening.state).mp).toBe(20)
      expect(unit(opening.state).hp).toBe(1000)
      unit(opening.state).hp = 600
      const eligible = commitCombatAbilityCommand(input(opening.state, second))
      expect(unit(eligible.state).mp).toBe(16)
      expect(unit(eligible.state).hp).toBe(640)
    },
  )
  it.each(['slow', 'suppress'])(
    'Consecrated Form skips an empty cleanse, then cleanses actual %s after a missed paid attack',
    (affliction) => {
      const first = 'ironfist.rising-fist',
        second = 'ironfist.pressure-palm',
        reaction = pair('dawnshield', 'ironfist'),
        state = fixture([first, second, reaction])
      unit(state).hp = 600
      const opening = commitCombatAbilityCommand(input(state, first))
      expect(unit(opening.state).mp).toBe(20)
      give(opening.state, affliction, 'actor')
      opening.state.statBridge!.combatants.find((p) => p.combatantId === 'actor')!.accuracy = 0
      const eligible = commitCombatAbilityCommand(input(opening.state, second))
      expect(unit(eligible.state).mp).toBe(16)
      expect(
        eligible.state.statusState
          .find((s) => s.combatantId === 'actor')
          ?.statuses.some((s) => s.statusId === affliction),
      ).toBe(false)
    },
  )
  it.each([false, true])(
    'Siphon Slash drains hostile mana separately and gives confirmed-hit HP recovery; miss=%s',
    (miss) => {
      const id = 'runeblade.siphon-slash',
        state = fixture([id])
      unit(state).hp = 600
      if (miss) state.statBridge.combatants.find((p) => p.combatantId === 'actor')!.accuracy = 0
      const result = commitCombatAbilityCommand(input(state, id))
      expect(unit(result.state).hp).toBe(miss ? 600 : 650)
      expect(unit(result.state).mp).toBe(14)
      expect(unit(result.state, 'enemy').mp).toBe(miss ? 20 : 15)
    },
  )
  it('Aether in Poise makes Gather and moving Release compete on one real cooldown', () => {
    const id = pair('aetherist', 'edgedancer'),
      state = fixture([id])
    unit(state).mp = 8
    state.tactical.placements.find((p) => p.combatantId === 'actor')!.position = { x: 0, y: 1 }
    const gathered = commitCombatAbilityCommand(input(state, id, { kind: 'self' }, 'gather'))
    expect(unit(gathered.state).hp).toBe(990)
    expect(unit(gathered.state).mp).toBe(8)
    expect(ap(gathered.state)).toBe(70)
    const quote: CombatEncounterState = JSON.parse(JSON.stringify(gathered.state))
    unit(quote).mp = 12
    const prepared = prepareCombatAbilityCommand({
      ...input(quote, id, { kind: 'unit', combatantId: 'enemy' }, 'release'),
      movementPath: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
    })
    expect(prepared.evaluation.legal).toBe(false)
    expect(JSON.stringify(prepared.evaluation.issues)).toContain('cooldown')
    let later = reattachStatDrivenCombatBridge(gathered.state, state.statBridge)
    for (let i = 0; i < 4; i++) later = finishPv1fTurn(later, 'west').state
    expect(unit(later).mp).toBe(13)
  })
  it('Steamfront Quench closes Flare, making defensive relief a real lost offensive opportunity', () => {
    const id = pair('cinderweaver', 'tidecaller'),
      state = give(fixture([id]), 'slow', 'actor')
    const quenched = commitCombatAbilityCommand(input(state, id, { kind: 'self' }, 'quench'))
    expect(unit(quenched.state).mp).toBe(16)
    expect(
      quenched.state.statusState
        .find((s) => s.combatantId === 'actor')
        ?.statuses.some((s) => s.statusId === 'slow'),
    ).toBe(false)
    expect(
      prepareCombatAbilityCommand(
        input(quenched.state, id, { kind: 'unit', combatantId: 'enemy' }, 'flare'),
      ).evaluation.legal,
    ).toBe(false)
  })
  it('Held Formula maintains only the real held anchor option and disappears on source removal', () => {
    const root = 'aetherist.arc-bolt',
      rewind = 'chronist.rewind-step',
      resonance = pair('aetherist', 'chronist'),
      state = fixture([root, rewind, resonance])
    const plain = commitCombatAbilityCommand(input(state, root))
    const primed = primeCombatControlledAbility({
      state,
      actorId: 'actor',
      sourceInstanceId: rewind,
      behaviorId: captured(rewind).definition.behaviors[0]!.id,
    }).state
    expect(ap(primed)).toBe(100)
    expect(unit(primed).mp).toBe(20)
    const held = commitCombatAbilityCommand(input(primed, root))
    expect(damage(held.events)[0] as number).toBeGreaterThan(damage(plain.events)[0] as number)
    const removed = reconcileCombatAbilitySources(primed, [captured(root), captured(rewind)])
    const without = commitCombatAbilityCommand(input(removed, root))
    expect(damage(without.events)).toEqual(damage(plain.events))
  })
})
