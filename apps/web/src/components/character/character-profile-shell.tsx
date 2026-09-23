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
import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { ResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { Surface } from '@aurevane/ui'

import { CharacterAttributeAllocationPanel } from '@/components/character/character-attribute-allocation-panel'
import { CharacterIdentityCard } from '@/components/character/character-identity-card'
import { CharacterProfileDetails } from '@/components/character/character-profile-details'
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
        resonance: ResonanceDefinition | null
        essence: EssenceDefinition | null
      }
    }
  }
  personalTitle?: string | null
  imageUrl?: string | null
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
  const disciplineSummary = characterDisciplineSummary(
    disciplineBuild.current.definition,
    disciplineBuild.currentSecondary,
  )
  const attributePolicy = foundationDisciplineAttributePolicy(disciplineBuild.current.definition.id)
  const focusAttributes: readonly CharacterAttributeId[] = attributePolicy?.focusAttributes ?? []
  const buildTypeLabel = disciplineBuild.currentSecondary ? 'Resonance Build' : 'Essence Build'
  const maxHp = disciplineBuild.current.derived.stats.maxHp.value
  const maxMp = disciplineBuild.current.derived.stats.maxMp.value

  return (
    <div className={styles.layout} data-profile-workspace data-character-concept="profile">
      <CharacterIdentityCard
        profile={profile}
        primary={disciplineBuild.current.definition}
        secondary={disciplineBuild.currentSecondary}
        personalTitle={personalTitle}
        imageUrl={imageUrl}
        disciplineSummary={disciplineSummary}
        maxHp={maxHp}
        maxMp={maxMp}
      />

      <Surface
        className={styles.profile}
        tone="elevated"
        data-av-surface="moonstone"
        data-profile-sheet="true"
      >
        <header className={styles.sheetHeading}>
          <div>
            <span className={styles.sheetMarker} aria-hidden="true">
              ✧
            </span>
            <h2>Identity</h2>
          </div>
          <small>Same soul. A wider horizon.</small>
        </header>

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

      <aside
        className={styles.story}
        data-testid="current-path-coming-soon"
        aria-label="Current Path"
      >
        <header className={styles.storyHeading}>
          <div>
            <span aria-hidden="true">♜</span>
            <strong>Current Path</strong>
          </div>
          <small>Your story continues.</small>
        </header>
        <div className={styles.storyArt} aria-hidden="true" />
        <div className={styles.storyCopy}>
          <h2>Echoes Beyond the Vale</h2>
          <p>
            Fragments stir across Aurevane. Follow the threads, sharpen your strength, and uncover
            what lies beyond the turning skies.
          </p>
          <div className={styles.storyDivider} aria-hidden="true">
            ✧
          </div>
          <button type="button" disabled>
            View Journey <span aria-hidden="true">→</span>
          </button>
          <blockquote>
            “New paths are not found,
            <br />
            but remembered.”
            <cite>— An Aurevane Proverb</cite>
          </blockquote>
        </div>
      </aside>
    </div>
  )
}
