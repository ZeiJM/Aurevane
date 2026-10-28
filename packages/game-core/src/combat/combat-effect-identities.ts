import type { CombatSummonEffect } from './summon-content'
import type { CombatEffectDefinition } from './actions'
import type { CombatTagPayload } from './combat-tag-registry'
import { PHASE4_STATUSES, combatStatusDetails } from './status-content'
import { isRetiredCombatStatusId } from './retired-combat-statuses'
import { BLINDSIDE_DEBUFF_STATUS_ID } from './combat-blindside'
import { combatEffectPresentationTags } from './gameplay-tags'

export const SUPPORTED_COMBAT_STATUS_IDS: readonly string[] = Object.freeze(
  [
    'guarded',
    'exposed',
    'lowered-guard',
    'covert',
    'revealed',
    ...PHASE4_STATUSES.map((status) => status.id),
  ].filter((id) => !isRetiredCombatStatusId(id) && id !== 'displaced'),
)
/** Presentation variants share the existing opcode and its authoritative validation. */
export interface AuthorableEffectTag {
  readonly id: string
  readonly label: string
  readonly opcode: CombatTagPayload['type']
  readonly unavailableReason?: string
  readonly statusId?: string
}
const variants: readonly AuthorableEffectTag[] = [
  { id: 'damage', label: 'Damage', opcode: 'damage' },
  { id: 'pierce', label: 'Pierce', opcode: 'pierce' },
  { id: 'vengeance', label: 'Vengeance', opcode: 'damage' },
  { id: 'hp-recovery', label: 'HP Recovery', opcode: 'percentage-recovery' },
  { id: 'mp-recovery', label: 'MP Recovery', opcode: 'percentage-recovery' },
  { id: 'healing', label: 'HP Recovery (fixed amount)', opcode: 'healing' },
  { id: 'mp-restore', label: 'MP Restore', opcode: 'resource-change' },
  { id: 'mp-drain', label: 'MP Drain', opcode: 'resource-change' },
  { id: 'barrier', label: 'Barrier', opcode: 'barrier-change' },
  { id: 'burn', label: 'Burn', opcode: 'burn', statusId: 'burn' },
  { id: 'poison', label: 'Poison', opcode: 'poison', statusId: 'poison' },
  { id: 'bleed', label: 'Bleed', opcode: 'bleed', statusId: 'bleed' },
  { id: 'copy-buffs', label: 'Copy Buffs', opcode: 'copy-statuses' },
  { id: 'copy-debuffs', label: 'Copy Debuffs', opcode: 'copy-statuses' },
  { id: 'cleanse', label: 'Cleanse', opcode: 'remove-status' },
  { id: 'dispel', label: 'Dispel', opcode: 'remove-status' },
  { id: 'conditional-cleanse', label: 'Conditional Cleanse', opcode: 'remove-status' },
  { id: 'cleanse-chilled', label: 'Cleanse Chilled', opcode: 'remove-status' },
  { id: 'reveal', label: 'Reveal', opcode: 'sensory' },
  { id: 'rewind', label: 'Rewind', opcode: 'return-to-turn-start' },
  { id: 'freeze-ground', label: 'Freeze Ground', opcode: 'create-terrain' },
  { id: 'push', label: 'Push', opcode: 'displace' },
  { id: 'pull', label: 'Pull', opcode: 'displace' },
  { id: 'move', label: 'Move', opcode: 'move' },
  { id: 'damage-bonus', label: 'Damage Bonus', opcode: 'damage-bonus' },
  { id: 'summon', label: 'Summon', opcode: 'summon' },
]
export const AUTHORABLE_EFFECT_TAGS: readonly AuthorableEffectTag[] = Object.freeze([
  ...variants,
  ...SUPPORTED_COMBAT_STATUS_IDS.filter(
    (statusId) => !['burn', 'poison', 'bleed'].includes(statusId),
  )
    .map((statusId) => ({
      id: `status:${statusId}`,
      opcode: 'apply-status' as const,
      statusId,
      ...(statusId === 'revealed'
        ? { unavailableReason: 'Revealed is applied by Reveal. Choose Reveal to set its duration.' }
        : {}),
      label: `${combatStatusDetails(statusId).name}${statusId === BLINDSIDE_DEBUFF_STATUS_ID ? ' (debuff)' : ''}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)),
])
export function combatEffectIdentity(
  payload: CombatTagPayload | CombatEffectDefinition | CombatSummonEffect,
): AuthorableEffectTag {
  let id: string = payload.type
  switch (payload.type) {
    case 'damage':
      id = payload.vengeance
        ? 'vengeance'
        : ('shattersBarrier' in payload && payload.shattersBarrier === true) ||
            ('piercing' in payload && payload.piercing === true)
          ? 'pierce'
          : 'damage'
      break
    case 'apply-status':
      id = ['burn', 'poison', 'bleed'].includes(payload.statusId)
        ? payload.statusId
        : `status:${payload.statusId}`
      break
    case 'percentage-recovery':
      id = payload.resource === 'mp' ? 'mp-recovery' : 'hp-recovery'
      break
    case 'resource-change':
      id = payload.delta < 0 ? 'mp-drain' : 'mp-restore'
      break
    case 'barrier-change':
      id = 'barrier'
      break
    case 'copy-statuses':
      id = payload.mode === 'curse' ? 'copy-debuffs' : 'copy-buffs'
      break
    case 'remove-status':
      id =
        (
          {
            'Cleanse Chilled': 'cleanse-chilled',
            Dispel: 'dispel',
            Cleanse: 'cleanse',
            'Conditional Cleanse': 'conditional-cleanse',
          } as Record<string, string>
        )[combatEffectPresentationTags(payload)[0]!] ?? 'conditional-cleanse'
      break
    case 'sensory':
      id = 'reveal'
      break
    case 'return-to-turn-start':
      id = 'rewind'
      break
    case 'create-terrain':
      id = 'freeze-ground'
      break
    case 'displace':
      id = payload.direction ?? 'push'
      break
  }
  return (
    AUTHORABLE_EFFECT_TAGS.find((tag) => tag.id === id) ?? {
      id,
      label: payload.type,
      opcode: payload.type,
    }
  )
}

/** Stable content keys use status identities directly; picker-only status: prefixes never persist. */
export function combatEffectPresentationId(
  payload: CombatTagPayload | CombatEffectDefinition | CombatSummonEffect,
): string {
  return combatEffectIdentity(payload).id.replace(/^status:/u, '')
}
export const COMBAT_PRESENTATION_TAG_IDS: readonly string[] = Object.freeze([
  ...new Set(
    AUTHORABLE_EFFECT_TAGS.flatMap((tag) => [tag.id.replace(/^status:/u, ''), tag.opcode]),
  ),
])
export function isCombatPresentationTagId(id: unknown): id is string {
  return typeof id === 'string' && COMBAT_PRESENTATION_TAG_IDS.includes(id)
}
