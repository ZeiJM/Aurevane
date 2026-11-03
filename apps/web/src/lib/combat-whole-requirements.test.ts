import { normalizeWholeAbilityRequirements } from './combat-whole-requirements'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { correctCombatContentEntries } from './combat-content-corrector'
import { validateSkillDefinition } from '@/server/master/current-combat-content-authoring-validation'
import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'

const audit = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/verification/release-assets/2026-11-03-whole-requirements-live-audit.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  affected: {
    content_key: string
    content_kind: CombatContentKind
    definition: CombatContentDefinition & { ability: AbilityDefinition }
  }[]
}
const stalwart = audit.affected.find((row) => row.content_key === 'bastion.stalwart-strike')!

it('commits the saved Stalwart Fortified prerequisite as a whole-action gate without changing packets', () => {
  const original = JSON.stringify(stalwart.definition)
  const next = correctCombatContentEntries(stalwart.content_kind, stalwart.definition).definition
  expect(next.ability.behaviors[0]!.requirements).toEqual({
    kind: 'status-presence',
    subject: 'owner',
    statusId: 'fortified',
    present: true,
  })
  expect(
    next.ability.behaviors[0]!.effects.map(({ requirements: oldRequirement, ...effect }) => {
      void oldRequirement
      return effect
    }),
  ).toEqual(
    stalwart.definition.ability.behaviors[0]!.effects.map(
      ({ requirements: oldRequirement, ...effect }) => {
        void oldRequirement
        return effect
      },
    ),
  )
  expect(next.ability.behaviors[0]!.effects.every((effect) => !effect.requirements)).toBe(true)
  expect(JSON.stringify(stalwart.definition)).toBe(original)
})

it('rejects a current request with hidden packet prerequisites while historical parsing remains independent', () => {
  const result = validateSkillDefinition(stalwart.definition)
  expect(result.issues).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: 'EFFECT_REQUIREMENT' })]),
  )
})

it('removes a Bleed prerequisite from the same Bleed packet so Open Wound can work on a fresh enemy', () => {
  const row = audit.affected.find((row) => row.content_key === 'ravager.open-wound')!
  const next = correctCombatContentEntries(row.content_kind, row.definition).definition
  expect(next.ability.behaviors[0]!.requirements).toBeNull()
  expect(next.ability.behaviors[0]!.effects[1]!.requirements).toBeUndefined()
  expect(next.ability.behaviors[0]!.effects[1]!.payload).toEqual(
    row.definition.ability.behaviors[0]!.effects[1]!.payload,
  )
})

it.each(audit.affected)(
  'removes all hidden conditions from current $content_key while keeping historical packet definitions unchanged',
  (row) => {
    const before = JSON.stringify(row.definition)
    const next = correctCombatContentEntries(row.content_kind, row.definition).definition
    const ability = next.ability
    const preserved = normalizeWholeAbilityRequirements(row.definition).definition.ability
    expect(
      ability.behaviors.every((group) => group.effects.every((effect) => !effect.requirements)),
    ).toBe(true)
    if (row.content_key !== 'wildwarden.close-quarry') {
      expect(ability.behaviors.map((group) => group.costs)).toEqual(
        row.definition.ability.behaviors.map((group) => group.costs),
      )
      expect(
        preserved.behaviors.map((group) => group.effects.map((effect) => effect.payload)),
      ).toEqual(
        row.definition.ability.behaviors.map((group) =>
          group.effects.map((effect) => effect.payload),
        ),
      )
    }
    expect(next.media).toEqual(row.definition.media)
    expect(JSON.stringify(row.definition)).toBe(before)
  },
)

it.each(['shadehand.execution-cut', 'ravager.desperate-execution'])(
  'retains the exact existing threshold and adds the reviewed whole status prerequisite for %s',
  (id) => {
    const row = audit.affected.find((row) => row.content_key === id)!
    const next = correctCombatContentEntries(row.content_kind, row.definition).definition.ability
      .behaviors[0]!
    expect(next.requirements).toEqual({
      kind: 'all',
      children: [
        row.definition.ability.behaviors[0]!.requirements,
        row.definition.ability.behaviors[0]!.effects[1]!.requirements,
      ],
    })
    expect(next.requirementMode).toBeUndefined()
  },
)

it('repairs Close Quarry to aim at the actual marked enemy while movement and MP stay on Self', () => {
  const row = audit.affected.find((row) => row.content_key === 'wildwarden.close-quarry')!
  const next = correctCombatContentEntries(row.content_kind, row.definition).definition.ability
    .behaviors[0]!
  expect(next.targeting).toMatchObject({
    kind: 'unit',
    teamPolicy: 'enemy',
    categories: ['enemy'],
    shape: { kind: 'single' },
    maximumRange: 1,
  })
  expect(next.requirements).toEqual({
    kind: 'status-presence',
    subject: 'selected',
    statusId: 'mark',
    present: true,
  })
  expect(next.effects.map((effect) => effect.payload.recipient)).toEqual([
    'actor',
    'primary-unit',
    'actor',
  ])
})
