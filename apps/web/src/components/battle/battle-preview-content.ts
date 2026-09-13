import {
  combatInteractionDescription,
  gameplayStatusName,
  statusWasProjected,
} from '../../lib/battle/combat-interaction-presentation'
import type { BattlePreviewView } from '@/server/battle/battle-preview-service'
type IntentPreview = BattlePreviewView['preview']
type ActionPreview = Extract<IntentPreview, { kind: 'action' }>
export interface PreviewChip {
  label: string
  tone: 'chance' | 'damage' | 'heal' | 'effect' | 'cost' | 'blocked'
}

function humanizeStatus(value: string): string {
  const id = value.split(':')[0] ?? value
  return id
    .replace(/^status\./, '')
    .replaceAll('.', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function numericEffectDelta(effect: ActionPreview['projectedEffects'][number]): number | null {
  if (typeof effect.before !== 'number' || typeof effect.after !== 'number') return null
  return effect.after - effect.before
}

function actionPreviewChips(preview: ActionPreview): PreviewChip[] {
  if (!preview.legal) {
    return [{ label: 'Blocked', tone: 'blocked' }]
  }

  const chips: PreviewChip[] = [
    { label: `${preview.actionEconomyCost} AP`, tone: 'cost' },
    { label: `${preview.actionEconomyAfter} AP left`, tone: 'effect' },
  ]
  if (preview.mpCost > 0) chips.push({ label: `${preview.mpCost} MP`, tone: 'cost' })
  chips.push({
    label:
      preview.hitChanceBasisPoints === null
        ? 'Success 100%'
        : `Hit ${Math.round(preview.hitChanceBasisPoints / 100)}%`,
    tone: 'chance',
  })

  if (preview.mitigatedBaseDamage !== null) {
    chips.push({ label: `On hit ${preview.mitigatedBaseDamage} dmg`, tone: 'damage' })
  } else {
    const projectedDamage = preview.projectedEffects
      .filter((effect) => effect.effectType === 'damage')
      .reduce((total, effect) => {
        const delta = numericEffectDelta(effect)
        return total + (delta === null ? 0 : Math.max(0, -delta))
      }, 0)
    if (projectedDamage > 0) {
      chips.push({ label: `${projectedDamage} dmg`, tone: 'damage' })
    }
  }

  const projectedHealing = preview.projectedEffects
    .filter((effect) => effect.effectType === 'healing')
    .reduce((total, effect) => {
      const delta = numericEffectDelta(effect)
      return total + (delta === null ? 0 : Math.max(0, delta))
    }, 0)
  if (projectedHealing > 0) {
    chips.push({ label: `Heal +${projectedHealing}`, tone: 'heal' })
  }

  const resourceDelta = preview.projectedEffects
    .filter((effect) => effect.effectType === 'resource-change')
    .reduce((total, effect) => total + (numericEffectDelta(effect) ?? 0), 0)
  if (resourceDelta !== 0) {
    chips.push({
      label: `Resource ${resourceDelta > 0 ? '+' : ''}${resourceDelta}`,
      tone: resourceDelta > 0 ? 'heal' : 'cost',
    })
  }

  for (const effect of preview.projectedEffects.filter(
    (effect) => effect.effectType === 'return-to-turn-start',
  )) {
    chips.push({ label: `Return to ${effect.after}`, tone: 'effect' })
  }

  for (const status of preview.projectedStatuses) {
    if (!statusWasProjected(status.statusId, preview.projectedEvents)) continue
    chips.push({ label: gameplayStatusName(status.statusId), tone: 'effect' })
    if (
      status.damageTakenMultiplierBasisPoints !== null &&
      status.damageTakenMultiplierBasisPoints < 10_000
    ) {
      const reduction = Math.round((10_000 - status.damageTakenMultiplierBasisPoints) / 100)
      chips.push({ label: `-${reduction}% damage`, tone: 'effect' })
    }
    if (['hastened', 'delayed', 'borrowed-hour'].includes(status.statusId)) {
      chips.push({ label: 'Next round only', tone: 'effect' })
    } else if (status.durationOwnerTurnStarts !== null) {
      chips.push({
        label: `${status.durationOwnerTurnStarts} turn${status.durationOwnerTurnStarts === 1 ? '' : 's'}`,
        tone: 'effect',
      })
    }
  }

  if (preview.projectedStatuses.length === 0) {
    const statuses = new Set(
      preview.projectedEffects
        .filter(
          (effect) => effect.effectType === 'apply-status' && typeof effect.after === 'string',
        )
        .map((effect) => gameplayStatusName(String(effect.after))),
    )
    for (const status of statuses) {
      chips.push({ label: status, tone: 'effect' })
    }
  }

  for (const event of preview.projectedEvents ?? []) {
    const label = combatInteractionDescription(event)
    if (label && !chips.some((chip) => chip.label === 'Terrain & effect details available'))
      chips.push({ label: 'Terrain & effect details available', tone: 'effect' })
  }

  if (preview.affectedCombatantIds.length > 1) {
    chips.push({ label: `${preview.affectedCombatantIds.length} targets`, tone: 'effect' })
  }

  return chips
}

export function previewChips(preview: IntentPreview): PreviewChip[] {
  if (!preview.legal) return [{ label: 'Blocked', tone: 'blocked' }]

  if (preview.kind === 'move') {
    return [
      { label: `${preview.actionEconomyCost} AP`, tone: 'cost' },
      { label: `${preview.actionEconomyAfter} AP left`, tone: 'effect' },
      {
        label: `${Math.max(0, preview.path.length - 1)} tile${preview.path.length === 2 ? '' : 's'}`,
        tone: 'effect',
      },
    ]
  }

  if (preview.kind === 'action') return actionPreviewChips(preview)

  if (preview.kind === 'face') {
    return [
      { label: 'Success 100%', tone: 'chance' },
      { label: `Face ${humanizeStatus(preview.facing)}`, tone: 'effect' },
      { label: 'Ends turn', tone: 'cost' },
    ]
  }

  return [{ label: 'Choose facing', tone: 'effect' }]
}
