import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import type { BattlePreviewView } from '@/server/battle/battle-preview-service'
import type { BattlePreviewSkill } from './battle-preview-selection'
import { battleManualModifierReferences } from './battle-modifier-draft'

export interface BattleProposedCosts {
  actorId: string
  ap: number
  hp: number
  mp: number
}

const spend = (value: number | undefined) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0

/** Presentation only: exact current quotes outrank an unambiguous captured selection. */
export function battleProposedCosts({
  enabled,
  battleSessionId,
  battleVersion,
  actorId,
  descriptor,
  allowCapturedCosts,
  pendingIntent,
  preview,
}: {
  enabled: boolean
  battleSessionId: string
  battleVersion: number
  actorId: string | null
  descriptor: BattlePreviewSkill
  allowCapturedCosts: boolean
  pendingIntent: BattleIntent | null
  preview: (BattlePreviewView & { intent: BattleIntent }) | null
}): BattleProposedCosts | null {
  if (
    !enabled ||
    !actorId ||
    descriptor.unavailable ||
    (descriptor.controlled?.canPrime && descriptor.controlled.kind !== 'reversal') ||
    (descriptor.controlled?.kind === 'reversal' && descriptor.controlled.phase === 'primed')
  )
    return null
  if (preview) {
    if (
      preview.battleSessionId !== battleSessionId ||
      preview.battleVersion !== battleVersion ||
      JSON.stringify(preview.intent) !== JSON.stringify(pendingIntent)
    )
      return null
    const quote = preview.preview
    if (quote.kind === 'move' && preview.intent.kind === 'move')
      return { actorId, ap: spend(quote.actionEconomyCost), hp: 0, mp: 0 }
    if (
      quote.kind !== 'action' ||
      preview.intent.kind !== 'action' ||
      quote.actorId !== actorId ||
      quote.actionId !== descriptor.id ||
      preview.intent.actionId !== descriptor.id ||
      preview.intent.behaviorId !== descriptor.behaviorId ||
      JSON.stringify(preview.intent.movementPath) !== JSON.stringify(descriptor.movementPath) ||
      JSON.stringify(battleManualModifierReferences(preview.intent.manualModifiers ?? [])) !==
        JSON.stringify(battleManualModifierReferences(descriptor.manualModifiers ?? []))
    )
      return null
    const amount = (resource: 'ap' | 'hp' | 'mp', legacy: number | undefined) =>
      spend(
        quote.commandCosts
          ? quote.commandCosts.find((row) => row.resource === resource)?.amount
          : legacy,
      )
    return {
      actorId,
      ap: amount('ap', quote.actionEconomyCost),
      hp: amount('hp', quote.hpCost),
      mp: amount('mp', quote.mpCost),
    }
  }
  if (!allowCapturedCosts || !descriptor.costs || descriptor.manualModifiers?.length) return null
  const amount = (resource: 'ap' | 'hp' | 'mp') =>
    spend(descriptor.costs!.find((row) => row.resource === resource)?.amount)
  return { actorId, ap: amount('ap'), hp: amount('hp'), mp: amount('mp') }
}

/** A spending layer covers actual available resource, never Barrier or negative space. */
export function proposedResourceSegment(current: number, maximum: number, cost: number) {
  if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) return null
  const available = Math.max(0, Math.min(current, maximum))
  const amount = Math.min(available, spend(cost))
  return amount > 0
    ? { left: ((available - amount) / maximum) * 100, width: (amount / maximum) * 100 }
    : null
}
