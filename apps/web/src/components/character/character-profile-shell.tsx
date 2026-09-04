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

import { CharacterDisciplineBuildPanel } from '@/components/character/character-discipline-build-panel'
import { CharacterProfileDetails } from '@/components/character/character-profile-details'
import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { CharacterPv2TestKit } from '@/components/character/character-pv2-test-kit'
import { CharacterSkillBuildPanel } from '@/components/character/character-skill-build-panel'
import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import { getStarterPortraitImageAssetId } from '@/media/character'

import styles from './character-profile-shell.module.css'

interface PrimaryOption {
  definition: DisciplineDefinition
  profile: PrimaryDisciplineBaseProfile
}

interface SecondaryOption extends PrimaryOption {
  masteredAt: string
}

interface CharacterProfileShellProps {
  profile: CharacterProfileReadModel
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

export function CharacterProfileShell({
  profile,
  disciplineBuild,
  personalTitle = null,
  imageUrl = null,
  pv2TestKitEnabled = false,
}: CharacterProfileShellProps) {
  const created = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(profile.timestamps.createdAt))
  const progress = profile.progression.progress
  const skillBuildKey = [
    disciplineBuild.buildVersion,
    disciplineBuild.current.definition.id,
    disciplineBuild.currentSecondary?.id ?? 'pure',
  ].join(':')

  return (
    <AuthenticatedShellFrame sessionLabel="Character Profile">
      <div className={styles.layout}>
        <Surface className={styles.profile} tone="elevated">
          <header className={styles.hero} data-testid="character-profile">
            <div className={styles.portrait}>
              <CharacterPortraitImage
                imageUrl={imageUrl}
                fallbackAssetId={getStarterPortraitImageAssetId(profile.identity.portraitRef)}
                sizes="(max-width: 640px) 7rem, 10rem"
                alt={`${profile.identity.name} portrait`}
              />
            </div>
            <div className={styles.identity}>
              <Kicker marker="◆">Character Profile</Kicker>
              <div className={styles.nameLine}>
                <h1>{profile.identity.name}</h1>
                <CharacterDisciplineBuildPanel
                  initialBuildVersion={disciplineBuild.buildVersion}
                  initialCurrent={disciplineBuild.current}
                  initialCurrentSecondary={disciplineBuild.currentSecondary}
                  availablePrimaries={disciplineBuild.availablePrimaries}
                  availableSecondaries={disciplineBuild.availableSecondaries}
                  initialAttunement={disciplineBuild.attunement}
                />
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
                  initialResonance={disciplineBuild.disciplineSkills.extensions.resonance}
                  initialEssence={disciplineBuild.disciplineSkills.extensions.essence}
                />
                {personalTitle ? (
                  <span className={styles.personalTitlePill}>{personalTitle}</span>
                ) : null}
              </div>
              <p className={styles.subtitle}>
                Character Level <strong>{profile.progression.level}</strong>
              </p>
              <p className={styles.discipline}>{disciplineBuild.current.definition.summary}</p>

              <div className={styles.levelProgress} data-testid="level-progress">
                <div>
                  <span>
                    {progress.isMaxLevel ? 'Level cap' : `Toward Level ${progress.level + 1}`}
                  </span>
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
            slotIndex={profile.slotIndex}
            presentationLabel={profile.identity.presentationLabel}
            pronounLabel={profile.identity.pronounLabel}
            cycleNumber={profile.progression.cycleNumber}
            attributes={profile.attributes}
            derived={disciplineBuild.current.derived}
          />
        </Surface>

        <aside className={styles.sidebar}>
          {pv2TestKitEnabled ? (
            <Surface className={styles.sideCard} tone="quiet">
              <Kicker marker="◇">Validation Preview</Kicker>
              <CharacterPv2TestKit />
            </Surface>
          ) : null}
          <Surface className={styles.sideCard} tone="quiet">
            <Kicker marker="◇">Character Record</Kicker>
            <dl className={styles.record}>
              <div>
                <dt>Slot</dt>
                <dd>{profile.slotIndex + 1}</dd>
              </div>
              <div>
                <dt>Character Level</dt>
                <dd>{profile.progression.level}</dd>
              </div>
              <div>
                <dt>Total XP</dt>
                <dd>{profile.progression.xp.toLocaleString('en')}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{created}</dd>
              </div>
            </dl>
          </Surface>
          <p className={styles.accountHint}>
            Manage this character&apos;s personal title and profile image from{' '}
            <strong>Account → Titles &amp; Profile Display</strong>.
          </p>
        </aside>
      </div>
    </AuthenticatedShellFrame>
  )
}
