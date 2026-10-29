import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { captureCombatTagPresentation } from '@aurevane/game-core/combat/combat-tag-registry'
import { AbilityDefinitionParameters } from './ability-definition-parameters'
import { EffectTagLabel } from './compact-skill-effect-summary'

it('uses independent status wording in the shared full ability reader', () => {
  const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
  const definition = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        effects: [
          {
            id: 'guard',
            payload: { type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 },
          },
          {
            id: 'expose',
            payload: {
              type: 'apply-status',
              recipient: 'primary-unit',
              statusId: 'exposed',
              stacks: 1,
            },
          },
        ],
      },
    ],
    tagPresentation: ['guarded', 'exposed'].map((id) =>
      captureCombatTagPresentation({
        id: `tag.${id}`,
        tagId: id,
        contentVersion: 3,
        name: `Edited ${id}`,
        description: `Battle ${id}.`,
        explanation: `Manager ${id}.`,
      }),
    ),
  })
  const html = renderToStaticMarkup(
    <AbilityDefinitionParameters
      definition={definition}
      effectDescriptions={['Old Skill wording.', 'Old Skill wording.']}
    />,
  )
  for (const id of ['guarded', 'exposed']) {
    expect(html).toContain(`data-combat-tag-reference="${id}"`)
    expect(html).toContain(`Edited ${id}`)
    expect(html).toContain(`Manager ${id}.`)
  }
  expect(html).not.toContain('Old Skill wording.')
})

it('keeps generated effect parameters when central wording adds text around them', () => {
  const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
  const definition = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        effects: [
          {
            id: 'recover',
            payload: {
              type: 'percentage-recovery',
              recipient: 'primary-unit',
              resource: 'hp',
              percentageBasisPoints: 1200,
              ticks: 2,
            },
          },
        ],
      },
    ],
    tagPresentation: [
      captureCombatTagPresentation({
        id: 'tag.hp-recovery',
        tagId: 'hp-recovery',
        contentVersion: 2,
        name: 'HP Recovery',
        description: 'Battle: {summary}',
        explanation: 'Additional care. {details}',
      }),
    ],
  })
  const html = renderToStaticMarkup(<AbilityDefinitionParameters definition={definition} />)
  expect(html).toContain('Additional care.')
  expect(html).toContain('12%')
  expect(html).not.toContain('{details}')
  expect(html).not.toContain('{summary}')
})

it('shows only the short description in a tag hover', () => {
  const tag = captureCombatTagPresentation({
    id: 'tag.guarded',
    tagId: 'guarded',
    contentVersion: 2,
    name: 'Guard',
    description: 'Brief battle explanation.',
    explanation: 'Long Skill Manager explanation.',
  })
  const popup = EffectTagLabel({ label: 'Guard', tagPresentation: tag })
  const html = renderToStaticMarkup(<>{popup.props.children}</>)
  expect(html).toContain('Brief battle explanation.')
  expect(html).not.toContain('Long Skill Manager explanation.')
})

it('uses central descriptions in native Discipline Skill and nested Essence readers without converting mechanics', async () => {
  const { resolveMatureSkillVersion } = await import('@aurevane/game-core/combat/mature-skills')
  const { currentEssenceDefinitions } = await import('@aurevane/game-core/combat/essence')
  const { bindCombatTagPresentations } =
    await import('@aurevane/game-core/combat/combat-tag-registry')
  const { combatEffectPresentationId } =
    await import('@aurevane/game-core/combat/combat-effect-identities')
  const { SkillDetails } = await import('./skill-details')
  const source = [
    resolveMatureSkillVersion('farstrider.volley')!,
    currentEssenceDefinitions()[0]!.skill,
  ]
  for (const skill of source) {
    expect(skill.ability).toBeUndefined()
    const tagId = combatEffectPresentationId(skill.effects[0]!)
    const captured = captureCombatTagPresentation({
      id: `tag.${tagId}`,
      tagId,
      contentVersion: 2,
      name: 'Native tag',
      description: 'Brief native battle wording.',
      explanation: 'Shared native rules. {details}',
    })
    const bound = bindCombatTagPresentations(skill, [captured])
    const html = renderToStaticMarkup(<SkillDetails skill={bound} expanded />)
    expect(html).toContain('Shared native rules.')
    expect(html).toContain(`data-combat-tag-reference="${tagId}"`)
    expect(bound.effects).toEqual(skill.effects)
  }
})

it('uses the same central full wording in native Resonance results', async () => {
  const { currentResonanceDefinitions } = await import('@aurevane/game-core/combat/resonance')
  const { normalizedResonanceMechanics } = await import('@aurevane/game-core/combat/resonance-v2')
  const { bindCombatTagPresentations } =
    await import('@aurevane/game-core/combat/combat-tag-registry')
  const { combatEffectPresentationId } =
    await import('@aurevane/game-core/combat/combat-effect-identities')
  const { ResonanceParameters } = await import('./resonance-parameters')
  const definition = currentResonanceDefinitions()[0]!
  expect(definition.ability).toBeUndefined()
  const tagId = combatEffectPresentationId(
    normalizedResonanceMechanics(definition).resultEffects[0]!,
  )
  const captured = captureCombatTagPresentation({
    id: `tag.${tagId}`,
    tagId,
    contentVersion: 2,
    name: 'Result tag',
    description: 'Short Resonance wording.',
    explanation: 'Shared Resonance rules. {details}',
  })
  const html = renderToStaticMarkup(
    <ResonanceParameters definition={bindCombatTagPresentations(definition, [captured])} />,
  )
  expect(html).toContain('Shared Resonance rules.')
  expect(html).toContain(`data-combat-tag-reference="${tagId}"`)
})
