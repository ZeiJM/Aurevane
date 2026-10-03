'use client'

import { createContext, useContext, type ReactNode } from 'react'
import {
  defaultCombatEffectTimingPolicy,
  type CombatEffectTimingPolicy,
} from '@aurevane/game-core/combat/combat-effect-timing'

/** Null explicitly represents a historical battle with legacy instant timing. */
export type SkillEffectTimingPolicy = CombatEffectTimingPolicy | null
const CopyPolicyContext = createContext<number | null>(1)
const TimingContext = createContext<SkillEffectTimingPolicy>(defaultCombatEffectTimingPolicy())

export function SkillEffectTimingProvider({
  policy,
  children,
  copyPolicyVersion = 1,
}: {
  policy: SkillEffectTimingPolicy
  children: ReactNode
  copyPolicyVersion?: number | null
}) {
  return (
    <TimingContext.Provider value={policy}>
      <CopyPolicyContext.Provider value={copyPolicyVersion}>{children}</CopyPolicyContext.Provider>
    </TimingContext.Provider>
  )
}

export function useSkillEffectTimingPolicy(): SkillEffectTimingPolicy {
  return useContext(TimingContext)
}

export function useSkillCopyPolicyVersion(): number | null {
  return useContext(CopyPolicyContext)
}
