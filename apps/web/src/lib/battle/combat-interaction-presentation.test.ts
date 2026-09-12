import { expect, it } from 'vitest'
import {
  combatInteractionDescription,
  gameplayStatusName,
  terrainOverlayDescription,
  statusWasProjected,
} from './combat-interaction-presentation'

it('shares terrain duration and both-team rules between forecast and board inspection', () => {
  const overlay = {
    kind: 'frozen' as const,
    position: { x: 1, y: 2 },
    remainingRoundBoundaries: 2,
    sourceCombatantId: 'actor',
  }
  expect(terrainOverlayDescription(overlay)).toContain('2 round boundaries remaining')
  expect(terrainOverlayDescription(overlay)).toContain('either team')
  expect(
    terrainOverlayDescription({ ...overlay, kind: 'steam', remainingRoundBoundaries: 1 }),
  ).toContain('1 round boundary remaining')
  expect(terrainOverlayDescription(null)).toBe('')
  const event = {
    event: 'terrain_overlay_changed',
    position: overlay.position,
    before: 'frozen',
    after: 'steam',
    remainingRoundBoundaries: 2,
  }
  expect(combatInteractionDescription(event)).toContain('Frozen → Steam at tile 2,3')
  expect(combatInteractionDescription(event)).toContain('Blocks line of sight')
})

it('shows displacement failures and tag consumption without exposing arbitrary payloads', () => {
  expect(
    combatInteractionDescription({ event: 'displacement_failed', reason: 'occupied-tile' }),
  ).toContain('no refund')
  expect(
    combatInteractionDescription({ event: 'displacement_failed', reason: 'private-invalid-data' }),
  ).toBeNull()
  expect(combatInteractionDescription({ event: 'unknown', payload: 'private' })).toBeNull()
  expect(
    combatInteractionDescription({
      event: 'terrain_overlay_changed',
      position: { x: 0, y: 0 },
      after: 'private',
    }),
  ).toBeNull()
  expect(combatInteractionDescription({ event: 'status_removed', statusId: 'conductive' })).toBe(
    'Conductive removed.',
  )
  expect(gameplayStatusName('burn')).toBe('Burn (Scorched)')
  expect(gameplayStatusName('bleed')).toBe('Bleed (Bleeding)')
  expect(gameplayStatusName('poison')).toBe('Poison (Poisoned)')
})

it('does not advertise unit statuses when a legal empty-ground action affects no units', () => {
  expect(statusWasProjected('slow', [])).toBe(false)
  expect(statusWasProjected('slow', [{ event: 'status_applied', statusId: 'frozen' }])).toBe(false)
  expect(statusWasProjected('slow', [{ event: 'status_applied', statusId: 'slow' }])).toBe(true)
  expect(statusWasProjected('slow', undefined)).toBe(true)
})
