import { describe, expect, it, vi } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import {
  createTacticalBattleState,
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
  selectCurrentFinalFacing,
} from '@aurevane/game-core/combat/board'
import {
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
  type CombatActionDefinition,
} from '@aurevane/game-core/combat/actions'

vi.mock('server-only', () => ({}))

import { buildBattleLogView, createViewerSafeBattleLogService } from './battle-log-service'
import type { BattleHistoryPrivacyAuthority } from './battle-history-privacy-authority'
import { createSpectatorBattleViewerEntitlement } from './battle-viewer-entitlement'
import { buildBattleChronicle } from '../../components/battle/battle-log-chronicle-model'
import { formatBattleLogForClipboard } from '../../components/battle/battle-log-clipboard'
import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as popovers from '../../components/battle/battle-info-popover'
import { BattleLogChronicle } from '../../components/battle/battle-log-chronicle'

function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'chronicle.effects',
      rulesVersion: 3,
      contentVersion: 2,
      rngSeed: 123,
      combatants: ['character:zei', 'recruit:weon'].map((id, index) => ({
        id,
        teamId: index === 0 ? 'a' : 'b',
        initiative: 2 - index,
        baseMovementBudget: 2,
        hp: 100,
        maxHp: 100,
        mp: 20,
        maxMp: 30,
      })),
    }),
  ).state
  return {
    ...createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 2,
        height: 1,
        terrains: P2_2_VERTICAL_SLICE_TERRAINS,
        movementProfiles: [P2_2_ORDINARY_GROUND_PROFILE],
        tiles: [0, 1].map((x) => ({
          position: { x, y: 0 },
          elevation: 0,
          terrainId: 'open-ground',
        })),
        placements: battle.combatants.map((combatant, x) => ({
          combatantId: combatant.id,
          position: { x, y: 0 },
          facing: 'east' as const,
          movementProfileId: 'ordinary-ground',
        })),
      }),
    ),
    effectTimingPolicy: { version: 1, modes: {} },
  }
}

const baseAction: CombatActionDefinition = {
  id: 'test.severing-cut',
  version: 1,
  sourceType: 'test',
  tags: [],
  requirements: [],
  cost: { spendsAction: false, mp: 0 },
  target: {
    kind: 'unit',
    teamPolicy: 'enemy',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 6,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
    friendlyFire: 'enemies-only',
  },
  effects: [],
}

describe('canonical delayed effects through the shared Chronicle projection', () => {
  it.each([
    [
      'fortified',
      { defenseIncreaseBasisPoints: 4000 },
      "Fortified will boost Recruit's Physical and Mystic Defense by 40% and cut damage dealt by 40%",
      'Increase Physical and Mystic Defense by 40%',
    ],
    [
      'reckless',
      { potencyBasisPoints: 4000 },
      "Reckless will boost Recruit's damage dealt and taken by 40%",
      'Deal 40% more damage and take 40% more damage',
    ],
  ] as const)(
    'keeps %s neutral while preserving its committed pending strength in the Chronicle and explanation',
    (statusId, effectStrength, narration, explanation) => {
      const transition = executeCombatAction(
        encounter(),
        {
          ...baseAction,
          effects: [
            {
              type: 'apply-status',
              recipient: 'primary-unit',
              statusId,
              stacks: 1,
              durationTurns: 2,
              ...effectStrength,
            },
          ],
        },
        { kind: 'unit', combatantId: 'recruit:weon' },
        { statuses: PHASE4_STATUSES },
      )
      expect(transition.events.find((event) => event.event === 'effect_pending')).toMatchObject({
        effectStrength,
      })
      const view = buildBattleLogView(
        'chronicle.effects',
        transition.events.map((event, eventIndex) => ({
          battleVersion: 1,
          eventIndex,
          createdAt: '2026-11-01T00:00:00Z',
          event,
        })),
      )
      const pending = view.entries.find((entry) => entry.eventType === 'effect_pending')!
      expect(pending).toMatchObject({ statusId, effectStrength })
      const outcome = buildBattleChronicle(view.entries)[0].actors[0].actions[0].outcomes[0]
      expect(outcome).toMatchObject({ tone: 'neutral', text: `${narration} (rounds 2–3)` })
      expect(formatBattleLogForClipboard(view.entries)).toContain(outcome.text)
      const popup = vi
        .spyOn(popovers, 'BattleInfoPopover')
        .mockImplementation(({ children, trigger }) =>
          createElement('aside', null, trigger, children),
        )
      try {
        const html = renderToStaticMarkup(
          createElement(BattleLogChronicle, { entries: view.entries }),
        )
        expect(html).toContain(explanation)
        expect(html).toContain(narration.replaceAll("'", '&#x27;'))
      } finally {
        popup.mockRestore()
      }
    },
  )
  it.each([
    ['blind', { potencyBasisPoints: 3050 }, "Blind cuts Weon's Accuracy by 30.5 percentage points"],
    ['haste', { movementApAdjustment: 7 }, "Haste cuts Weon's movement cost by 7 AP per tile"],
    [
      'wet',
      { potencyBasisPoints: 3525, initiativeReductionBasisPoints: 1200 },
      "Drenched cuts Weon's Initiative by 12% and boosts Storm damage taken by 35.25%",
    ],
    [
      'counter',
      { counter: { kind: 'mystic', basisPoints: 12500 } },
      'Magical Reflect returns 125% of Mystic HP damage taken by Weon',
    ],
  ] as const)(
    'carries committed %s strength into the shared Chronicle and copied log',
    (statusId, strength, expected) => {
      const transition = executeCombatAction(
        { ...encounter(), effectTimingPolicy: { version: 1, modes: { [statusId]: 'instant' } } },
        {
          ...baseAction,
          effects: [
            {
              type: 'apply-status',
              recipient: 'primary-unit',
              statusId,
              stacks: 1,
              durationTurns: 2,
              ...strength,
            },
          ],
        },
        { kind: 'unit', combatantId: 'recruit:weon' },
        { statuses: PHASE4_STATUSES },
      )
      const receipt = transition.events.find((event) => event.event === 'status_applied')
      expect(receipt).toMatchObject({ effectStrength: strength })
      const view = buildBattleLogView(
        'chronicle.effects',
        transition.events.map((event, eventIndex) => ({
          battleVersion: 1,
          eventIndex,
          createdAt: '2026-11-01T00:00:00Z',
          event,
        })),
      )
      const names = { combatantNames: { 'character:zei': 'Zei', 'recruit:weon': 'Weon' } }
      const texts = buildBattleChronicle(view.entries, names).flatMap((round) =>
        round.actors.flatMap((actor) =>
          actor.actions.flatMap((action) => action.outcomes.map((outcome) => outcome.text)),
        ),
      )
      expect(texts).toContain(`${expected} for 2 turns`)
      expect(formatBattleLogForClipboard(view.entries, names)).toContain(`${expected} for 2 turns`)
      const popup = vi
        .spyOn(popovers, 'BattleInfoPopover')
        .mockImplementation(({ children, trigger }) =>
          createElement('aside', null, trigger, children),
        )
      try {
        const html = renderToStaticMarkup(
          createElement(BattleLogChronicle, { entries: view.entries, ...names }),
        )
        expect(html).toContain(expected.replaceAll("'", '&#x27;'))
        if (statusId === 'blind') {
          expect(html).toContain('Lose 30.5 percentage points Accuracy')
          expect(html).not.toContain('Lose 15 percentage points')
        }
        if (statusId === 'haste') {
          expect(html).toContain('7 less AP')
          expect(html).not.toContain('10 less AP')
        }
        if (statusId === 'wet') {
          expect(html).toContain('Initiative by 12%')
          expect(html).toContain('35.25% Storm damage')
          expect(html).not.toContain('20% per active')
        }
        if (statusId === 'counter') expect(html).toContain('Returns 125% of Mystic HP damage')
      } finally {
        popup.mockRestore()
      }
    },
  )

  it('keeps pending strength and owner-turn lifetimes distinct from calendar rounds', () => {
    const transition = executeCombatAction(
      encounter(),
      {
        ...baseAction,
        effects: [
          {
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: 'blind',
            stacks: 1,
            potencyBasisPoints: 3050,
            durationTurns: 2,
          },
        ],
      },
      { kind: 'unit', combatantId: 'recruit:weon' },
      { statuses: PHASE4_STATUSES },
    )
    expect(transition.events.find((event) => event.event === 'effect_pending')).toMatchObject({
      effectStrength: { potencyBasisPoints: 3050 },
    })
    const view = buildBattleLogView(
      'chronicle.effects',
      transition.events.map((event, eventIndex) => ({
        battleVersion: 1,
        eventIndex,
        createdAt: '2026-11-01T00:00:00Z',
        event,
      })),
    )
    const copied = formatBattleLogForClipboard(view.entries, {
      combatantNames: { 'recruit:weon': 'Weon' },
    })
    expect(copied).toContain(
      "Blind will cut Weon's Accuracy by 30.5 percentage points (rounds 2–3)",
    )
    expect(buildBattleChronicle(view.entries)[0].actors[0].actions[0].outcomes[0].duration).toBe(
      '2 rounds',
    )
  })
  it.each([
    { type: 'healing', recipient: 'primary-unit', amount: 9, ticks: 2 },
    {
      type: 'percentage-recovery',
      recipient: 'primary-unit',
      resource: 'hp',
      percent: 9,
      ticks: 2,
    },
  ] as const)('records actual saved pending recovery amounts for $type', (effect) => {
    const transition = executeCombatAction(
      { ...encounter(), effectTimingPolicy: { version: 1, modes: { healing: 'next-round' } } },
      { ...baseAction, effects: [effect] },
      { kind: 'unit', combatantId: 'recruit:weon' },
      { statuses: PHASE4_STATUSES },
    )
    expect(transition.events.find((event) => event.event === 'effect_pending')).toMatchObject({
      effectStrength: { recoveryAmountPerApplication: 9 },
    })
    const view = buildBattleLogView(
      'chronicle.effects',
      transition.events.map((event, eventIndex) => ({
        battleVersion: 1,
        eventIndex,
        createdAt: '2026-11-01T00:00:00Z',
        event,
      })),
    )
    expect(formatBattleLogForClipboard(view.entries)).toContain(
      'Recruit will recover up to 9 HP per application (2 applications; from round 2)',
    )
  })
  it('records Endure release strength without exposing its private accumulated damage', () => {
    const transition = executeCombatAction(
      encounter(),
      {
        ...baseAction,
        effects: [
          {
            type: 'endure',
            recipient: 'actor',
            releaseBasisPoints: 12500,
            radiusTiles: 2,
            targetTeams: 'enemies',
            durationTurns: 2,
          },
        ],
      },
      { kind: 'unit', combatantId: 'recruit:weon' },
      { statuses: PHASE4_STATUSES },
    )
    expect(transition.events.find((event) => event.event === 'status_applied')).toMatchObject({
      effectStrength: { endureReleaseBasisPoints: 12500 },
    })
    const view = buildBattleLogView(
      'chronicle.effects',
      transition.events.map((event, eventIndex) => ({
        battleVersion: 1,
        eventIndex,
        createdAt: '2026-11-01T00:00:00Z',
        event,
      })),
    )
    const text = formatBattleLogForClipboard(view.entries)
    expect(text).toContain(
      "Endure locks Wayfarer's attacks and stores received damage for a 125% burst after 2 turns",
    )
    expect(JSON.stringify(view)).not.toMatch(/applicationId|receivedDamage|nextApplicationId/)
  })
  it.each(['empty', 'no-targets'] as const)(
    'explains a recorded %s Endure expiry in Chronicle and clipboard',
    (endureOutcome) => {
      const view = buildBattleLogView('chronicle.effects', [
        {
          battleVersion: 2,
          eventIndex: 0,
          createdAt: '2026-11-01T00:00:00Z',
          event: {
            event: 'status_expired',
            combatantId: 'character:zei',
            statusId: 'endure',
            endureOutcome,
          },
        },
      ])
      const text = formatBattleLogForClipboard(view.entries)
      expect(text).toContain(
        endureOutcome === 'empty' ? 'no stored power to release' : 'no targets are in range',
      )
      expect(text).not.toContain(
        endureOutcome === 'empty' ? 'no targets are in range' : 'no stored power',
      )
      expect(JSON.stringify(view)).not.toMatch(/receivedDamage|applicationId/)
    },
  )
  it('does not invent an empty release for historical Endure expiry without an outcome', () => {
    const view = buildBattleLogView('chronicle.effects', [
      {
        battleVersion: 2,
        eventIndex: 0,
        createdAt: '2026-11-01T00:00:00Z',
        event: { event: 'status_expired', combatantId: 'character:zei', statusId: 'endure' },
      },
    ])
    expect(formatBattleLogForClipboard(view.entries)).not.toContain('no stored power')
  })
  it('copies uniform saved application strength and omits a misleading single rate for mixed copied applications', () => {
    const initial = {
      ...encounter(),
      effectStackingPolicyVersion: 1 as const,
      effectTimingPolicy: {
        version: 1,
        modes: { inspired: 'instant' as const, 'copy-statuses': 'instant' as const },
      },
    }
    const apply = (state: typeof initial, potencyBasisPoints: number) =>
      executeCombatAction(
        state,
        {
          ...baseAction,
          effects: [
            {
              type: 'apply-status',
              recipient: 'primary-unit',
              statusId: 'inspired',
              potencyBasisPoints,
              stacks: 1,
              durationTurns: 2,
            },
          ],
        },
        { kind: 'unit', combatantId: 'recruit:weon' },
        { statuses: PHASE4_STATUSES },
      )
    const first = apply(initial, 2534)
    const copy = (state: typeof first.state) =>
      executeCombatAction(
        state,
        {
          ...baseAction,
          id: 'test.copy',
          effects: [
            {
              type: 'copy-statuses',
              recipient: 'primary-unit',
              mode: 'amplify',
              statusIds: ['inspired'],
            },
          ],
        },
        { kind: 'unit', combatantId: 'recruit:weon' },
        { statuses: PHASE4_STATUSES },
      )
    const uniform = copy(first.state)
    expect(uniform.events.find((event) => event.event === 'status_applied')).toMatchObject({
      effectStrength: { potencyBasisPoints: 2534 },
    })
    const view = buildBattleLogView(
      'chronicle.effects',
      uniform.events.map((event, eventIndex) => ({
        battleVersion: 1,
        eventIndex,
        createdAt: '2026-11-01T00:00:00Z',
        event,
      })),
    )
    expect(formatBattleLogForClipboard(view.entries)).toContain(
      "Damage Up boosts Wayfarer's damage by 25.34%",
    )
    const mixed = copy(apply(first.state as typeof initial, 5000).state)
    expect(mixed.events.find((event) => event.event === 'status_applied')).not.toHaveProperty(
      'effectStrength',
    )
    expect(
      mixed.state.statusState
        .find((row) => row.combatantId === 'character:zei')
        ?.statuses[0].applicationModifiers?.map((row) => row.potencyBasisPoints),
    ).toEqual([2534, 5000])
  })
  it.each(['poison' as const, 'burn' as const])(
    'renders the pinned title from actual %s ticks',
    async (statusId) => {
      const skillId = 'vanguard.forceful-strike'
      const contentVersion = 12
      const actionId = skillId
      const pinned = {
        ...resolveMatureSkillVersion(skillId, 2)!,
        contentVersion,
      }
      let transition = executeCombatAction(
        encounter(),
        {
          ...baseAction,
          id: actionId,
          effects: [{ type: statusId, recipient: 'primary-unit', power: 4, durationTurns: 2 }],
        },
        { kind: 'unit', combatantId: 'recruit:weon' },
        { statuses: [] },
      )
      let state = transition.state
      const records = transition.events.map((event, eventIndex) => ({
        battleVersion: 1,
        eventIndex,
        createdAt: '2026-10-04T00:00:00Z',
        event,
      }))
      for (let battleVersion = 2; battleVersion <= 5; battleVersion += 1) {
        transition = endCombatTurn(
          { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
          { statuses: [] },
        )
        state = transition.state
        records.push(
          ...transition.events.map((event, eventIndex) => ({
            battleVersion,
            eventIndex,
            createdAt: '2026-10-04T00:00:00Z',
            event,
          })),
        )
      }
      const history = records
      const authority: BattleHistoryPrivacyAuthority = {
        viewer: createSpectatorBattleViewerEntitlement(),
        journals: [...new Set(history.map((record) => record.battleVersion))].map(
          (battleVersion) => ({
            schemaVersion: 1,
            battleVersion,
            actorCombatantId: 'character:zei',
            actorTeamId: 'a',
            eventCount: history.filter((record) => record.battleVersion === battleVersion).length,
            commandVisibility: { kind: 'public' },
            eventVisibilityOverrides: [],
          }),
        ),
        buildAuthority: {
          schemaVersion: 1,
          catalogVersion: 3,
          combatContext: 'pve',
          combatants: [
            {
              combatantId: 'character:zei',
              characterId: 'zei',
              snapshotSchemaVersion: 1,
              buildSchemaVersion: 1,
              buildVersion: 1,
              fingerprint: 'private',
              primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
              secondary: null,
              disciplineSkills: [
                { slotIndex: 1, skillId, contentVersion, sourceDisciplineId: 'vanguard' },
              ],
              extensions: { essence: null, resonance: null },
            },
          ],
        },
      }
      const view = await createViewerSafeBattleLogService(
        { findBattleEvents: async () => history },
        { findBattleHistoryPrivacy: async () => authority },
        {
          resolvePinnedSkillDefinition: async (id, version) =>
            id === skillId && version === contentVersion ? pinned : null,
        },
      ).getLog('viewer', 'chronicle.effects')
      const tick = view.entries.find((entry) => entry.periodicStatusId === statusId)!
      expect(tick.actionContext).toMatchObject({ name: 'Forceful Strike', skillId, contentVersion })
      const chronicle = buildBattleChronicle(view.entries, {
        combatantNames: { 'character:zei': 'Zei', 'recruit:weon': 'Weon' },
      })
      const tickAction = chronicle
        .flatMap((round) => round.actors.flatMap((actor) => actor.actions))
        .find((action) =>
          action.outcomes.some((outcome) => outcome.text.includes('deals 4 damage')),
        )!
      expect(tickAction.title).toBe('Forceful Strike')
      expect(tickAction.flavorTemplate).toBeNull()
    },
  )
  it.each(['bleed', 'poison', 'burn'] as const)(
    'keeps %s activation separate from recorded periodic damage',
    (statusId) => {
      const effect =
        statusId === 'bleed'
          ? {
              type: 'bleed' as const,
              recipient: 'primary-unit' as const,
              damagePerTick: 4,
              ticks: 2,
            }
          : statusId === 'burn'
            ? {
                type: 'burn' as const,
                recipient: 'primary-unit' as const,
                power: 4,
                durationTurns: 2,
              }
            : {
                type: 'poison' as const,
                recipient: 'primary-unit' as const,
                power: 4,
                durationTurns: 2,
              }
      let transition = executeCombatAction(
        encounter(),
        { ...baseAction, effects: [effect] },
        { kind: 'unit', combatantId: 'recruit:weon' },
        { statuses: [] },
      )
      let state = transition.state
      const records = transition.events.map((event, eventIndex) => ({
        battleVersion: 1,
        eventIndex,
        createdAt: '2026-10-04T00:00:00Z',
        event,
      }))
      let version = 1
      const end = () => {
        transition = endCombatTurn(
          { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
          { statuses: [] },
        )
        state = transition.state
        version += 1
        records.push(
          ...transition.events.map((event, eventIndex) => ({
            battleVersion: version,
            eventIndex,
            createdAt: '2026-10-04T00:00:00Z',
            event,
          })),
        )
      }
      end()
      end()
      const activationView = buildBattleLogView('chronicle.effects', records)
      const pending = activationView.entries.find((entry) => entry.eventType === 'effect_pending')!
      expect(pending.effectTiming).toEqual({ remainingOwnerTurnEnds: 2 })
      expect(
        activationView.entries.filter((entry) => entry.eventType === 'damage_applied'),
      ).toHaveLength(0)
      end()
      end()
      const tickView = buildBattleLogView('chronicle.effects', records)
      const tick = tickView.entries.find((entry) => entry.periodicStatusId === statusId)!
      expect(tick).toMatchObject({
        actionId: baseAction.id,
        actorCombatantId: 'character:zei',
        targetCombatantId: 'recruit:weon',
        templateValues: { amount: '4' },
      })
      const chronicle = buildBattleChronicle(tickView.entries, {
        combatantNames: { 'character:zei': 'Zei', 'recruit:weon': 'Weon' },
      })
      const texts = chronicle.flatMap((round) =>
        round.actors.flatMap((actor) =>
          actor.actions.flatMap((action) => action.outcomes.map((outcome) => outcome.text)),
        ),
      )
      expect(texts).toContain(
        `${statusId === 'poison' ? 'Weon will be poisoned' : `Weon will start ${statusId === 'burn' ? 'burning' : 'bleeding'}`} (from round 2; 2 turns)`,
      )
      expect(
        texts.some((text) =>
          text.includes(`${statusId[0].toUpperCase() + statusId.slice(1)} deals 4 damage`),
        ),
      ).toBe(true)
    },
  )
})
