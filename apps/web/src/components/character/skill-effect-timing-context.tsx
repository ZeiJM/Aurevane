'use client'

import { createContext, useContext, type ReactNode } from 'react'
import {
  defaultCombatEffectTimingPolicy,
  type CombatEffectTimingPolicy,
} from '@aurevane/game-core/combat/combat-effect-timing'

/** Null explicitly represents a historical battle with legacy instant timing. */
export type SkillEffectTimingPolicy = CombatEffectTimingPolicy | null
const TimingContext = createContext<SkillEffectTimingPolicy>(defaultCombatEffectTimingPolicy())
const DotTriggerContext = createContext<1 | null>(1)

export function SkillEffectTimingProvider({
  policy,
  dotTriggerPolicyVersion = 1,
  children,
}: {
  policy: SkillEffectTimingPolicy
  dotTriggerPolicyVersion?: 1 | null
  children: ReactNode
}) {
  return (
    <TimingContext.Provider value={policy}>
      <DotTriggerContext.Provider value={dotTriggerPolicyVersion}>
        {children}
      </DotTriggerContext.Provider>
    </TimingContext.Provider>
  )
}

export function useSkillEffectTimingPolicy(): SkillEffectTimingPolicy {
  return useContext(TimingContext)
}
export function useSkillDotTriggerPolicyVersion(): 1 | null {
  return useContext(DotTriggerContext)
}
