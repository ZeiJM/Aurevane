import type { CombatEffectDefinition } from './actions'
import { combatEffectIdentity } from './combat-effect-identities'
import { combatStatusDetails } from './status-content'

const groundStatusIds = [
  'guarded',
  'exposed',
  'lowered-guard',
  'wet',
  'frozen',
  'conductive',
  'inspired',
  'hexed',
  'suppress',
  'invisible',
  'airborne',
  'haste',
  'slow',
  'root',
  'reckless',
  'fortified',
  'challenged',
  'mark',
  'warded',
  'blind',
  'blindside',
  'blindside-vulnerability',
  'covert',
  'revealed',
  'counter',
  'summoned',
  'burn',
  'poison',
  'bleed',
] as const
const groundOperationIds = [
  'damage',
  'pierce',
  'hp-recovery',
  'mp-recovery',
  'mp-drain',
  'barrier',
  'removal:cleanse',
  'removal:dispel',
  'removal:conditional-cleanse',
  'reveal',
  'push',
  'pull',
] as const
export type GroundEffectVisualId =
  (typeof groundOperationIds)[number] | `status:${(typeof groundStatusIds)[number]}`
export interface GroundEffectVisual {
  readonly id: GroundEffectVisualId
  readonly label: string
  readonly iconId: string
  readonly tone: 'benefit' | 'harm' | 'neutral'
  readonly material: 'embers' | 'frost' | 'arcane-pulse'
}
const operationLabels: Record<(typeof groundOperationIds)[number], string> = {
  damage: 'Damage',
  pierce: 'Pierce',
  'hp-recovery': 'HP Recovery',
  'mp-recovery': 'MP Recovery',
  'mp-drain': 'MP Drain',
  barrier: 'Barrier',
  'removal:cleanse': 'Cleanse',
  'removal:dispel': 'Dispel',
  'removal:conditional-cleanse': 'Conditional Cleanse',
  reveal: 'Reveal',
  push: 'Push',
  pull: 'Pull',
}
export const COMBAT_GROUND_EFFECT_VISUALS: readonly GroundEffectVisual[] = [
  ...groundOperationIds.map((id): GroundEffectVisual => ({
    id,
    label: `${operationLabels[id]} Ground`,
    iconId: id.replace('removal:', ''),
    tone: [
      'hp-recovery',
      'mp-recovery',
      'barrier',
      'removal:cleanse',
      'removal:conditional-cleanse',
    ].includes(id)
      ? 'benefit'
      : 'harm',
    material: 'arcane-pulse',
  })),
  ...groundStatusIds.map((id): GroundEffectVisual => {
    const details = combatStatusDetails(id)
    return {
      id: `status:${id}`,
      label: `${details.name} Ground`,
      iconId: id,
      tone: details.kind === 'Buff' ? 'benefit' : details.kind === 'Debuff' ? 'harm' : 'neutral',
      material: id === 'frozen' ? 'frost' : id === 'burn' ? 'embers' : 'arcane-pulse',
    }
  }),
]
export function groundEffectVisual(id: string): GroundEffectVisual | undefined {
  return COMBAT_GROUND_EFFECT_VISUALS.find((visual) => visual.id === id)
}
/** Captured payloads are consumed here, but only finite registered visual identities leave. */
export function combatGroundEffectVisualIds(
  effects: readonly CombatEffectDefinition[],
): readonly GroundEffectVisualId[] {
  return [
    ...new Set(
      effects.flatMap((effect) => {
        if (effect.recipient === 'actor') return []
        const identity =
          effect.type === 'damage'
            ? effect.piercing || effect.shattersBarrier
              ? 'pierce'
              : 'damage'
            : effect.type === 'apply-status'
              ? `status:${effect.statusId}`
              : ['burn', 'poison', 'bleed'].includes(effect.type)
                ? `status:${effect.type}`
                : effect.type === 'healing'
                  ? 'hp-recovery'
                  : effect.type === 'resource-change' && effect.delta >= 0
                    ? 'mp-recovery'
                    : effect.type === 'remove-status'
                      ? `removal:${combatEffectIdentity(effect).id === 'cleanse-chilled' ? 'conditional-cleanse' : combatEffectIdentity(effect).id}`
                      : combatEffectIdentity(effect).id
        const visual = groundEffectVisual(identity)
        return visual ? [visual.id] : []
      }),
    ),
  ]
}

/** Registered, data-only presets. Authored content cannot supply executable effects. */
export const COMBAT_GROUND_VISUAL_PRESETS = [
  { id: 'embers', label: 'Embers', description: 'Warm embers and rising sparks.' },
  { id: 'frost', label: 'Frost', description: 'A cold shimmer and drifting frost.' },
  { id: 'arcane-pulse', label: 'Arcane pulse', description: 'A slow pulse of arcane light.' },
] as const
export type GroundVisualPresetId = (typeof COMBAT_GROUND_VISUAL_PRESETS)[number]['id']
export function isGroundVisualPresetId(value: unknown): value is GroundVisualPresetId {
  return COMBAT_GROUND_VISUAL_PRESETS.some((preset) => preset.id === value)
}

/** Safe render data: deliberately excludes caster, action identity and execution payload. */
export interface PublicCombatGroundArea {
  effectVisualIds?: readonly GroundEffectVisualId[]
  steamTiles?: readonly { x: number; y: number }[]
  id: string
  tiles: readonly { x: number; y: number }[]
  activationRound: number
  expiresAtRound: number
  visualPresetId: GroundVisualPresetId
}
export function projectPublicCombatGroundAreas(
  areas: readonly (Omit<PublicCombatGroundArea, 'effectVisualIds'> & {
    contactPolicyVersion?: 1
    entryEffects?: readonly CombatEffectDefinition[]
  })[],
  round: number,
  lifecycle: string,
): readonly PublicCombatGroundArea[] {
  if (lifecycle !== 'active') return []
  return areas
    .filter((area) => area.expiresAtRound > round)
    .map((area) => {
      const effectVisualIds =
        area.contactPolicyVersion === 1 && area.entryEffects
          ? combatGroundEffectVisualIds(area.entryEffects)
          : undefined
      return {
        id: area.id,
        ...(effectVisualIds?.length ? { effectVisualIds } : {}),
        ...(area.steamTiles?.length
          ? { steamTiles: area.steamTiles.map((tile) => ({ x: tile.x, y: tile.y })) }
          : {}),
        tiles: area.tiles.map((tile) => ({ x: tile.x, y: tile.y })),
        activationRound: area.activationRound,
        expiresAtRound: area.expiresAtRound,
        visualPresetId: area.visualPresetId,
      }
    })
}

export function combatGroundAreaDescription(
  area: {
    durationRounds: number
    timing?: 'instant' | 'next-round' | 'delayed'
    contactPolicyVersion?: 1
  },
  policyTiming: 'instant' | 'next-round' | 'delayed' = 'next-round',
  entryEffectsMarked = false,
): string {
  const timing = area.timing ?? policyTiming
  if (area.contactPolicyVersion === 1)
    return `Ground: stays on the affected tiles for ${area.durationRounds} ${area.durationRounds === 1 ? 'round' : 'rounds'}, ${timing === 'instant' ? 'starting immediately' : timing === 'delayed' ? 'starting two rounds after cast' : 'starting next round'}. Active fields apply immediately to eligible occupants and contacting units, once per logical effect type during each affected character’s own-turn cycle across overlapping fields.`
  return `Ground: stays on the affected tiles for ${area.durationRounds} ${area.durationRounds === 1 ? 'round' : 'rounds'}, ${timing === 'instant' ? 'starting immediately' : timing === 'delayed' ? 'starting two rounds after cast' : 'starting next round'}. The cast affects eligible units there; entering the active area applies ${entryEffectsMarked ? 'only the effects marked for entry' : 'its unit effects'} once per character’s turn. Each cast has its own allowance.`
}
