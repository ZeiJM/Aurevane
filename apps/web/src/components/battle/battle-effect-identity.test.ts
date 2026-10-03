import { describe, expect, it } from 'vitest'
import type { CombatStatusInstance } from '@aurevane/game-core/combat/actions'
import { combatStatusDetails, PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import { battleEffectIdentity, describeBattleEffect } from './battle-effect-identity'

const pendingFamilies = [
  'mp-drain',
  'mp-recovery',
  'create-terrain',
  'displace',
  'barrier-change',
  'return-to-turn-start',
  'remove-status',
  'copy-statuses',
  'sensory',
  'summon',
  'copy',
  'beneficial-copy',
  'damage',
  'healing',
]

describe('battle effect identity', () => {
  it.each([
    ['guarded', 'Each stack reduces incoming damage by 11%'],
    ['exposed', 'Take 11% more damage'],
    ['inspired', 'Deal 11% more damage'],
    ['hexed', 'Receive 11% less healing'],
    ['mark', '+11 percentage points Accuracy'],
    ['blind', 'Lose 11 percentage points Accuracy'],
    ['warded', 'Take 11% less damage from opponents affected by Burn'],
    ['marked', 'Take 11% more damage from the unit that applied Mark'],
  ])(
    'describes recorded %s potency in both active and pending readers',
    (statusId, description) => {
      for (const timingState of ['active', 'pending'] as const) {
        const effect: CombatStatusInstance = {
          statusId,
          statusVersion: 1,
          stacks: 1,
          remainingOwnerTurnStarts: 2,
          sourceCombatantId: 'caster',
          potencyBasisPoints: 1100,
          timingState,
        }
        const details = describeBattleEffect(effect)
        expect(details.description).toContain(description)
        expect(details.explanation).toContain(description)
      }
    },
  )

  it('retains canonical descriptions when historical instances have no recorded potency', () => {
    for (const statusId of ['guarded', 'warded', 'marked', 'hexed', 'inspired', 'fortified']) {
      expect(
        describeBattleEffect({
          statusId,
          statusVersion: 1,
          stacks: 1,
          remainingOwnerTurnStarts: 2,
          sourceCombatantId: 'caster',
        }).description,
      ).toBe(combatStatusDetails(statusId).description)
    }
  })
  it('gives every pending family a simple distinct code separate from named statuses', () => {
    const ids = [...PHASE4_STATUSES.map((status) => status.id), ...pendingFamilies, 'barrier']
    const identities = ids.map(battleEffectIdentity)
    expect(new Set(identities.map((identity) => identity.identifier)).size).toBe(ids.length)
    for (const identity of identities) expect(identity.identifier).toMatch(/^[A-Z0-9]{3}$/)
    expect(battleEffectIdentity('summon').identifier).not.toBe(
      battleEffectIdentity('summoned').identifier,
    )
  })

  it.each(pendingFamilies)('uses canonical meaningful details for pending %s', (id) => {
    const identity = battleEffectIdentity(id)
    expect(identity.description).toBe(combatStatusDetails(id).description)
    expect(identity.description).not.toBe('An active combat effect.')
  })

  it.each([
    ['instant', 'One-time effect on activation'],
    ['until-spent', 'Until depleted'],
    ['until-removed', 'Until removed'],
  ] as const)(
    'describes %s pending lifetimes without inventing affected-turn expiry',
    (durationScope, duration) => {
      const effect: CombatStatusInstance = {
        statusId: durationScope === 'instant' ? 'mp-drain' : 'barrier',
        statusVersion: 1,
        stacks: 1,
        remainingOwnerTurnStarts: 1,
        sourceCombatantId: 'archer',
        timingState: 'pending',
        activationRound: 4,
        durationScope,
      }
      const details = describeBattleEffect(effect)
      expect(details.count).toBeNull()
      expect(details.duration).toBe(duration)
      expect(details.explanation).not.toContain('turn remaining')
    },
  )

  it.each(['pending', 'active'] as const)(
    'describes %s terrain with its actual round-boundary counter',
    (timingState) => {
      const effect: CombatStatusInstance = {
        statusId: 'create-terrain',
        statusVersion: 1,
        stacks: 1,
        remainingOwnerTurnStarts: 1,
        remainingRoundBoundaries: 2,
        sourceCombatantId: 'archer',
        durationScope: 'rounds',
        timingState,
        activationRound: 4,
      }
      const details = describeBattleEffect(effect)
      expect(details.count).toBe(2)
      expect(details.duration).toBe('2 round boundaries remaining')
      expect(details.counterLabel).toBe('2r')
      expect(details.explanation).not.toContain('affected-unit turn')
    },
  )

  it.each(['pending', 'active'] as const)(
    'describes %s battle-long copied access without a turn counter',
    (timingState) => {
      const effect: CombatStatusInstance = {
        statusId: 'copy',
        statusVersion: 1,
        stacks: 1,
        remainingOwnerTurnStarts: 1,
        sourceCombatantId: 'archer',
        durationScope: 'battle',
        timingState,
        activationRound: 4,
      }
      const details = describeBattleEffect(effect)
      expect(details.count).toBeNull()
      expect(details.duration).toBe('Until battle ends')
      expect(details.explanation).not.toContain('turn remaining')
      if (timingState === 'pending')
        expect(details.timing).toContain('Activates at the start of round 4')
      else expect(details.timing).toBe('Active')
    },
  )
})
