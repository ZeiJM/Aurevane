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
import { Kicker, Surface } from '@aurevane/ui'

import { CharacterAttributeAllocationPanel } from '@/components/character/character-attribute-allocation-panel'
import { CharacterDisciplineBuildPanel } from '@/components/character/character-discipline-build-panel'
import { CharacterProfileDetails } from '@/components/character/character-profile-details'
import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { CharacterSkillBuildPanel } from '@/components/character/character-skill-build-panel'
import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import { getStarterPortraitImageAssetId } from '@/media/character'

import compactStyles from './character-profile-shell-compact.module.css'
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
  level: number
  pointPool: number
  spentPoints: number
  unspentPoints: number
  resetWindowStartedAt: string | null
  resetUsed: number
  resetRemaining: number
  resetRenewsAt: string | null
  serverNow: string
}

interface CharacterProfileShellProps {
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
  pv2TestKitEnabled?: boolean
}

interface DisciplineSummaryView {
  id: string
  name: string
  summary: string
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

function getDisciplineProfileSummary(
  primary: DisciplineSummaryView,
  secondary: DisciplineSummaryView | null,
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
}: CharacterProfileShellProps) {
  const progress = profile.progression.progress
  const learnedSkillCatalogKey = disciplineBuild.disciplineSkills.learnedSkills
    .map((entry) => `${entry.definition.id}@${entry.definition.contentVersion}`)
    .sort()
    .join(',')
  const skillBuildKey = [
    disciplineBuild.buildVersion,
    disciplineBuild.current.definition.id,
    disciplineBuild.currentSecondary?.id ?? 'pure',
    learnedSkillCatalogKey,
  ].join(':')
  const equippedCount = disciplineBuild.disciplineSkills.equippedSkills.length
  const essence = disciplineBuild.disciplineSkills.extensions.essence
  const resonance = disciplineBuild.disciplineSkills.extensions.resonance
  const buildLabel = disciplineBuild.currentSecondary
    ? `${disciplineBuild.current.definition.name} + ${disciplineBuild.currentSecondary.name}`
    : `${disciplineBuild.current.definition.name} · Pure`
  const disciplineSummary = getDisciplineProfileSummary(
    disciplineBuild.current.definition,
    disciplineBuild.currentSecondary,
  )
  const focusAttributes: readonly CharacterAttributeId[] =
    foundationDisciplineAttributePolicy(disciplineBuild.current.definition.id)?.focusAttributes ??
    []

  return (
    <AuthenticatedShellFrame sessionLabel="Character Profile">
      <div className={`${styles.layout} ${compactStyles.layout}`}>
        <Surface className={`${styles.profile} ${compactStyles.profile}`} tone="elevated">
          <header
            className={`${styles.hero} ${compactStyles.hero}`}
            data-testid="character-profile"
          >
            <div className={`${styles.portrait} ${compactStyles.portrait}`}>
              <CharacterPortraitImage
                imageUrl={imageUrl}
                fallbackAssetId={getStarterPortraitImageAssetId(profile.identity.portraitRef)}
                sizes="(max-width: 640px) 7rem, 10rem"
                alt={`${profile.identity.name} portrait`}
              />
            </div>
            <div className={`${styles.identity} ${compactStyles.identity}`}>
              <Kicker marker="◆">Character Profile</Kicker>
              <div className={styles.nameLine}>
                <h1>{profile.identity.name}</h1>
                <div className={styles.nameTags}>
                  <span className={styles.disciplinePill} data-testid="primary-discipline-chip">
                    {disciplineBuild.current.definition.name}
                  </span>
                  {disciplineBuild.currentSecondary ? (
                    <span className={styles.disciplinePill} data-testid="secondary-discipline-chip">
                      {disciplineBuild.currentSecondary.name}
                    </span>
                  ) : null}
                  {personalTitle ? (
                    <span className={styles.personalTitlePill}>{personalTitle}</span>
                  ) : null}
                </div>
              </div>
              <p className={styles.discipline}>{disciplineSummary}</p>

              <div className={styles.levelProgress} data-testid="level-progress">
                <div>
                  <span>Character Level {profile.progression.level}</span>
                  <strong>
                    {progress.isMaxLevel
                      ? `${profile.progression.xp.toLocaleString('en')} XP`
                      : `${profile.progression.xp.toLocaleString('en')} / ${progress.nextLevelThreshold?.toLocaleString('en')} XP`}
                  </strong>
                </div>
                <div
                  className={styles.track}
                  role="progressbar"
                  aria-label="Level progress"
                  aria-valuemin={0}
                  aria-valuemax={10000}
                  aria-valuenow={progress.progressBasisPoints}
                >
                  <span style={{ width: `${progress.progressBasisPoints / 100}%` }} />
                </div>
              </div>
            </div>
          </header>

          <CharacterProfileDetails
            presentationLabel={profile.identity.presentationLabel}
            pronounLabel={profile.identity.pronounLabel}
            cycleNumber={profile.progression.cycleNumber}
            attributes={profile.attributes}
            derived={disciplineBuild.current.derived}
          />

          <CharacterAttributeAllocationPanel
            initialAllocation={attributeAllocation}
            focusAttributes={focusAttributes}
          />
        </Surface>

        <aside
          className={`${styles.sidebar} ${compactStyles.sidebar}`}
          aria-label="Combat loadout workspace"
        >
          <Surface
            className={`${styles.sideCard} ${styles.buildCard} ${compactStyles.buildCard}`}
            tone="quiet"
          >
            <div className={styles.buildHeading}>
              <Kicker marker="◇">Combat Loadout</Kicker>
            </div>

            <section className={styles.buildSection} aria-labelledby="build-disciplines-heading">
              <div className={styles.buildSectionHeader}>
                <span id="build-disciplines-heading">Disciplines</span>
                <strong>{buildLabel}</strong>
              </div>
              <CharacterDisciplineBuildPanel
                initialBuildVersion={disciplineBuild.buildVersion}
                initialCurrent={disciplineBuild.current}
                initialCurrentSecondary={disciplineBuild.currentSecondary}
                availablePrimaries={disciplineBuild.availablePrimaries}
                availableSecondaries={disciplineBuild.availableSecondaries}
                initialAttunement={disciplineBuild.attunement}
              />
            </section>

            <section className={styles.buildSection} aria-labelledby="build-techniques-heading">
              <div className={styles.buildSectionHeader}>
                <span id="build-techniques-heading">Techniques</span>
                <strong>
                  {equippedCount} / {disciplineBuild.disciplineSkills.capacity} tagged
                </strong>
              </div>
              <CharacterSkillBuildPanel
                key={skillBuildKey}
                initialBuildVersion={disciplineBuild.buildVersion}
                primaryDiscipline={{
                  id: disciplineBuild.current.definition.id,
                  name: disciplineBuild.current.definition.name,
                }}
                secondaryDiscipline={
                  disciplineBuild.currentSecondary
                    ? {
                        id: disciplineBuild.currentSecondary.id,
                        name: disciplineBuild.currentSecondary.name,
                      }
                    : null
                }
                initialCapacity={disciplineBuild.disciplineSkills.capacity}
                initialLearnedSkills={disciplineBuild.disciplineSkills.learnedSkills}
                initialEquippedSkills={disciplineBuild.disciplineSkills.equippedSkills}
                initialResonance={resonance}
                initialEssence={essence}
              />
            </section>

            <section className={styles.buildIdentity} aria-label="Combat loadout identity">
              <span>{resonance ? 'Resonance' : 'Essence'}</span>
              <strong>{resonance?.name ?? essence?.name ?? 'None available'}</strong>
              <small>
                {resonance?.description ??
                  essence?.description ??
                  (disciplineBuild.currentSecondary
                    ? 'No authored Resonance is available for this pair yet.'
                    : 'No authored Essence is available for this Discipline yet.')}
              </small>
            </section>
          </Surface>
        </aside>
      </div>
    </AuthenticatedShellFrame>
  )
}
