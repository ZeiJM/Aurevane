import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { ContentDefinitionFields } from './content-definition-fields'
import { ContentRecordPreview } from './content-record-preview'
import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'
import { AbilityDefinitionEditor, withSharedEffectAim } from './ability-definition-editor'
import { defaultAbilityPayload, AbilityEffectEditor } from './ability-effect-editor'
import { SkillEffectEditor } from './skill-effect-editor'
import { COMBAT_TAG_REGISTRY } from '@aurevane/game-core/combat/combat-tag-registry'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
function CompleteFields({ kind, definition }: { kind: CombatContentKind; definition: object }) {
  const value = definition as CombatContentDefinition
  return (
    <>
      <ContentDefinitionFields kind={kind} value={value} tab="Parameters" onChange={() => {}} />
      <ContentRecordPreview kind={kind} working={value} current={null} saved={null} />
    </>
  )
}
const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
const ability = parseAbilityDefinition({
  schemaVersion: 1,
  behaviors: [
    {
      ...base,
      id: 'leap',
      costs: [
        { resource: 'ap', amount: 11 },
        { resource: 'mp', amount: 2 },
        { resource: 'hp', amount: 1 },
      ],
      accuracy: { kind: 'fixed', chanceBasisPoints: 4500 },
      requirements: {
        kind: 'resource-state',
        subject: 'owner',
        resource: 'mp',
        comparison: 'at-least',
        amount: 3,
      },
      activationLimits: ['once-per-battle'],
      effects: [
        { id: 'walk', payload: { type: 'move', recipient: 'actor', maximumTiles: 2 } },
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 13 },
        },
      ],
    },
  ],
})
function assertCanonicalEditor(html: string, { resonance = false } = {}) {
  for (const label of [
    'Group activation',
    'Group mode',
    'AP cost',
    'MP cost',
    'HP cost',
    'Move maximum tiles',
    'Requirement kind',
    'Accuracy rule',
  ])
    expect(html).toContain(`aria-label="${label}"`)
  expect(html).toContain('data-compact-effect-timing="true">[Controlled]')
  expect(html).toContain('Stored fixed hit chance: 45%')
  if (resonance) {
    expect(html).not.toContain('Once per battle')
    expect(html).not.toContain('aria-label="Usage limits"')
  } else {
    expect(html).toContain('Once per battle')
  }
  expect(html).toContain('<legend>Usage limits</legend>')
  expect(html).not.toContain('aria-label="Action Economy (AP)"')
  expect(html).not.toContain('aria-label="Accuracy mode"')
}
it('edits canonical Skill groups instead of the stale native economy and effect arrays', () => {
  const definition = {
    ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
    ability,
    apCost: 71,
  }
  const before = JSON.stringify(definition)
  assertCanonicalEditor(
    renderToStaticMarkup(<CompleteFields kind="skill" definition={definition} />),
  )
  expect(JSON.stringify(definition)).toBe(before)
})
it('uses the same canonical editor for Essence mechanics while retaining the source envelope', () => {
  const original = resolveEssenceForBuild('vanguard', null)!
  const definition = { ...original, skill: { ...original.skill, ability } }
  assertCanonicalEditor(
    renderToStaticMarkup(<CompleteFields kind="essence" definition={definition} />),
  )
})
it('edits canonical Resonance groups without entering the legacy combo editor', () => {
  const definition = { ...resolveResonanceForPair('lifebinder', 'vanguard')!, ability }
  const html = renderToStaticMarkup(<CompleteFields kind="resonance" definition={definition} />)
  assertCanonicalEditor(html, { resonance: true })
  expect(html).not.toContain('aria-label="Resonance mode"')
})

it.each(COMBAT_TAG_REGISTRY)('provides typed controls for registered $id payloads', (tag) => {
  const combination = tag.combinations[0]!
  const group = {
    ...base,
    ...combination,
    requirements: null,
    ...(combination.mode === 'modifier'
      ? { targeting: null, classification: 'utility' as const, attackFamily: undefined }
      : {}),
    effects: [{ id: 'effect', payload: defaultAbilityPayload(tag.id) }],
  }
  const html = renderToStaticMarkup(
    <AbilityDefinitionEditor
      value={{ schemaVersion: 1, behaviors: [group] }}
      onChange={() => {}}
    />,
  )
  expect(html).toContain(`data-ability-effect="effect"`)
  expect(html).not.toContain('aria-label="Effect timing"')
  expect(html).not.toContain('aria-label="Piercing"')
  if (tag.id === 'pierce') {
    expect(html).toContain('aria-label="Equipment Armor ignored (%)"')
    expect(html).not.toContain('aria-label="Vengeance enabled"')
  }
})

it('keeps an incompatible draft editable and shows named validation instead of a broken player preview', () => {
  const invalid = {
    ...ability,
    behaviors: ability.behaviors.map((group) => ({
      ...group,
      effects: group.effects.map((effect) =>
        effect.payload.type === 'move'
          ? { ...effect, payload: { ...effect.payload, maximumTiles: 21 } }
          : effect,
      ),
    })),
  }
  const definition = { ...resolveMatureSkillVersion('vanguard.forceful-strike')!, ability: invalid }
  const html = renderToStaticMarkup(<CompleteFields kind="skill" definition={definition} />)
  expect(html).toContain('Resolve compatibility before publishing')
  expect(html).toContain('Resolve Ability compatibility to show the player preview.')
  expect(html).toContain('aria-label="Move maximum tiles"')
})

const previewGuard = defaultBasicSkills().find((row) => row.id === 'basic.guard')!.ability
  .behaviors[0]!
const previewAbility = parseAbilityDefinition({
  schemaVersion: 1,
  behaviors: [
    { ...previewGuard, id: 'brace' },
    {
      ...previewGuard,
      id: 'recover',
      classification: 'recovery',
      effects: [{ id: 'mend', payload: { type: 'healing', recipient: 'actor', amount: 17 } }],
    },
    {
      ...previewGuard,
      id: 'react',
      activation: 'automatic',
      requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'after' },
      automaticTarget: { subject: 'owner' },
    },
  ],
})
function renderPreviewEditor(kind: 'Skill' | 'Essence', selectedAbility: typeof previewAbility) {
  if (kind === 'Skill') {
    const definition = {
      ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
      ability: selectedAbility,
    }
    return renderToStaticMarkup(<CompleteFields kind="skill" definition={definition} />)
  }
  const original = resolveEssenceForBuild('vanguard', null)!
  const definition = { ...original, skill: { ...original.skill, ability: selectedAbility } }
  return renderToStaticMarkup(<CompleteFields kind="essence" definition={definition} />)
}
it.each(['Skill', 'Essence'] as const)(
  'distinguishes Manual and Automatic groups in the actual %s preview selector',
  (kind) => {
    const html = renderPreviewEditor(kind, previewAbility)
    const selector = html.match(
      /<select[^>]*aria-label="Preview action group"[\s\S]*?<\/select>/,
    )?.[0]
    expect(selector).toBeDefined()
    expect(selector).toContain('<option value="brace" selected="">')
    expect(selector).toContain('<option value="recover">')
    expect(selector).toContain('value="react"')
    expect(selector).toContain('Automatic Action')
  },
)
it.each(['Skill', 'Essence'] as const)(
  'offers a reference event sample for an Automatic-only %s',
  (kind) => {
    const automatic = parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: [previewAbility.behaviors[2]!],
    })
    const html = renderPreviewEditor(kind, automatic)
    expect(html).toContain('Automatic Action')
    expect(html).toContain('aria-label="Reference actor"')
    expect(html).toContain('aria-label="Owner starting HP (%)"')
    expect(html).toContain('aria-label="Owner starting MP (%)"')
    expect(html).toContain('aria-label="Owner starting status"')
    expect(html).not.toContain('Manual Action')
  },
)

it('exposes persistent Ground controls on the actual canonical group editor', () => {
  const group = {
    ...base,
    targeting: {
      ...base.targeting!,
      geometryVersion: 3 as const,
      kind: 'ground-tile' as const,
      categories: ['ground' as const],
      minimumRange: 0,
    },
    effects: [
      {
        id: 'hit',
        payload: { type: 'damage' as const, recipient: 'affected-units' as const, amount: 10 },
      },
    ],
    groundArea: {
      durationRounds: 3,
      visualPresetId: 'embers' as const,
      entryEffectIds: ['hit'],
      timing: 'instant' as const,
    },
  }
  const html = renderToStaticMarkup(
    <AbilityDefinitionEditor
      value={{ schemaVersion: 1, behaviors: [group] }}
      onChange={() => {}}
    />,
  )
  expect(html).toContain('aria-label="Persistent ground effect"')
  expect(html).toContain('aria-label="Ground duration (rounds)"')
  expect(html).toContain('aria-label="Ground animation"')
  expect(html).not.toContain('aria-label="Ground activation"')
  expect(html).toContain('value="3"')
})

it.each(['no-entry', 'unit-target'] as const)(
  'keeps an existing Ground draft repairable after %s edits',
  (edit) => {
    const group = {
      ...base,
      targeting: {
        ...base.targeting!,
        kind: edit === 'unit-target' ? ('unit' as const) : ('ground-tile' as const),
      },
      effects: [
        {
          id: 'self-heal',
          payload: { type: 'healing' as const, recipient: 'actor' as const, amount: 2 },
        },
      ],
      groundArea: {
        durationRounds: 2,
        visualPresetId: 'frost' as const,
        entryEffectIds: ['removed-hit'],
      },
    }
    const html = renderToStaticMarkup(
      <AbilityDefinitionEditor
        value={{ schemaVersion: 1, behaviors: [group] }}
        onChange={() => {}}
      />,
    )
    expect(html).toContain('aria-label="Persistent ground effect"')
    expect(html).toContain('Ground areas')
  },
)

it('edits canonical Pierce through native controls without leaking trusted execution fields', () => {
  const value = { id: 'pierce', payload: defaultAbilityPayload('pierce') }
  const onChange = vi.fn()
  const tree = AbilityEffectEditor({ value, onChange })
  const controls = tree.props.children[1]
  const editor = controls.props.children.find(
    (child: { type: unknown } | null) => child?.type === SkillEffectEditor,
  )
  editor.props.onChange({ ...editor.props.value, amount: 17 })
  const edited = onChange.mock.calls[0]![0]
  expect(edited.payload).not.toHaveProperty('shattersBarrier')
  expect(edited.payload).toEqual({
    type: 'pierce',
    recipient: 'primary-unit',
    amount: 17,
    armorIgnoredBasisPoints: 2500,
  })
  expect(() =>
    parseAbilityDefinition({ schemaVersion: 1, behaviors: [{ ...base, effects: [edited] }] }),
  ).not.toThrow()
})

it('keeps AP explicit and offers optional HP/MP costs without dead zero inputs', () => {
  const onChange = vi.fn()
  const definition = {
    ...ability,
    behaviors: [{ ...ability.behaviors[0]!, costs: [{ resource: 'ap' as const, amount: 10 }] }],
  }
  const html = renderToStaticMarkup(
    <AbilityDefinitionEditor value={definition} section="economy" onChange={onChange} />,
  )
  expect(html).toContain('AP cost')
  expect(html).toContain('Add HP cost')
  expect(html).toContain('Add MP cost')
  expect(html).not.toContain('aria-label="HP cost"')
  expect(html).not.toContain('aria-label="MP cost"')
  expect(onChange).not.toHaveBeenCalled()
})

it('rebinds automatic delivery when an effect changes to Self, preserving valid captured rules', () => {
  const next = withSharedEffectAim({
    ...base,
    requirementMode: 'simple',
    activation: 'automatic',
    automaticTrigger: 'damage-taken',
    automaticTarget: { subject: 'triggering' },
    requirements: null,
    effects: [
      {
        id: 'recover',
        payload: { type: 'healing', recipient: 'actor', target: 'self', amount: 1, ticks: 1 },
      },
    ],
  })
  expect(next.targeting?.kind).toBe('self')
  expect(next.automaticTarget).toEqual({ subject: 'owner' })
  expect(() => parseAbilityDefinition({ schemaVersion: 1, behaviors: [next] })).not.toThrow()
})

it('offers the same two ordinary accuracy choices and preserves a retained fixed rule without editing it', () => {
  const before = JSON.stringify(ability)
  const retained = renderToStaticMarkup(
    <AbilityDefinitionEditor
      value={ability}
      section="accuracy"
      onChange={() => {
        throw new Error('Must not rewrite on open')
      }}
    />,
  )
  expect(retained).not.toContain('>Fixed chance</option>')
  expect(retained).not.toContain('aria-label="Fixed hit chance (%)"')
  expect(retained).toContain('Stored fixed hit chance: 45%')
  expect(retained).toContain('>Accuracy Roll</option>')
  expect(retained).toContain('>Always Hit</option>')
  expect(JSON.stringify(ability)).toBe(before)
})
