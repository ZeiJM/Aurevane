import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { capturedResonanceAbilitySource } from '@aurevane/game-core/combat/combat-action-source'
import {
  captureCombatAbilitySource,
  type CapturedCombatAbilitySource,
} from '@aurevane/game-core/combat/combat-behavior-capture'
import { commitCombatAbilityCommand } from '@aurevane/game-core/combat/combat-ability-command'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { source } from '../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { customAutomaticResonance } from '../../components/battle/battle-custom-resonance.test-utils'
import { buildBattleChronicle } from '../../components/battle/battle-log-chronicle-model'
import { BattleLogChronicle } from '../../components/battle/battle-log-chronicle'
import { formatBattleLogForClipboard } from '../../components/battle/battle-log-clipboard'
import { chronicleActionArtwork } from '../../components/battle/battle-chronicle-artwork'
import { createViewerSafeBattleLogService } from './battle-log-service'
import type { BattleBuildAuthoritySnapshot } from './battle-build-authority'
import { buildBattlePrivacyJournalInput } from './battle-history-privacy'
import {
  createSpectatorBattleViewerEntitlement,
  deriveParticipantBattleViewerEntitlement,
} from './battle-viewer-entitlement'

vi.mock('server-only', () => ({}))

function automaticActivation(pinned = customAutomaticResonance()) {
  const base = preparePv1fTurnEconomy(percentageDotEncounter())
  const incoming = captureCombatAbilitySource({
    ...source({ costs: [], accuracy: { kind: 'fixed', chanceBasisPoints: 10000 } }),
    abilityId: 'test.incoming',
  })
  const captured = capturedResonanceAbilitySource(base, 'enemy', pinned, pinned.disciplinePair)!
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(
      {
        ...base,
        tactical: {
          ...base.tactical,
          battle: {
            ...base.tactical.battle,
            combatants: base.tactical.battle.combatants.map((unit) =>
              unit.id === 'enemy' ? { ...unit, hp: 200 } : unit,
            ),
          },
        },
      },
      [incoming, captured],
    ),
    base.statBridge,
  )
  const result = commitCombatAbilityCommand({
    state,
    actorId: 'actor',
    root: { kind: 'canonical', source: incoming },
    selection: { kind: 'unit', combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, incoming),
  })
  expect(
    result.events.some(
      (event) => event.event === 'combat_action_used' && event.actionId === pinned.id,
    ),
  ).toBe(true)
  return {
    captured,
    journal: buildBattlePrivacyJournalInput({
      before: state,
      after: reattachStatDrivenCombatBridge(result.state, base.statBridge),
      commandKind: 'action',
      events: result.events,
    }),
    records: result.events.map((event, eventIndex) => ({
      battleVersion: 2,
      eventIndex,
      createdAt: '2026-11-02T02:13:37.000Z',
      event: { ...event },
    })),
    combatants: result.state.tactical.battle.combatants,
  }
}

async function visibleLog(
  pinned: AnyResonanceDefinition,
  options: {
    captures?: readonly CapturedCombatAbilitySource[]
    lookupDefinition?: AnyResonanceDefinition | null
    hidden?: boolean
    viewer?: 'owner' | 'opponent' | 'spectator'
  } = {},
) {
  const fixture = automaticActivation(pinned)
  const lookup = vi.fn(async () =>
    options.lookupDefinition === undefined ? pinned : options.lookupDefinition,
  )
  const build: BattleBuildAuthoritySnapshot = {
    schemaVersion: 1,
    catalogVersion: 3,
    combatContext: 'pvp',
    combatants: [
      {
        combatantId: 'enemy',
        characterId: 'zei',
        snapshotSchemaVersion: 1,
        buildSchemaVersion: 1,
        buildVersion: 1,
        fingerprint: 'private-build-fingerprint',
        primary: {
          disciplineId: pinned.disciplinePair[0],
          definitionVersion: 1,
          profileVersion: 1,
        },
        secondary: { disciplineId: pinned.disciplinePair[1], definitionVersion: 1 },
        disciplineSkills: [],
        extensions: {
          essence: null,
          resonance: {
            resonanceId: pinned.id,
            contentVersion: pinned.contentVersion,
            disciplinePair: pinned.disciplinePair,
          },
        },
      },
    ],
  }
  const view = await createViewerSafeBattleLogService(
    { findBattleEvents: async () => fixture.records },
    {
      findBattleHistoryPrivacy: async () => ({
        viewer:
          options.viewer === 'owner' || options.viewer === 'opponent'
            ? deriveParticipantBattleViewerEntitlement(fixture.combatants, [
                options.viewer === 'owner' ? 'enemy' : 'actor',
              ])
            : createSpectatorBattleViewerEntitlement(),
        journals: [
          {
            ...fixture.journal,
            battleVersion: 2,
            actorCombatantId: 'actor',
            actorTeamId: 'players',
            eventCount: fixture.records.length,
            eventVisibilityOverrides: options.hidden
              ? fixture.records
                  .filter(
                    (record) => 'actionId' in record.event && record.event.actionId === pinned.id,
                  )
                  .map((record) => ({
                    eventIndex: record.eventIndex,
                    visibility: { kind: 'team-only' as const, teamId: 'enemies' },
                  }))
              : fixture.journal.eventVisibilityOverrides,
          },
        ],
        buildAuthority: build,
        capturedAbilitySources: options.captures ?? [fixture.captured],
      }),
    },
    { resolvePinnedSkillDefinition: async () => null, resolvePinnedResonanceDefinition: lookup },
  ).getLog('viewer', 'battle')
  return { view, lookup, fixture }
}

it.each(['owner', 'opponent', 'spectator'] as const)(
  'names and illustrates a visible canonical automatic custom Resonance for %s',
  async (viewer) => {
    const pinned = customAutomaticResonance()
    const { view, lookup } = await visibleLog(pinned, { viewer })
    const entry = view.entries.find(
      (entry) => entry.eventType === 'combat_action_used' && entry.actionId === pinned.id,
    )!
    expect(entry.actionContext).toMatchObject({
      family: 'resonance',
      contentId: pinned.id,
      contentVersion: 2,
      name: 'Ultra Instinct',
      artworkKey: 'content-media.f6ba91b3-6887-4197-8cc6-22f0aa48361b',
    })
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(lookup).toHaveBeenCalledWith(...pinned.disciplinePair, pinned.id, 2)
    const names = { combatantNames: { enemy: 'Zei', actor: 'Weon' } }
    const actions = buildBattleChronicle(view.entries, names).flatMap((round) =>
      round.actors.flatMap((actor) => actor.actions),
    )
    const action = actions.find((action) => action.contentId === pinned.id)!
    expect(action).toMatchObject({
      family: 'resonance',
      title: 'Ultra Instinct',
      contentVersion: 2,
    })
    expect(chronicleActionArtwork(action)).toBe(
      '/api/content-media/f6ba91b3-6887-4197-8cc6-22f0aa48361b',
    )
    const html = renderToStaticMarkup(<BattleLogChronicle entries={view.entries} {...names} />)
    const copied = formatBattleLogForClipboard(view.entries, names)
    for (const text of [html, copied]) {
      expect(text).toContain('Resonance · Ultra Instinct')
      expect(text).toContain('Zei uses Ultra Instinct.')
      expect(text).not.toContain('Resonance Fe1e7439')
    }
    expect(html).toContain('data-chronicle-family="resonance"')
    expect(JSON.stringify(view)).not.toContain('sourceInstanceId')
  },
)

it('uses an older exact captured name and refuses a newer mismatched version', async () => {
  const original = customAutomaticResonance(1, 'Recorded Instinct')
  const old = {
    ...original,
    media: {
      ...original.media!,
      artwork: { ...original.media!.artwork!, id: '00000000-0000-4000-8000-000000000015' },
    },
  }
  const older = await visibleLog(old)
  expect(formatBattleLogForClipboard(older.view.entries)).toContain('Recorded Instinct')
  expect(older.lookup).toHaveBeenCalledWith(...old.disciplinePair, old.id, 1)
  const action = buildBattleChronicle(older.view.entries)
    .flatMap((round) => round.actors.flatMap((actor) => actor.actions))
    .find((action) => action.contentId === old.id)!
  expect(chronicleActionArtwork(action)).toBe(
    '/api/content-media/00000000-0000-4000-8000-000000000015',
  )
  const mismatched = await visibleLog(old, { lookupDefinition: customAutomaticResonance() })
  expect(mismatched.view.entries.every((entry) => entry.actionContext === undefined)).toBe(true)
  expect(formatBattleLogForClipboard(mismatched.view.entries)).not.toContain('Ultra Instinct')
})

it.each(['missing', 'version', 'pair', 'kind', 'ambiguous'] as const)(
  'keeps the literal fallback for %s canonical source proof',
  async (kind) => {
    const pinned = customAutomaticResonance()
    const { captured } = automaticActivation(pinned)
    const captures =
      kind === 'missing'
        ? []
        : kind === 'version'
          ? [{ ...captured, contentVersion: 1 }]
          : kind === 'pair'
            ? [{ ...captured, sourceInstanceId: 'another-pair' }]
            : kind === 'kind'
              ? [{ ...captured, sourceKind: 'scenario' as const }]
              : [captured, captured]
    const { view, lookup } = await visibleLog(pinned, { captures })
    expect(view.entries.every((entry) => entry.actionContext === undefined)).toBe(true)
    expect(lookup).not.toHaveBeenCalled()
    expect(formatBattleLogForClipboard(view.entries)).not.toContain('Ultra Instinct')
  },
)

it.each(['opponent', 'spectator'] as const)(
  'never enriches hidden automatic Resonance identity or artwork for %s',
  async (viewer) => {
    const { view, lookup } = await visibleLog(customAutomaticResonance(), { viewer, hidden: true })
    expect(lookup).not.toHaveBeenCalled()
    expect(JSON.stringify(view)).not.toMatch(
      /Ultra Instinct|f6ba91b3|fe1e7439|actionContext|sourceInstanceId/,
    )
    expect(formatBattleLogForClipboard(view.entries)).not.toMatch(/Ultra Instinct|fe1e7439/)
  },
)
