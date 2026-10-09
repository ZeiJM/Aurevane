'use client'

import { createContext, useContext, type ReactNode } from 'react'
import {
  defaultCombatEffectTimingPolicy,
  type CombatEffectTimingPolicy,
} from '@aurevane/game-core/combat/combat-effect-timing'

/** Null explicitly represents a historical battle with legacy instant timing. */
export type SkillEffectTimingPolicy = CombatEffectTimingPolicy | null
const TimingContext = createContext<SkillEffectTimingPolicy>(defaultCombatEffectTimingPolicy())
const GroundInteractionContext = createContext({
  legacyFrozenGround: false,
  legacyAirborne: false,
  legacyHealingDown: false,
})
export const AirborneAttackElevationContext = createContext(false)
const DotTriggerContext = createContext<1 | 2 | null>(2)

export function SkillEffectTimingProvider({
  policy,
  dotTriggerPolicyVersion = 2,
  frozenGroundPolicyVersion = 1,
  airbornePolicyVersion = 1,
  healingDownPolicyVersion = 1,
  children,
}: {
  policy: SkillEffectTimingPolicy
  dotTriggerPolicyVersion?: 1 | 2 | null
  frozenGroundPolicyVersion?: 1 | null
  airbornePolicyVersion?: 1 | null
  healingDownPolicyVersion?: 1 | null
  children: ReactNode
}) {
  return (
    <TimingContext.Provider value={policy}>
      <DotTriggerContext.Provider value={dotTriggerPolicyVersion}>
        <GroundInteractionContext.Provider
          value={{
            legacyFrozenGround: frozenGroundPolicyVersion !== 1,
            legacyAirborne: airbornePolicyVersion !== 1,
            legacyHealingDown: healingDownPolicyVersion !== 1,
          }}
        >
          {children}
        </GroundInteractionContext.Provider>
      </DotTriggerContext.Provider>
    </TimingContext.Provider>
  )
}

export function useSkillEffectTimingPolicy(): SkillEffectTimingPolicy {
  return useContext(TimingContext)
}
export function useSkillDotTriggerPolicyVersion(): 1 | 2 | null {
  return useContext(DotTriggerContext)
}

export function useSkillGroundInteractionRules() {
  return useContext(GroundInteractionContext)
}
export function useAirborneAttackElevation() {
  return useContext(AirborneAttackElevationContext)
}
