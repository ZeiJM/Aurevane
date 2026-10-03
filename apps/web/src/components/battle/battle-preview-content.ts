import { skillInformationRows } from '../character/skill-information-contract'
import {
  combatInteractionDescription,
  gameplayStatusName,
  statusWasProjected,
} from '../../lib/battle/combat-interaction-presentation'
import type { BattlePreviewView } from '@/server/battle/battle-preview-service'
import type { BattleSkillForecastPresentation } from './battle-runtime'
import { skillParameterRows } from '../character/skill-detail-presentation'
import type { ImageAssetId } from '@/media/registry'
import { battleTerrainName, BATTLE_TERRAIN_KEY_DETAILS } from './battle-terrain-key-presentation'
type IntentPreview = BattlePreviewView['preview']
type ActionPreview = Extract<IntentPreview, { kind: 'action' }>
type ProjectedEffect = ActionPreview['projectedEffects'][number]
export function battleGroundTargetPresentation(
  tile: { terrainId: string; elevation: number },
  overlay?: 'frozen' | 'steam' | null,
): { assetId: ImageAssetId; label: string; glyph: string } {
  const terrain = battleTerrainName(tile.terrainId)
  const assetId =
    terrain === 'Difficult terrain'
      ? 'terrain.battle.rough-moss.v01'
      : tile.elevation > 0
        ? 'terrain.battle.raised-ledge.v02'
        : 'terrain.battle.open-stone.v01'
  return {
    assetId,
    label: [
      battleTerrainName(tile.terrainId, tile.elevation),
      overlay ? BATTLE_TERRAIN_KEY_DETAILS[overlay].name : null,
    ]
      .filter(Boolean)
      .join(' · '),
    glyph: overlay
      ? BATTLE_TERRAIN_KEY_DETAILS[overlay].glyph
      : tile.terrainId === 'blocked'
        ? '×'
        : tile.elevation > 0
          ? '▲'
          : '',
  }
}
export interface PreviewChip {
  label: string
  tone: 'chance' | 'damage' | 'heal' | 'effect' | 'cost' | 'blocked'
}

export function battleSkillParameterRows(
  skill: BattleSkillForecastPresentation,
): readonly (readonly [string, string])[] {
  if (skill.definition) {
    return skillParameterRows(skill.definition, skill)
  }
  // Legacy presentations may not retain an immutable definition. Never infer missing
  // mechanics from a current catalogue or silently describe unknown fields as inapplicable.
  return skillInformationRows({
    'Skill Type': skill.tags.includes('attack') ? 'Attack' : 'Unavailable',
    Cost: `${skill.apCost} AP${skill.mpCost > 0 ? ` / ${skill.mpCost} MP` : ''}`,
    Cooldown:
      skill.cooldownOwnerTurns === undefined
        ? 'Unavailable'
        : skill.cooldownOwnerTurns === null
          ? 'None'
          : `${skill.cooldownOwnerTurns} ${skill.cooldownOwnerTurns === 1 ? 'turn' : 'turns'}`,
    Requirements: skill.requirementDescriptions.join(', ') || 'None',
    Effects: skill.effectDescriptions.join(', ') || 'Unavailable',
    Range: skill.targetKind === 'self' ? 'N/A' : String(skill.maximumRange),
    Target:
      skill.targetKind === 'self'
        ? 'Self'
        : skill.targetKind === 'ground-tile'
          ? 'Ground'
          : skill.targetKind === 'empty-tile'
            ? 'Empty Ground'
            : skill.targetTeamPolicy === 'any'
              ? 'Any Unit'
              : skill.targetTeamPolicy.replace(/^./, (letter) => letter.toUpperCase()),
    'Target Method': 'Unavailable',
    'Target Elevation': skill.targetKind === 'self' ? 'N/A' : 'Unavailable',
    'Line of Sight': skill.targetKind === 'self' ? 'N/A' : 'Unavailable',
  })
}

export function skillPreviewChips(skill: BattleSkillForecastPresentation): PreviewChip[] {
  return battleSkillParameterRows(skill).map(([label, value]) => ({
    label: `${label}: ${value}`,
    tone: label === 'Cost' ? 'cost' : 'effect',
  }))
}

function humanizeStatus(value: string): string {
  const id = value.split(':')[0] ?? value
  return id
    .replace(/^status\./, '')
    .replaceAll('.', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function numericEffectDelta(effect: ProjectedEffect): number | null {
  if (typeof effect.before !== 'number' || typeof effect.after !== 'number') return null
  return effect.after - effect.before
}

function parseProjectedInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function countLabel(value: number, singular: string): string {
  return `${value} ${singular}${value === 1 ? '' : 's'}`
}

function countTransition(before: number | null, after: number, singular: string): string {
  if (before === null || before === after) return countLabel(after, singular)
  return `${before}→${after} ${singular}${after === 1 ? '' : 's'}`
}

function parseOrdinaryCopyState(value: string): {
  statusId: string
  stacks: number
  duration: number
} | null {
  const parts = value.split(':')
  if (parts.length !== 3) return null
  const [encodedStatusId, encodedStacks, encodedDuration] = parts
  if (!encodedStatusId || !encodedStacks || !encodedDuration) return null
  if (['poison', 'burn', 'bleed'].includes(encodedStatusId)) return null

  const stacks = parseProjectedInteger(encodedStacks)
  const duration = parseProjectedInteger(encodedDuration)
  if (stacks === null || duration === null) return null

  return {
    statusId: encodedStatusId.replace(/^status\./, ''),
    stacks,
    duration,
  }
}

function typedCopyParts(value: string, type: 'poison' | 'burn'): number | null {
  const parts = value.split(':')
  if (parts.length !== 2 || parts[0] !== type || !parts[1]) return null
  return parseProjectedInteger(parts[1])
}

function parseBleedCopyState(value: string): { damage: number; ticks: number } | null {
  const parts = value.split(':')
  if (parts.length !== 3 || parts[0] !== 'bleed' || !parts[1] || !parts[2]) return null
  const damage = parseProjectedInteger(parts[1])
  const ticks = parseProjectedInteger(parts[2])
  return damage === null || ticks === null ? null : { damage, ticks }
}

function bleedStateLabel(state: { damage: number; ticks: number }): string {
  return `${state.damage} dmg × ${state.ticks} tick${state.ticks === 1 ? '' : 's'}`
}

function copyStatusPreviewChip(effect: ProjectedEffect): PreviewChip | null {
  if (
    effect.effectType !== 'copy-statuses' ||
    typeof effect.before !== 'string' ||
    typeof effect.after !== 'string'
  ) {
    return null
  }

  const ordinaryAfter = parseOrdinaryCopyState(effect.after)
  if (ordinaryAfter) {
    const ordinaryBefore = effect.before === 'none' ? null : parseOrdinaryCopyState(effect.before)
    const matchingBefore =
      ordinaryBefore?.statusId === ordinaryAfter.statusId ? ordinaryBefore : null
    return {
      label: `Copied ${gameplayStatusName(ordinaryAfter.statusId)} · ${countTransition(matchingBefore?.stacks ?? null, ordinaryAfter.stacks, 'stack')} · ${countTransition(matchingBefore?.duration ?? null, ordinaryAfter.duration, 'turn')}`,
      tone: 'effect',
    }
  }

  const poisonAfter = typedCopyParts(effect.after, 'poison')
  if (poisonAfter !== null) {
    const poisonBefore = effect.before === 'none' ? null : typedCopyParts(effect.before, 'poison')
    return {
      label: `Copied ${gameplayStatusName('poison')} · movement progress ${poisonBefore === null || poisonBefore === poisonAfter ? poisonAfter : `${poisonBefore}→${poisonAfter}`}`,
      tone: 'effect',
    }
  }

  const burnAfter = typedCopyParts(effect.after, 'burn')
  if (burnAfter !== null) {
    const burnBefore = effect.before === 'none' ? null : typedCopyParts(effect.before, 'burn')
    return {
      label: `Copied ${gameplayStatusName('burn')} · stage ${burnBefore === null || burnBefore === burnAfter ? burnAfter : `${burnBefore}→${burnAfter}`}`,
      tone: 'effect',
    }
  }

  const bleedAfter = parseBleedCopyState(effect.after)
  if (bleedAfter) {
    const bleedBefore = effect.before === 'none' ? null : parseBleedCopyState(effect.before)
    const afterLabel = bleedStateLabel(bleedAfter)
    const beforeLabel = bleedBefore ? bleedStateLabel(bleedBefore) : null
    return {
      label: `Copied ${gameplayStatusName('bleed')} · ${beforeLabel === null || beforeLabel === afterLabel ? afterLabel : `${beforeLabel} → ${afterLabel}`}`,
      tone: 'effect',
    }
  }

  return null
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

  for (const effect of preview.projectedEffects) {
    const copyChip = copyStatusPreviewChip(effect)
    if (copyChip) chips.push(copyChip)
  }

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
