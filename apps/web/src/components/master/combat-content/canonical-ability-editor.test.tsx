import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { CombatContentEditor } from './combat-content-editor'
import { EssenceContentEditor } from './essence-content-editor'
import { ResonanceContentEditor } from './resonance-content-editor'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { defaultAbilityPayload } from './ability-effect-editor'
import { COMBAT_TAG_REGISTRY } from '@aurevane/game-core/combat/combat-tag-registry'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
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
function assertCanonicalEditor(html: string) {
  expect(html).toMatch(/Next publish<\/dt><dd>v51<\/dd>/)
  for (const label of [
    'Group activation',
    'Group mode',
    'AP cost',
    'MP cost',
    'HP cost',
    'Effect timing',
    'Move maximum tiles',
    'Requirement kind',
    'Accuracy rule',
    'Fixed hit chance (%)',
  ])
    expect(html).toContain(`aria-label="${label}"`)
  expect(html).toContain('value="controlled" selected=""')
  expect(html).toContain('value="45"')
  expect(html).toContain('Once per battle')
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
    renderToStaticMarkup(
      <CombatContentEditor
        skills={[
          {
            id: definition.id,
            sourceDisciplineId: definition.sourceDisciplineId,
            label: 'Leap',
            versionFloor: 50,
            currentVersion: definition.contentVersion,
            baseVersion: definition.contentVersion,
            draftVersion: null,
            derivedTags: [],
            definition,
          },
        ]}
      />,
    ),
  )
  expect(JSON.stringify(definition)).toBe(before)
})
it('uses the same canonical editor for Essence mechanics while retaining the source envelope', () => {
  const original = resolveEssenceForBuild('vanguard', null)!
  const definition = { ...original, skill: { ...original.skill, ability } }
  assertCanonicalEditor(
    renderToStaticMarkup(
      <EssenceContentEditor
        essences={[
          {
            id: definition.essenceId,
            label: definition.name,
            versionFloor: 50,
            sourceDisciplineId: definition.sourceDisciplineId,
            currentVersion: definition.contentVersion,
            baseVersion: definition.contentVersion,
            draftVersion: null,
            derivedTags: [],
            definition,
            history: [],
          },
        ]}
      />,
    ),
  )
})
it('edits canonical Resonance groups without entering the legacy combo editor', () => {
  const definition = { ...resolveResonanceForPair('lifebinder', 'vanguard')!, ability }
  const html = renderToStaticMarkup(
    <ResonanceContentEditor
      resonances={[
        {
          id: definition.id,
          label: definition.name,
          versionFloor: 50,
          disciplinePair: definition.disciplinePair,
          currentVersion: definition.contentVersion,
          baseVersion: definition.contentVersion,
          draftVersion: null,
          definition,
          history: [],
        },
      ]}
    />,
  )
  assertCanonicalEditor(html)
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
  expect(html).toContain('aria-label="Effect timing"')
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
  const html = renderToStaticMarkup(
    <CombatContentEditor
      skills={[
        {
          id: definition.id,
          sourceDisciplineId: definition.sourceDisciplineId,
          label: 'Leap',
          currentVersion: definition.contentVersion,
          baseVersion: definition.contentVersion,
          draftVersion: null,
          derivedTags: [],
          definition,
        },
      ]}
    />,
  )
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
    return renderToStaticMarkup(
      <CombatContentEditor
        skills={[
          {
            id: definition.id,
            sourceDisciplineId: definition.sourceDisciplineId,
            label: definition.id,
            currentVersion: definition.contentVersion,
            baseVersion: definition.contentVersion,
            draftVersion: null,
            derivedTags: [],
            definition,
          },
        ]}
      />,
    )
  }
  const original = resolveEssenceForBuild('vanguard', null)!
  const definition = { ...original, skill: { ...original.skill, ability: selectedAbility } }
  return renderToStaticMarkup(
    <EssenceContentEditor
      essences={[
        {
          id: definition.essenceId,
          sourceDisciplineId: definition.sourceDisciplineId,
          label: definition.name,
          currentVersion: definition.contentVersion,
          baseVersion: definition.contentVersion,
          draftVersion: null,
          derivedTags: [],
          definition,
          history: [],
        },
      ]}
    />,
  )
}
it.each(['Skill', 'Essence'] as const)(
  'offers each supported Manual action in the actual %s preview selector',
  (kind) => {
    const html = renderPreviewEditor(kind, previewAbility)
    const selector = html.match(
      /<select[^>]*aria-label="Preview action group"[\s\S]*?<\/select>/,
    )?.[0]
    expect(selector).toBeDefined()
    expect(selector).toContain('<option value="brace" selected="">')
    expect(selector).toContain('<option value="recover">')
    expect(selector).not.toContain('value="react"')
  },
)
it.each(['Skill', 'Essence'] as const)(
  'does not offer a fake Manual battle preview for an Automatic-only %s',
  (kind) => {
    const automatic = parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: [previewAbility.behaviors[2]!],
    })
    const html = renderPreviewEditor(kind, automatic)
    expect(html).toContain('No Manual action group is available for a battle preview.')
    expect(html).not.toContain('aria-label="Preview action group"')
  },
)
