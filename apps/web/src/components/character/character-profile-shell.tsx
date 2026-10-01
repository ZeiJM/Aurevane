import { foundationDisciplineAttributePolicy } from '@aurevane/game-core/character/attribute-allocation'
import type {
  CharacterAttributeId,
  CharacterAttributes,
} from '@aurevane/game-core/character/creation'
import type {
  DisciplineDefinition,
  PrimaryDisciplineBaseProfile,
  PrimaryDisciplinePreview,
} from '@aurevane/game-core/character/discipline-build'
import type { CharacterProfileReadModel } from '@aurevane/game-core/character/profile'
import type { SupernaturalStoryState } from '@aurevane/game-core/character/supernatural-state'
import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { Surface } from '@aurevane/ui'

import { CharacterAttributeAllocationPanel } from '@/components/character/character-attribute-allocation-panel'
import { CharacterRailSynchronizedLayout } from '@/components/character/character-rail-synchronized-layout'
import { CharacterProfileDetails } from '@/components/character/character-profile-details'
import { type SupernaturalChoiceOption } from '@/components/character/character-supernatural-choice-controls'
import { getStarterPortraitImageAssetId } from '@/media/character'

import styles from './character-profile-shell.module.css'

interface PrimaryOption {
  definition: DisciplineDefinition
  profile: PrimaryDisciplineBaseProfile
}

interface SecondaryOption extends PrimaryOption {
  masteredAt: string
}

interface AttributeAllocationView {
  characterId: string
  attributes: CharacterAttributes
  baseAttributes: CharacterAttributes
  level: number
  pointPool: number
  personalPointPool: number
  spentPoints: number
  unspentPoints: number
  conversionRequired: boolean
  resetWindowStartedAt: string | null
  resetUsed: number
  resetRemaining: number
  resetRenewsAt: string | null
  serverNow: string
}

export interface CharacterWorkspaceProps {
  profile: CharacterProfileReadModel
  attributeAllocation: AttributeAllocationView
  disciplineBuild: {
    buildVersion: number
    current: PrimaryDisciplinePreview
    currentSecondary: DisciplineDefinition | null
    availablePrimaries: readonly PrimaryOption[]
    availableSecondaries: readonly SecondaryOption[]
    attunement: {
      policy: {
        version: number
        primaryCooldownSeconds: number
        secondaryCooldownSeconds: number
      }
      serverNow: string
      primaryLockedUntil: string | null
      secondaryLockedUntil: string | null
      primaryRemainingSeconds: number
      secondaryRemainingSeconds: number
    }
    disciplineSkills: {
      capacity: number
      learnedSkills: readonly {
        definition: MatureSkillDefinition
        learnedAt: string
        activeSource: boolean
      }[]
      equippedSkills: readonly {
        definition: MatureSkillDefinition
        slotIndex: number
        equippedAt: string
      }[]
      extensions: {
        resonance: AnyResonanceDefinition | null
        essence: EssenceDefinition | null
      }
    }
  }
  personalTitle?: string | null
  imageUrl?: string | null
  supernatural?: {
    state: SupernaturalStoryState | null
    choices: readonly SupernaturalChoiceOption[]
  }
}

const DUAL_DISCIPLINE_PROFILE_SUMMARIES: Readonly<Record<string, string>> = {
  'aetherist+farstrider': 'Mobile arcane pressure with flexible positioning.',
  'aetherist+ironfist': 'Explosive arcane power backed by close-range force.',
  'aetherist+lifebinder': 'Restorative magic reinforced by arcane power.',
  'aetherist+shadehand': 'Arcane force delivered through deceptive precision.',
  'aetherist+vanguard': 'Armored pressure backed by arcane force.',
  'farstrider+ironfist': 'Mobile pressure backed by decisive close-range force.',
  'farstrider+lifebinder': 'Mobile support with sustained restorative control.',
  'farstrider+shadehand': 'Swift repositioning with precise opportunistic attacks.',
  'farstrider+vanguard': 'Durable frontline control with mobile reach.',
  'ironfist+lifebinder': 'Close-range resilience sustained by restorative power.',
  'ironfist+shadehand': 'Deceptive precision reinforced by brutal close-quarters force.',
  'ironfist+vanguard': 'Relentless close-quarters pressure with hardened defense.',
  'lifebinder+shadehand': 'Elusive support blending restoration and subtle strikes.',
  'lifebinder+vanguard': 'Frontline defense with restorative support.',
  'shadehand+vanguard': 'Heavy defense paired with deceptive precision.',
}

export function characterDisciplineSummary(
  primary: { id: string; name: string; summary: string },
  secondary: { id: string; name: string; summary: string } | null,
): string {
  if (!secondary) return primary.summary
  const pairKey = [primary.id, secondary.id].sort().join('+')
  return (
    DUAL_DISCIPLINE_PROFILE_SUMMARIES[pairKey] ??
    `${primary.name} and ${secondary.name} techniques woven into a hybrid combat style.`
  )
}

export function CharacterProfileShell({
  profile,
  attributeAllocation,
  disciplineBuild,
  personalTitle = null,
  imageUrl = null,
}: CharacterWorkspaceProps) {
  const attributePolicy = foundationDisciplineAttributePolicy(disciplineBuild.current.definition.id)
  const focusAttributes: readonly CharacterAttributeId[] = attributePolicy?.focusAttributes ?? []
  const buildTypeLabel = disciplineBuild.currentSecondary ? 'Resonance Build' : 'Essence Build'

  return (
    <CharacterRailSynchronizedLayout
      className={styles.layout}
      data-profile-workspace
      data-character-concept="profile"
      data-composition="correction"
    >
      <header className={styles.pageHeading}>
        <h1>Profile</h1>
        <p>Your journey, your choices, your story.</p>
      </header>
      <Surface
        className={styles.profile}
        tone="elevated"
        data-av-surface="moonstone"
        data-profile-sheet="true"
      >
        <div className={styles.identityTags} aria-label="Disciplines and titles">
          <div
            className={styles.identityTag}
            data-profile-tag="primary"
            role="group"
            aria-label="Primary Discipline"
          >
            <span aria-hidden="true">✦</span>
            <strong data-testid="primary-discipline-chip">
              {disciplineBuild.current.definition.name}
            </strong>
          </div>
          {disciplineBuild.currentSecondary ? (
            <div
              className={styles.identityTag}
              data-profile-tag="secondary"
              role="group"
              aria-label="Secondary Discipline"
            >
              <span aria-hidden="true">◇</span>
              <strong data-testid="secondary-discipline-chip">
                {disciplineBuild.currentSecondary.name}
              </strong>
            </div>
          ) : null}
          {personalTitle ? (
            <div
              className={styles.identityTag}
              data-profile-tag="title"
              role="group"
              aria-label="Personal title"
            >
              <span aria-hidden="true">✧</span>
              <strong>{personalTitle}</strong>
            </div>
          ) : null}
        </div>
        <CharacterProfileDetails
          presentationLabel={profile.identity.presentationLabel}
          buildTypeLabel={buildTypeLabel}
          cycleNumber={profile.progression.cycleNumber}
          attributes={profile.attributes}
          derived={disciplineBuild.current.derived}
          attributeResetControl={
            <CharacterAttributeAllocationPanel
              initialAllocation={attributeAllocation}
              portrait={{
                name: profile.identity.name,
                imageUrl,
                assetId: getStarterPortraitImageAssetId(profile.identity.portraitRef),
              }}
              focusAttributes={focusAttributes}
              attributeCaps={attributePolicy?.attributeCaps ?? {}}
            />
          }
        />
      </Surface>
    </CharacterRailSynchronizedLayout>
  )
}
