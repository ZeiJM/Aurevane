import type { CharacterProfileReadModel } from '@aurevane/game-core/character/profile'
import { Kicker, Surface } from '@aurevane/ui'

import { CharacterProfileDetails } from '@/components/character/character-profile-details'
import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import { getStarterPortraitImageAssetId } from '@/media/character'

import styles from './character-profile-shell.module.css'

interface CharacterProfileShellProps {
  profile: CharacterProfileReadModel
  personalTitle?: string | null
  imageUrl?: string | null
}

export function CharacterProfileShell({
  profile,
  personalTitle = null,
  imageUrl = null,
}: CharacterProfileShellProps) {
  const created = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(profile.timestamps.createdAt))
  const progress = profile.progression.progress

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
                <span className={styles.disciplinePill}>{profile.foundationDiscipline.name}</span>
                {personalTitle ? (
                  <span className={styles.personalTitlePill}>{personalTitle}</span>
                ) : null}
              </div>
              <p className={styles.subtitle}>
                Character Level <strong>{profile.progression.level}</strong>
              </p>
              <p className={styles.discipline}>{profile.foundationDiscipline.summary}</p>

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
            derived={profile.derived}
          />
        </Surface>

        <aside className={styles.sidebar}>
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
