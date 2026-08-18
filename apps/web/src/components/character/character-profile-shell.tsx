import {
  CHARACTER_ATTRIBUTE_CONTENT,
  CHARACTER_ATTRIBUTE_IDS,
} from '@aurevane/game-core/character/creation'
import type { DerivedStatValue } from '@aurevane/game-core/character/derived-stats'
import type { CharacterProfileReadModel } from '@aurevane/game-core/character/profile'
import { DERIVED_STAT_PROFILE_GROUPS } from '@aurevane/game-core/character/profile-stat-content'
import { Kicker, Surface } from '@aurevane/ui'

import { IdentityAvatar } from '@/components/account/identity-avatar'
import { AurevaneImage } from '@/components/media/aurevane-image'
import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import { getStarterPortraitImageAssetId } from '@/media/character'

import styles from './character-profile-shell.module.css'

interface CharacterProfileShellProps {
  profile: CharacterProfileReadModel
  avatarUrl?: string | null
  equippedTitle?: string | null
}

export function CharacterProfileShell({
  profile,
  avatarUrl = null,
  equippedTitle = null,
}: CharacterProfileShellProps) {
  const created = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(profile.timestamps.createdAt))
  const progress = profile.progression.progress

  return (
    <AuthenticatedShellFrame sessionLabel="Character profile">
      <div className={styles.layout}>
        <Surface className={styles.profile} tone="elevated">
          <header className={styles.hero} data-testid="character-profile">
            <div className={styles.portrait}>
              {avatarUrl ? (
                <IdentityAvatar
                  src={avatarUrl}
                  alt={`${profile.identity.name} avatar`}
                  className={styles.remotePortrait}
                  fallback={profile.identity.name.slice(0, 1).toUpperCase() || 'A'}
                />
              ) : (
                <AurevaneImage
                  assetId={getStarterPortraitImageAssetId(profile.identity.portraitRef)}
                  sizes="(max-width: 640px) 7rem, 10rem"
                />
              )}
            </div>
            <div className={styles.identity}>
              <Kicker marker="◆">Character Profile</Kicker>
              <h1>{profile.identity.name}</h1>
              <div className={styles.identityBadges}>
                <span className={styles.disciplineBadge}>{profile.foundationDiscipline.name}</span>
                {equippedTitle ? <span className={styles.titleBadge}>{equippedTitle}</span> : null}
              </div>
              <div className={styles.meta}>
                <span>Level {profile.progression.level}</span>
                <span>Slot {profile.slotIndex + 1}</span>
                <span>{profile.identity.presentationLabel}</span>
                <span>{profile.identity.pronounLabel}</span>
                <span>Cycle {profile.progression.cycleNumber}</span>
              </div>
              <p className={styles.discipline}>{profile.foundationDiscipline.summary}</p>

              <div className={styles.levelProgress} data-testid="level-progress">
                <div>
                  <span>{progress.isMaxLevel ? 'Level cap' : `Level ${progress.level + 1}`}</span>
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
              <h2 id="attributes-title">Attributes</h2>
            </div>
            <dl className={styles.attributeStrip}>
              {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => (
                <div key={attributeId} data-testid={`profile-attribute-${attributeId}`}>
                  <dt>{CHARACTER_ATTRIBUTE_CONTENT[attributeId].label}</dt>
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
                <dt>Level</dt>
                <dd>{profile.progression.level}</dd>
              </div>
              <div>
                <dt>Total XP</dt>
                <dd>{profile.progression.xp.toLocaleString('en')}</dd>
              </div>
              <div>
                <dt>Discipline</dt>
                <dd>{profile.foundationDiscipline.name}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{created}</dd>
              </div>
            </dl>
          </Surface>
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
