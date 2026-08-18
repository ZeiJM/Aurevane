import { CHARACTER_ATTRIBUTE_IDS } from '@aurevane/game-core/character/creation'
import type { DerivedStatValue } from '@aurevane/game-core/character/derived-stats'
import type { CharacterProfileReadModel } from '@aurevane/game-core/character/profile'
import { DERIVED_STAT_PROFILE_GROUPS } from '@aurevane/game-core/character/profile-stat-content'
import { Kicker, Surface } from '@aurevane/ui'

import { AurevaneImage } from '@/components/media/aurevane-image'
import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import { getStarterPortraitImageAssetId } from '@/media/character'

import styles from './character-profile-shell.module.css'

interface CharacterProfileShellProps {
  profile: CharacterProfileReadModel
  personalTitle?: string | null
}

const attributeLabels = {
  might: 'Might',
  finesse: 'Finesse',
  vitality: 'Vitality',
  agility: 'Agility',
  intellect: 'Intellect',
  resolve: 'Resolve',
} as const

export function CharacterProfileShell({
  profile,
  personalTitle = null,
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
              <AurevaneImage
                assetId={getStarterPortraitImageAssetId(profile.identity.portraitRef)}
                sizes="(max-width: 640px) 7rem, 10rem"
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
              <p className={styles.subtitle}>Level {profile.progression.level} adventurer</p>
              <div className={styles.meta}>
                <span>Slot {profile.slotIndex + 1}</span>
                <span>{profile.identity.presentationLabel}</span>
                <span>{profile.identity.pronounLabel}</span>
                <span>Cycle {profile.progression.cycleNumber}</span>
              </div>
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

          <section className={styles.compactSection} aria-labelledby="attributes-title">
            <div className={styles.sectionTitle}>
              <Kicker marker="◇">Core Attributes</Kicker>
              <h2 id="attributes-title">Character strengths</h2>
            </div>
            <dl className={styles.attributeStrip}>
              {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => (
                <div key={attributeId} data-testid={`profile-attribute-${attributeId}`}>
                  <dt>{attributeLabels[attributeId]}</dt>
                  <dd>{profile.attributes[attributeId]}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={styles.compactSection} aria-labelledby="derived-title">
            <div className={styles.sectionTitle}>
              <Kicker marker="◇">Combat &amp; Adventure Stats</Kicker>
              <h2 id="derived-title">Current values</h2>
            </div>
            <div className={styles.statGroups}>
              {DERIVED_STAT_PROFILE_GROUPS.map((group) => (
                <section className={styles.statGroup} key={group.id} aria-label={group.label}>
                  <h3>{group.label}</h3>
                  <dl>
                    {group.statIds.map((statId) => {
                      const stat = profile.derived.stats[statId]
                      return (
                        <div key={statId} data-testid={`derived-stat-${statId}`}>
                          <dt>{stat.label}</dt>
                          <dd>{formatDerivedStat(stat)}</dd>
                        </div>
                      )
                    })}
                  </dl>
                </section>
              ))}
            </div>
          </section>
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
                <dt>Level</dt>
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
            Manage this character&apos;s personal title and future profile-display choices from{' '}
            <strong>Account → Titles &amp; Profile Display</strong>.
          </p>
        </aside>
      </div>
    </AuthenticatedShellFrame>
  )
}

function formatDerivedStat(stat: DerivedStatValue): string {
  if (stat.unit === 'basisPoints') {
    return `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(stat.value / 100)}%`
  }
  if (stat.unit === 'steps') return `${stat.value}`
  return new Intl.NumberFormat('en').format(stat.value)
}
