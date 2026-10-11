import { describe, expect, it } from 'vitest'
import type { CombatStatusInstance } from '@aurevane/game-core/combat/actions'
import { combatStatusDetails, PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import { battleEffectIdentity, describeBattleEffect } from './battle-effect-identity'

it('describes both Airborne elevations only for the recorded current Jump policy', () => {
  const effect = {
    statusId: 'airborne',
    statusVersion: 1,
    stacks: 1,
    remainingOwnerTurnStarts: 2,
    sourceCombatantId: 'actor',
    airbornePolicyVersion: 1 as const,
    airborneJumpPolicyVersion: 1 as const,
  }
  expect(describeBattleEffect(effect).description).toContain('Your Jump is 3')
  expect(describeBattleEffect(effect).description).toContain('Target Elevation 3')
  expect(
    describeBattleEffect({ ...effect, airborneJumpPolicyVersion: undefined }).description,
  ).not.toContain('Your Jump is 3')
  expect(
    describeBattleEffect({
      ...effect,
      airbornePolicyVersion: undefined,
      airborneJumpPolicyVersion: undefined,
    }).description,
  ).not.toContain('Target Elevation 3')
})

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
  'damage',
  'healing',
]

it('reads each captured Blindside profile without replacing earlier applications', () => {
  const effect: CombatStatusInstance = {
    statusId: 'blindside',
    statusVersion: 1,
    stacks: 2,
    remainingOwnerTurnStarts: 1,
    remainingOwnerTurnEnds: 1,
    sourceCombatantId: 'actor',
    blindsideModifiersBasisPoints: { side: 12500, rear: 18000 },
    applicationModifiers: [
      {
        stacks: 1,
        sourceCombatantId: 'actor',
        blindsideModifiersBasisPoints: { side: 17550, rear: 25000 },
      },
      {
        stacks: 1,
        sourceCombatantId: 'actor',
        blindsideModifiersBasisPoints: { side: 12500, rear: 18000 },
      },
    ],
  }
  const description = describeBattleEffect(effect).description
  expect(description).toContain('175.5% side, 250% rear')
  expect(description).toContain('125% side, 180% rear')
})

describe('battle effect identity', () => {
  it.each([
    ['guarded', 'Reduces incoming damage by 11%'],
    ['exposed', 'Take 11% more damage'],
    ['inspired', 'Deal 11% more damage'],
    ['hexed', 'Receive 11% less healing'],
    ['mark', '+11 percentage points Accuracy'],
    ['blind', 'Lose 11 percentage points Accuracy'],
    ['warded', 'Take 11% less damage from opponents affected by Burn'],
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
    for (const statusId of ['guarded', 'warded', 'mark', 'inspired', 'fortified']) {
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
})

it.each([1, 4])(
  'describes %i captured recovery applications without claiming a one-time schedule',
  (applications) => {
    const result = describeBattleEffect({
      statusId: 'healing',
      statusVersion: 1,
      stacks: 1,
      sourceCombatantId: 'actor',
      remainingOwnerTurnStarts: applications,
      timingState: 'pending',
      activationRound: 4,
      durationScope: 'instant',
      recoveryApplications: applications,
    })
    expect(result.count).toBe(applications)
    expect(result.counterLabel).toBe(`${applications}×`)
    expect(result.duration).toContain(`${applications} application`)
    expect(result.duration).toContain('activation')
  },
)

it.each(['active', 'pending'] as const)(
  'Healing Down %s readers match current and historical recovery rules',
  (timingState) => {
    const effect = {
      statusId: 'hexed',
      statusVersion: 1,
      stacks: 1,
      sourceCombatantId: 'caster',
      remainingOwnerTurnStarts: 2,
      timingState,
    }
    expect(describeBattleEffect(effect).description).toBe('Receive 25% less healing.')
    expect(describeBattleEffect({ ...effect, healingDownPolicyVersion: 1 }).description).toBe(
      'Receive 25% less HP and MP recovery.',
    )
    expect(
      describeBattleEffect({ ...effect, healingDownPolicyVersion: 1, potencyBasisPoints: 1600 })
        .description,
    ).toBe('Receive 16% less HP and MP recovery.')
  },
)

it('reads active and pending Suppress with exact percentage and lifetime', () => {
  const effect = {
    statusId: 'suppress',
    statusVersion: 1,
    stacks: 1,
    potencyBasisPoints: 2534,
    remainingOwnerTurnStarts: 2,
    remainingOwnerTurnEnds: 2,
    sourceCombatantId: 'actor',
  }
  expect(describeBattleEffect(effect)).toMatchObject({
    label: 'Suppress [25.34%]',
    identifier: 'SUP',
    kind: 'Debuff',
  })
  expect(describeBattleEffect(effect).explanation).toContain('25.34%')
  expect(
    describeBattleEffect({ ...effect, timingState: 'pending', activationRound: 3 }).explanation,
  ).toContain('round 3')
})

it('describes current elemental rails using their saved policy and strongest captured bonus', () => {
  const current = describeBattleEffect({
    statusId: 'wet',
    statusVersion: 1,
    stacks: 3,
    remainingOwnerTurnStarts: 2,
    sourceCombatantId: 'caster',
    elementalDamagePolicyVersion: 2,
    applicationModifiers: [
      { stacks: 1, sourceCombatantId: 'caster', potencyBasisPoints: 3500 },
      { stacks: 2, sourceCombatantId: 'caster', potencyBasisPoints: 4250 },
    ],
  })
  expect(current.description).toContain('10%, capped at 100%')
  expect(current.description).toContain('42.5% Storm damage')
  expect(current.description).not.toContain('Fire removes')
  const old = describeBattleEffect({
    statusId: 'wet',
    statusVersion: 1,
    stacks: 3,
    remainingOwnerTurnStarts: 2,
    sourceCombatantId: 'caster',
    elementalDamagePolicyVersion: 1,
    potencyBasisPoints: 3500,
  })
  expect(old.description).toContain('10% once')
  expect(old.description).toContain('Fire removes Drenched')
})
