import { expect, it } from 'vitest'
import type { CombatTargetSpec } from './actions'
import {
  deriveSharedEffectAim,
  withAuthoredEffectTarget,
  withAuthoredAreaRecipients,
} from './combat-effect-target-authoring'

const aim: CombatTargetSpec = {
  geometryVersion: 2,
  kind: 'unit',
  teamPolicy: 'enemy',
  friendlyFire: 'enemies-only',
  shape: { kind: 'single' },
  minimumRange: 1,
  maximumRange: 3,
  maximumElevationDifference: 1,
  requiresLineOfSight: true,
}
it('derives one enemy aim for enemy damage and independent Self recovery', () => {
  const effects = [
    withAuthoredEffectTarget({ type: 'damage', recipient: 'primary-unit', amount: 10 }, 'enemy'),
    withAuthoredEffectTarget({ type: 'healing', recipient: 'actor', amount: 5 }, 'self'),
  ]
  expect(effects[0]).toMatchObject({ target: 'enemy', recipient: 'affected-units' })
  expect(effects[1]).toMatchObject({ target: 'self', recipient: 'actor' })
  const next = deriveSharedEffectAim(aim, effects)
  expect(next).toMatchObject({
    kind: 'unit',
    teamPolicy: 'enemy',
    maximumRange: 3,
    maximumSelections: 1,
  })
})
it('All is global effect scope and does not become a shape or need a second aim', () => {
  const effects = [{ type: 'damage', recipient: 'affected-units', target: 'all' as const }]
  expect(deriveSharedEffectAim(aim, effects)).toMatchObject({
    kind: 'self',
    shape: { kind: 'single' },
    maximumRange: 0,
  })
  expect(
    deriveSharedEffectAim(aim, [
      ...effects,
      { type: 'healing', recipient: 'affected-units', target: 'ally' },
    ]),
  ).toMatchObject({ kind: 'unit', teamPolicy: 'ally', maximumRange: 3 })
})
it('retains existing aim until all inherited external effects have deliberate targets', () => {
  const before = JSON.stringify(aim)
  expect(
    deriveSharedEffectAim(aim, [
      { type: 'damage', recipient: 'primary-unit' },
      { type: 'healing', recipient: 'affected-units', target: 'ally' },
    ]),
  ).toBe(aim)
  expect(JSON.stringify(aim)).toBe(before)
})
it('derives both friendly and hostile selection categories for a shared area', () => {
  expect(
    deriveSharedEffectAim({ ...aim, shape: { kind: 'circle', radius: 2 } }, [
      { type: 'damage', recipient: 'affected-units', target: 'enemy' },
      { type: 'healing', recipient: 'affected-units', target: 'ally' },
    ]),
  ).toMatchObject({
    geometryVersion: 3,
    categories: ['ally', 'enemy'],
    kind: 'unit',
    shape: { kind: 'circle', radius: 2 },
    minimumRange: 0,
    maximumRange: 2,
  })
})
it('uses Empty Tile for Summon and preserves its specialized recipient', () => {
  expect(
    withAuthoredEffectTarget({ type: 'summon', recipient: 'selected-tile' }, 'empty-tile'),
  ).toMatchObject({ recipient: 'selected-tile', target: 'empty-tile' })
  expect(
    deriveSharedEffectAim(aim, [
      { type: 'summon', recipient: 'selected-tile', target: 'empty-tile' },
    ]),
  ).toMatchObject({ kind: 'empty-tile', shape: { kind: 'single' }, maximumRange: 3 })
})
it('does not broaden retained multiple-selection definitions into the single-aim workflow', () => {
  const retained = { ...aim, maximumSelections: 3 }
  expect(() =>
    deriveSharedEffectAim(retained, [
      { type: 'damage', recipient: 'affected-units', target: 'enemy' },
    ]),
  ).toThrow(/multiple selections/)
})
it('derives one shared aim for mixed Ground and unit delivery', () => {
  expect(
    deriveSharedEffectAim(aim, [
      { type: 'damage', recipient: 'affected-units', target: 'ground' },
      { type: 'damage', recipient: 'affected-units', target: 'enemy' },
    ]),
  ).toMatchObject({
    geometryVersion: 3,
    kind: 'unit',
    categories: ['enemy', 'ground'],
    maximumSelections: 1,
  })
})

it('retains a selected aim needed by a requirement even when every effect is global', () => {
  expect(
    deriveSharedEffectAim(aim, [{ type: 'damage', recipient: 'affected-units', target: 'all' }], {
      requiresSelectedUnit: true,
    }),
  ).toBe(aim)
})

it('keeps Cleanse Chilled caster-only rather than silently widening its tag', () => {
  expect(() =>
    withAuthoredEffectTarget(
      { type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] },
      'ally',
    ),
  ).toThrow(/Cleanse Chilled.*Self/)
})

it('binds ordinary inherited unit packets to an explicitly authored area without altering targets or payloads', () => {
  const effects = [
    { type: 'damage', recipient: 'primary-unit', amount: 20 },
    { type: 'healing', recipient: 'actor', amount: 3 },
  ]
  const area = { ...aim, geometryVersion: 2 as const, shape: { kind: 'line' as const, length: 1 } }
  expect(withAuthoredAreaRecipients(area, effects)).toEqual([
    { ...effects[0], recipient: 'affected-units' },
    effects[1],
  ])
  expect(effects[0]!.recipient).toBe('primary-unit')
  expect(withAuthoredAreaRecipients(aim, effects)).toBe(effects)
})
it('never rewrites selected requirements, unit-only tags, or multiple selections into area recipients', () => {
  const area = {
    ...aim,
    geometryVersion: 3 as const,
    shape: { kind: 'circle' as const, radius: 2 },
  }
  const effects = [{ type: 'damage', recipient: 'primary-unit', amount: 20 }]
  expect(withAuthoredAreaRecipients(area, effects, { requiresSelectedUnit: true })).toBe(effects)
  for (const type of ['copy-statuses', 'sensory', 'summon']) {
    const retained = [{ type, recipient: 'primary-unit' }]
    expect(withAuthoredAreaRecipients(area, retained)).toBe(retained)
  }
  expect(withAuthoredAreaRecipients({ ...area, maximumSelections: 2 }, effects)).toBe(effects)
})
