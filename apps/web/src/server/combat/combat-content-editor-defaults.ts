import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { currentEssenceDefinitions } from '@aurevane/game-core/combat/essence'
import { currentResonanceDefinitions } from '@aurevane/game-core/combat/resonance'
import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'

export interface CombatContentEditorDescriptor {
  readonly category: CombatContentKind | 'basic'
  readonly storedKind: CombatContentKind
  readonly label: string
  readonly group: string
  readonly defaultDefinition: CombatContentDefinition | null
  readonly publicationBlocker: { readonly code: string; readonly message: string } | null
}
export function contentEditorDefaults(
  category: CombatContentKind | 'basic',
): Pick<CombatContentEditorDescriptor, 'label' | 'group' | 'defaultDefinition'> {
  const common = {
    schemaVersion: 1,
    id: `${category}.new`,
    contentVersion: 1,
    name: `New ${category}`,
    description: 'Describe this content.',
    sortOrder: 0,
    enabled: true,
    media: {},
  }
  const skill = {
    ...structuredClone(latestEnabledMatureSkills()[0]!),
    contentVersion: 1,
    name: 'New Skill',
    description: 'Describe this Skill.',
    authoring: { schemaVersion: 1, status: 'representative', validationTags: [] },
    ability: structuredClone(
      defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability,
    ),
  }
  switch (category) {
    case 'basic':
      return { label: 'Basic', group: 'Skills', defaultDefinition: null }
    case 'skill':
      return { label: 'Discipline', group: 'Skills', defaultDefinition: skill }
    case 'essence':
      return {
        label: 'Essence',
        group: 'Skills',
        defaultDefinition: {
          ...structuredClone(currentEssenceDefinitions()[0]!),
          contentVersion: 1,
          name: 'New Essence',
          description: 'Describe this Essence.',
          skill: { ...structuredClone(currentEssenceDefinitions()[0]!.skill), contentVersion: 1 },
        },
      }
    case 'resonance':
      return {
        label: 'Resonances',
        group: 'Resonances',
        defaultDefinition: {
          ...structuredClone(currentResonanceDefinitions()[0]!),
          contentVersion: 1,
          name: 'New Resonance',
          description: 'Describe this Resonance.',
        },
      }
    case 'discipline':
      return {
        label: 'Disciplines',
        group: 'Disciplines',
        defaultDefinition: {
          ...common,
          core: { might: 6, finesse: 5, vitality: 5, agility: 5, intellect: 5, resolve: 5 },
          focus: ['might', 'vitality'],
          enabledForPrimary: true,
          enabledForSecondary: true,
          linkedSkills: [],
          skillStages: [],
          unlock: { kind: 'always' },
          essenceId: null,
          resonanceSelections: [],
          atlas: {
            family: 'foundation',
            band: 'foundation',
            disclosure: 'open',
            power: { reliability: 3, flexibility: 3, setup: 3, ruleAccess: 3, execution: 3 },
          },
        },
      }
    case 'tag':
      return {
        label: 'Tag Library',
        group: 'Tag Library',
        defaultDefinition: {
          ...common,
          id: 'tag.damage',
          tagId: 'damage',
          name: 'Damage',
          description: 'Damage power.',
          explanation: 'Describe damage power.',
        },
      }
    case 'item':
      return {
        label: 'Items',
        group: 'Items',
        defaultDefinition: {
          ...common,
          itemClass: 'consumable',
          usage: 'active',
          equipmentSlot: null,
          acquisition: 'unimplemented',
          requirements: null,
          ability: null,
        },
      }
    case 'ascension':
    case 'severence':
      return {
        label: category === 'ascension' ? 'Ascensions' : 'Severences',
        group: category === 'ascension' ? 'Ascensions' : 'Severences',
        defaultDefinition: {
          ...common,
          formName: 'New form',
          requirements: null,
          ability: null,
          transformation: { kind: category, description: 'Describe this transformation.' },
        },
      }
    case 'status':
      return {
        label: 'Statuses',
        group: 'Tag Library',
        defaultDefinition: {
          ...structuredClone(PHASE4_STATUSES[0]!),
          id: 'status.new',
          name: 'New status',
          contentVersion: 1,
        },
      }
    case 'effect-profile':
      return { label: 'Retained effect profiles', group: 'Tag Library', defaultDefinition: null }
  }
}
