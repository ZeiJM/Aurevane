import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { abilityBehaviorInformation } from '../character/ability-detail-presentation'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { resolveBattleModifierDraft } from './battle-modifier-draft'
import { BattleModifierPanel, BattleModifierPicker } from './battle-modifier-picker'
import {
  battleModifierChoices,
  battleModifierCanToggle,
  battleModifierContextForAction,
  prepareBattleModifierActionDraft,
  battleRecoveryActionId,
  type BattleModifierActionChoice,
} from './battle-modifier-picker-model'

const behavior = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability
  .behaviors[0]!
const report = abilityBehaviorInformation(behavior)
const root: BattleModifierActionChoice = {
  key: 'root',
  label: 'Strike',
  context: {
    battleSessionId: 'battle',
    battleVersion: 1,
    actorId: 'actor',
    actionId: 'strike',
    behaviorId: 'use',
    rootContentVersion: 2,
    rootFingerprint: 'root',
  },
  descriptor: {
    id: 'strike',
    targetKind: 'unit',
    targetTeamPolicy: 'enemy',
    minimumRange: 1,
    maximumRange: 4,
    classification: 'attack',
    modifierRoot: {
      classification: 'attack',
      targetKind: 'unit',
      persistentGround: false,
      hasPrimaryRecipient: true,
    },
  },
}
const row = {
  ownerCombatantId: 'actor',
  sourceInstanceId: 'opaque-never-parse',
  behaviorId: 'extra',
  name: 'extra',
  type: 'manual-modifier' as const,
  abilityId: 'owned',
  contentVersion: 7,
  report,
  compatibility: { payloadsSupported: true, requiresExplicitUnit: true },
  costs: [{ resource: 'ap' as const, amount: 3 }],
  cooldown: null,
  ownerEligible: false,
  blockedReasons: ['insufficient-ap'],
  requiresAction: true as const,
}
const choices = () =>
  battleModifierChoices([row], 'actor', [{ id: 'owned', contentVersion: 7, name: 'Pinned name' }])
it('pins root geometry, costs and selected group independently of transient movement or attached references', () => {
  const context = battleModifierContextForAction('battle', 1, 'actor', root.descriptor, 2)
  expect(context).toMatchObject({
    battleSessionId: 'battle',
    battleVersion: 1,
    actorId: 'actor',
    actionId: 'strike',
    rootContentVersion: 2,
  })
  expect(
    battleModifierContextForAction(
      'battle',
      1,
      'actor',
      { ...root.descriptor, costs: [{ resource: 'ap', amount: 5 }] },
      2,
    ).rootFingerprint,
  ).not.toBe(context.rootFingerprint)
  expect(
    battleModifierContextForAction(
      'battle',
      1,
      'actor',
      { ...root.descriptor, movementPath: [{ x: 1, y: 1 }], manualModifiers: [row] },
      2,
    ).rootFingerprint,
  ).toBe(context.rootFingerprint)
})
it('uses exact pinned public names, refuses missing metadata and retains removed selections visibly', () => {
  const choice = choices()[0]!
  expect(choice.label).toBe('Pinned name · extra')
  expect(battleModifierChoices([row], 'other', [])).toEqual([])
  expect(
    battleModifierChoices([row], 'actor', [
      { id: 'owned', contentVersion: 8, name: 'Wrong version' },
    ])[0]!.label,
  ).toBe('Modifier · extra')
  expect(
    battleModifierChoices([{ ...row, contentVersion: undefined }], 'actor', [])[0]!.pin,
  ).toBeNull()
  const removed = battleModifierChoices([], 'actor', [], [choice.pin!], [choice.reference])
  expect(removed).toHaveLength(1)
  expect(removed[0]!.label).toBe('Unavailable modifier')
  expect(removed[0]!.costs).toBeNull()
})
it('permits only structural free-prime selection, retains removable ordinary blocked choices and enforces readonly/locked state', () => {
  const choice = choices()[0]!
  expect(battleModifierCanToggle(choice, false, root, false, false)).toBe(false)
  expect(battleModifierCanToggle(choice, true, root, false, false)).toBe(true)
  const primable = {
    ...root,
    descriptor: {
      ...root.descriptor,
      controlled: { phase: 'unprimed' as const, canPrime: true, canCancel: false },
    },
  }
  expect(battleModifierCanToggle(choice, false, primable, false, false)).toBe(true)
  expect(battleModifierCanToggle(choice, true, primable, true, false)).toBe(false)
  expect(battleModifierCanToggle(choice, true, root, false, true)).toBe(false)
})
it('renders an honest unquoted/free-prime reader and hides a guessed shortcut while controls load', () => {
  const props = {
    actions: [root],
    modifiers: choices(),
    selectedActionKey: 'root',
    selectedReferences: [],
    locked: false,
    readOnly: false,
    binding: null,
    quote: null,
    quotePending: false,
    onPrepareAction: () => {},
    onToggleModifier: () => {},
    triggerRef: createRef<HTMLButtonElement>(),
  }
  const trigger = renderToStaticMarkup(<BattleModifierPicker {...props} />)
  expect(trigger).toContain('Modifiers')
  expect(trigger).not.toContain('[M]')
  const markup = renderToStaticMarkup(<BattleModifierPanel {...props} />)
  expect(markup).toContain('role="checkbox"')
  expect(markup).toContain('aria-disabled="true"')
  expect(markup).toContain('Choose a target for the complete release cost.')
  expect(markup).not.toContain('opaque-never-parse')
  const quote = renderToStaticMarkup(
    <BattleModifierPanel
      {...props}
      quote={{
        commandCosts: [
          { resource: 'ap', amount: 4 },
          { resource: 'mp', amount: 0 },
          { resource: 'hp', amount: 2 },
        ],
        commandCooldowns: [],
      }}
    />,
  )
  expect(quote).toContain('4 AP / 0 MP / 2 HP')
})

it.each(['primed', 'spent'] as const)(
  'retains an idle %s read context and uses only the captured set',
  (phase) => {
    for (const manualModifiers of [
      undefined,
      [{ sourceInstanceId: 'captured', behaviorId: 'extra' }],
    ]) {
      const controlled = { phase, canPrime: false, canCancel: phase === 'primed', manualModifiers }
      const choice = { ...root, descriptor: { ...root.descriptor, controlled } }
      const prepared = prepareBattleModifierActionDraft(null, choice)
      expect(prepared?.context).toEqual(root.context)
      expect(resolveBattleModifierDraft(prepared, root.context, [], controlled)).toEqual({
        manualModifiers: manualModifiers ?? [],
        stale: false,
        locked: true,
      })
    }
  },
)
it('keeps an explicitly selected recovery group on its owned attack-first ability instead of Basic Recovery', () => {
  const mixed = { actionId: 'attack-first-resonance', classification: 'recovery' }
  expect(battleRecoveryActionId(mixed.actionId, ['basic.recover'], [mixed])).toBe(mixed.actionId)
  expect(
    battleRecoveryActionId(
      mixed.actionId,
      ['basic.recover'],
      [
        {
          ...mixed,
          classification: 'attack',
        },
      ],
    ),
  ).toBe('basic.recover')
  expect(battleRecoveryActionId('removed', ['basic.recover'], [mixed])).toBe('basic.recover')
})
it('keeps an implicit sole captured Barrier recovery action despite its defense menu category', () => {
  const captures = [
    { actionId: 'dawnshield.aegis', behaviorId: 'aegis', classification: 'recovery' },
  ]
  expect(battleRecoveryActionId('dawnshield.aegis', [], captures)).toBe('dawnshield.aegis')
  expect(battleRecoveryActionId('dawnshield.aegis', ['basic.recover'], captures)).toBe(
    'dawnshield.aegis',
  )
  expect(
    battleRecoveryActionId(
      'dawnshield.aegis',
      ['basic.recover'],
      [...captures, { ...captures[0]!, behaviorId: 'other' }],
    ),
  ).toBe('basic.recover')
  expect(battleRecoveryActionId('removed', ['basic.recover'], captures)).toBe('basic.recover')
})
it.each([
  { version: 8, expected: 'Ability', rejected: 'Wrong version' },
  { version: 9, expected: 'Visible Automatic', rejected: 'Ability:' },
])(
  'labels a visible Automatic clock from exact public version $version',
  ({ version, expected, rejected }) => {
    const markup = renderToStaticMarkup(
      <BattleModifierPanel
        actions={[root]}
        modifiers={choices()}
        publicNames={[
          {
            id: 'visible.automatic',
            contentVersion: version,
            name: version === 9 ? 'Visible Automatic' : 'Wrong version',
          },
        ]}
        selectedActionKey={root.key}
        selectedReferences={[]}
        locked={false}
        readOnly={false}
        binding={null}
        quote={{
          commandCosts: [],
          commandCooldowns: [
            {
              actionId: 'visible.automatic',
              contentVersion: 9,
              behaviorId: 'on-hit',
              role: 'automatic-modifier',
              ownerTurns: 3,
              ticksRemaining: 0,
            },
          ],
        }}
        quotePending={false}
        onPrepareAction={() => {}}
        onToggleModifier={() => {}}
        triggerRef={createRef<HTMLButtonElement>()}
      />,
    )
    expect(markup).not.toContain('Strike<!-- -->: 3 turns')
    expect(markup).not.toMatch(/Strike(?:<!-- -->)*: (?:<!-- -->)*3(?:<!-- -->)* turns/)
    expect(markup).toContain(expected)
    expect(markup).not.toContain(rejected)
  },
)

it('explains paid Reversal preparation without a free prime or a later release', () => {
  const choice = {
    ...root,
    descriptor: {
      ...root.descriptor,
      costs: [{ resource: 'ap' as const, amount: 35 }],
      controlled: {
        kind: 'reversal' as const,
        phase: 'unprimed' as const,
        canPrime: true,
        canCancel: false,
      },
    },
  }
  const markup = renderToStaticMarkup(
    <BattleModifierPanel
      actions={[choice]}
      selectedActionKey={choice.key}
      modifiers={[]}
      selectedReferences={[]}
      locked={false}
      readOnly={false}
      binding={null}
      quote={{ commandCosts: [{ resource: 'ap', amount: 35 }], commandCooldowns: [] }}
      quotePending={false}
      onPrepareAction={() => undefined}
      onToggleModifier={() => undefined}
      triggerRef={createRef<HTMLButtonElement>()}
    />,
  )
  expect(markup).toContain('Prepare: Paid')
  expect(markup).toContain('Preparation cost')
  expect(markup).not.toContain('Prime: Free')
  expect(markup).not.toContain('Release cost')
})
