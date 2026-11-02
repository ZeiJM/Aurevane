import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { EffectTagPicker } from '@/components/master/combat-content/effect-tag-picker'
import { validateSkillDefinition } from '@/server/master/current-combat-content-authoring-validation'
import { validateSkillDefinition as validateHistoricalSkill } from '@/server/master/combat-content-authoring-validation'
import {
  builtinCombatContentManifest,
  exactBuiltinCombatContentDefinition,
} from '@/server/master/combat-content-builtin-index'

vi.mock('server-only', () => ({}))

it('removes Summon from ordinary current effect choices while keeping its Invocation editor', () => {
  const ordinary = renderToStaticMarkup(createElement(EffectTagPicker, { onAdd() {} }))
  expect(ordinary).not.toMatch(/<option[^>]*value="summon"/u)
})

it('rejects current Guard commits while preserving historical Guard validation', () => {
  const guard = defaultBasicSkills().find((row) => row.id === 'basic.guard')!
  expect(validateHistoricalSkill(guard).valid).toBe(true)
  expect(validateSkillDefinition(guard)).toMatchObject({
    valid: false,
    issues: expect.arrayContaining([expect.objectContaining({ code: 'RETIRED_BASIC_ACTION' })]),
  })
})

it('rejects Summon in current class authoring while preserving the literal historical definition', () => {
  const current = resolveMatureSkillVersion('wildwarden.renewing-herbs')!
  const source = Array.from({ length: current.contentVersion }, (_, index) =>
    resolveMatureSkillVersion(current.id, current.contentVersion - index),
  ).find((row) => row?.summonProfile)!
  const before = structuredClone(source)
  expect(validateHistoricalSkill(source).valid).toBe(true)
  expect(validateSkillDefinition(source)).toMatchObject({
    valid: false,
    issues: expect.arrayContaining([expect.objectContaining({ code: 'EXCLUSIVE_SUPPORT_EFFECT' })]),
  })
  expect(source).toEqual(before)
})

it('omits Guard from current builtin synchronization while preserving exact historical lookup', () => {
  expect(builtinCombatContentManifest().some((row) => row.contentKey === 'basic.guard')).toBe(false)
  const guard = defaultBasicSkills().find((row) => row.id === 'basic.guard')!
  expect(exactBuiltinCombatContentDefinition('skill', guard.id, guard.contentVersion)).toEqual(
    guard,
  )
})

it('permits Summon only in Invocation and Loot only in Pilfer in current effect pickers', () => {
  const invocation = renderToStaticMarkup(
    createElement(EffectTagPicker, { contentId: 'basic.invocation', onAdd() {} }),
  )
  const pilfer = renderToStaticMarkup(
    createElement(EffectTagPicker, { contentId: 'basic.pilfer', onAdd() {} }),
  )
  expect(invocation).toMatch(/<option[^>]*value="summon"/u)
  expect(invocation).not.toMatch(/<option[^>]*value="loot"/u)
  expect(pilfer).toMatch(/<option[^>]*value="loot"/u)
  expect(pilfer).not.toMatch(/<option[^>]*value="summon"/u)
  for (const id of ['basic.pilfer', 'basic.invocation'] as const)
    expect(
      validateSkillDefinition(defaultBasicSkills().find((row) => row.id === id)!),
    ).toMatchObject({ valid: true, issues: [] })
})
