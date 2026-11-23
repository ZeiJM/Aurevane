import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import {
  executeCombatAction,
  type CombatActionDefinition,
} from '@aurevane/game-core/combat/actions'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import { counterDescription } from '@aurevane/game-core/combat/combat-counter'
import { combatEffectStrength } from '@aurevane/game-core/combat/combat-status-tuning'
import { customAutomaticResonance } from '@/components/battle/battle-custom-resonance.test-utils'
import { ResonanceParameters } from '@/components/character/resonance-parameters'
import { SkillEffectTimingProvider } from '@/components/character/skill-effect-timing-context'
import { previewEffect, previewEffectWithTag } from '@/components/character/skill-effect-preview'
import { canonicalEffectExplanation } from '@/components/character/canonical-effect-explanation'
import { battleEffectInformation } from '@/components/battle/battle-effect-information'
import { BattleLogChronicle } from '@/components/battle/battle-log-chronicle'
import { formatBattleLogForClipboard } from '@/components/battle/battle-log-clipboard'
import * as popovers from '@/components/battle/battle-info-popover'
import { buildBattleLogView } from './battle-log-service'
import { projectBattleStatusStateForViewer } from './battle-live-viewer-projection'
import { createSpectatorBattleViewerEntitlement } from './battle-viewer-entitlement'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { attachRecordedBattleLogSkillContext } from './battle-log-skill-context'
import type { BattleBuildAuthoritySnapshot } from './battle-build-authority'

vi.mock('server-only', () => ({}))

const effect = {
  type: 'apply-status',
  recipient: 'primary-unit',
  statusId: 'counter',
  stacks: 1,
  durationTurns: 2,
  counter: { kind: 'full', basisPoints: 10000 },
} as const
const action: CombatActionDefinition = {
  id: 'test.reflect',
  version: 1,
  sourceType: 'test',
  tags: [],
  requirements: [],
  cost: { spendsAction: false, mp: 0 },
  target: {
    kind: 'unit',
    teamPolicy: 'any',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 4,
    requiresLineOfSight: false,
    maximumElevationDifference: 0,
    friendlyFire: 'all-units',
  },
  effects: [effect],
}
function fixture(current: boolean, pending = false) {
  const initial = {
    ...percentageDotEncounter(),
    ...(current ? { reflectBarrierPolicyVersion: 1 as const } : {}),
    effectTimingPolicy: {
      version: 1,
      modes: { counter: pending ? ('next-round' as const) : ('instant' as const) },
    },
  }
  const transition = executeCombatAction(
    initial,
    action,
    { kind: 'unit', combatantId: 'enemy' },
    { statuses: PHASE4_STATUSES },
  )
  return {
    initial,
    transition,
    view: buildBattleLogView(
      'reflect',
      transition.events.map((event, eventIndex) => ({
        battleVersion: 1,
        eventIndex,
        createdAt: '2026-11-02T00:00:00Z',
        event,
      })),
    ),
  }
}

it.each([false, true])(
  'keeps native/canonical and the actual Ultra Instinct report on captured Reflect policy (current %s)',
  (current) => {
    const options = { legacyReflectBarrier: !current }
    for (const text of [
      counterDescription(effect.counter, options),
      previewEffect(effect, options).explanation,
      canonicalEffectExplanation(effect, options)!.description,
    ]) {
      expect(text.includes('damage absorbed by Barrier')).toBe(current)
      if (!current) expect(text).toContain('HP damage')
    }
    const definition = customAutomaticResonance()
    const before = JSON.stringify(definition)
    const html = renderToStaticMarkup(
      <SkillEffectTimingProvider policy={null} reflectBarrierPolicyVersion={current ? 1 : null}>
        <ResonanceParameters definition={definition} />
      </SkillEffectTimingProvider>,
    )
    expect(html.includes('damage absorbed by Barrier')).toBe(current)
    expect(html).toContain('Reflect')
    expect(html).toContain('100%')
    expect(JSON.stringify(definition)).toBe(before)
  },
)

it.each([false, true].flatMap((current) => [false, true].map((pending) => ({ current, pending }))))(
  'captures and renders exact $current/$pending Reflect receipts without consulting the current reader policy',
  ({ current, pending }) => {
    const { transition, view } = fixture(current, pending)
    const receipt = view.entries.find(
      (entry) => entry.eventType === (pending ? 'effect_pending' : 'status_applied'),
    )!
    expect(receipt.effectStrength).toEqual({
      counter: effect.counter,
      ...(current ? { reflectBarrierPolicyVersion: 1 } : {}),
    })
    const copied = formatBattleLogForClipboard(view.entries, { combatantNames: { enemy: 'Weon' } })
    expect(copied).toContain(`100% of all HP${current ? ' and Barrier' : ''} damage taken by Weon`)
    const status = projectBattleStatusStateForViewer(
      transition.state,
      createSpectatorBattleViewerEntitlement(),
    )
      .find((row) => row.combatantId === 'enemy')!
      .statuses.find((row) => row.statusId === 'counter')!
    expect(status.reflectBarrierPolicyVersion).toBe(current ? 1 : undefined)
    expect(battleEffectInformation(status).description.includes('damage absorbed by Barrier')).toBe(
      current,
    )
    const popup = vi
      .spyOn(popovers, 'BattleInfoPopover')
      .mockImplementation(({ trigger, children }) =>
        createElement('aside', null, trigger, children),
      )
    try {
      const html = renderToStaticMarkup(
        <SkillEffectTimingProvider policy={null} reflectBarrierPolicyVersion={1}>
          <BattleLogChronicle entries={view.entries} />
        </SkillEffectTimingProvider>,
      )
      expect(html.includes('damage absorbed by Barrier')).toBe(current)
      expect(html).toContain('100%')
    } finally {
      popup.mockRestore()
    }
    expect(JSON.stringify(view)).not.toMatch(
      /counterReturnBasisPoints|absorbedDamage|reflectedBasis|sourceInstanceId/,
    )
  },
)

it.each([false, true])(
  'keeps copied Reflect receipts on their captured encounter policy (current %s)',
  (current) => {
    const { transition } = fixture(current)
    const copied = executeCombatAction(
      { ...transition.state, effectTimingPolicy: undefined },
      {
        ...action,
        effects: [
          {
            type: 'copy-statuses',
            recipient: 'primary-unit',
            mode: 'amplify',
            statusIds: ['counter'],
            durationPolicyVersion: 1,
          },
        ],
      },
      { kind: 'unit', combatantId: 'enemy' },
      { statuses: PHASE4_STATUSES },
    )
    const view = buildBattleLogView(
      'copy',
      copied.events.map((event, eventIndex) => ({
        battleVersion: 2,
        eventIndex,
        createdAt: '2026-11-02T00:00:00Z',
        event,
      })),
    )
    expect(view.entries.find((entry) => entry.statusId === 'counter')?.effectStrength).toEqual({
      counter: effect.counter,
      ...(current ? { reflectBarrierPolicyVersion: 1 } : {}),
    })
  },
)

it('allowlists only the qualitative Reflect policy marker and never a damage-basis ledger', () => {
  expect(
    combatEffectStrength('counter', {
      counter: effect.counter,
      reflectBarrierPolicyVersion: 1,
      absorbedDamage: 500,
      counterReturnBasisPoints: '99999',
    }),
  ).toEqual({ counter: effect.counter, reflectBarrierPolicyVersion: 1 })
  expect(combatEffectStrength('blind', { reflectBarrierPolicyVersion: 1 })).toBeUndefined()
  expect(
    combatEffectStrength('counter', { counter: effect.counter, reflectBarrierPolicyVersion: 2 }),
  ).toEqual({ counter: effect.counter })
})
it('keeps captured Reflect mechanics available beneath authored compact wording', () => {
  const { transition, view } = fixture(true)
  const tag = {
    tagId: 'counter',
    contentVersion: 2,
    name: 'Reflect',
    compact: 'Owner note.',
  }
  const status = projectBattleStatusStateForViewer(
    transition.state,
    createSpectatorBattleViewerEntitlement(),
  )
    .find((row) => row.combatantId === 'enemy')!
    .statuses.find((row) => row.statusId === 'counter')!
  expect(battleEffectInformation({ ...status, battleTag: tag }).description).toContain(
    'damage absorbed by Barrier',
  )
  const authored = previewEffectWithTag(effect, [
    { ...tag, contentKey: 'tag.counter', full: 'Owner full note.' },
  ])
  expect(authored.explanation).toContain('Owner full note.')
  expect(authored.explanation).toContain('damage absorbed by Barrier')
  const popup = vi
    .spyOn(popovers, 'BattleInfoPopover')
    .mockImplementation(({ trigger, children }) => createElement('aside', null, trigger, children))
  try {
    const html = renderToStaticMarkup(
      createElement(BattleLogChronicle, {
        entries: view.entries.map((entry) =>
          entry.statusId === 'counter' ? { ...entry, battleTag: tag } : entry,
        ),
      }),
    )
    expect(html).toContain('Owner note.')
    expect(html).toContain('damage absorbed by Barrier')
  } finally {
    popup.mockRestore()
  }
})

it('keeps a historical full Skill report HP-only when history has no authoritative Reflect policy', async () => {
  const pinned = {
    ...resolveMatureSkillVersion('vanguard.forceful-strike', 2)!,
    contentVersion: 12,
    effects: [effect],
    effectDescriptions: undefined,
    presentation: undefined,
  }
  const authority: BattleBuildAuthoritySnapshot = {
    schemaVersion: 1,
    catalogVersion: 3,
    combatContext: 'pvp',
    combatants: [
      {
        combatantId: 'actor',
        characterId: 'actor',
        snapshotSchemaVersion: 1,
        buildSchemaVersion: 1,
        buildVersion: 1,
        fingerprint: 'private-fingerprint',
        primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
        secondary: null,
        disciplineSkills: [
          { slotIndex: 1, skillId: pinned.id, contentVersion: 12, sourceDisciplineId: 'vanguard' },
        ],
        extensions: { resonance: null, essence: null },
      },
    ],
  }
  const records = [
    {
      battleVersion: 1,
      eventIndex: 0,
      createdAt: '2026-11-02T00:00:00Z',
      event: { event: 'combat_action_used', actorId: 'actor', actionId: pinned.id },
    },
  ]
  const view = await attachRecordedBattleLogSkillContext(
    buildBattleLogView('history', records),
    records,
    authority,
    {
      resolvePinnedSkillDefinition: async () => pinned,
      resolvePinnedEssenceDefinition: async () => null,
      resolvePinnedResonanceDefinition: async () => null,
    },
  )
  expect(view.entries[0]!.actionContext?.description).toContain('HP damage')
  expect(view.entries[0]!.actionContext?.description).not.toContain('damage absorbed by Barrier')
})
