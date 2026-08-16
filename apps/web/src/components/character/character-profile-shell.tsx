import { CHARACTER_ATTRIBUTE_IDS } from '@aurevane/game-core/character/creation'
import type { DerivedStatValue } from '@aurevane/game-core/character/derived-stats'
import type { CharacterProfileReadModel } from '@aurevane/game-core/character/profile'
import {
  ATTRIBUTE_PROFILE_HELP,
  DERIVED_STAT_PROFILE_GROUPS,
  DERIVED_STAT_PROFILE_HELP,
} from '@aurevane/game-core/character/profile-stat-content'
import { Kicker, StatusMark, Surface } from '@aurevane/ui'

import { AurevaneImage } from '@/components/media/aurevane-image'
import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import { getStarterPortraitImageAssetId } from '@/media/character'

import styles from './character-profile-shell.module.css'

interface CharacterProfileShellProps {
  profile: CharacterProfileReadModel
}

const attributeLabels = {
  might: 'Might',
  finesse: 'Finesse',
  intellect: 'Intellect',
  resolve: 'Resolve',
} as const

export function CharacterProfileShell({ profile }: CharacterProfileShellProps) {
  const created = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(profile.timestamps.createdAt))
  const progress = profile.progression.progress

  return (
    <AuthenticatedShellFrame
      sessionLabel="Verified character profile"
      footerLabel={`Derived rules v${profile.derived.rulesVersion} // XP curve v${progress.curveVersion}`}
    >
      <Surface className={styles.profile} tone="elevated">
        <header className={styles.hero} data-testid="character-profile">
          <div className={styles.portrait}>
            <AurevaneImage
              assetId={getStarterPortraitImageAssetId(profile.identity.portraitRef)}
              sizes="(max-width: 560px) 8rem, 11rem"
            />
          </div>
          <div className={styles.identity}>
            <Kicker marker="◆">Character profile</Kicker>
            <h1>{profile.identity.name}</h1>
            <p>
              Level {profile.progression.level} {profile.foundationDiscipline.name}
            </p>
            <div className={styles.identityMeta}>
              <span>{profile.identity.presentationLabel}</span>
              <span>{profile.identity.pronounLabel}</span>
              <span>Cycle {profile.progression.cycleNumber}</span>
            </div>
            <p className={styles.disciplineSummary}>{profile.foundationDiscipline.summary}</p>

            <div className={styles.levelProgress} data-testid="level-progress">
              <div className={styles.levelProgressHeading}>
                <span>{progress.isMaxLevel ? 'Level cap reached' : `Progress to Level ${progress.level + 1}`}</span>
                <strong>
                  {progress.isMaxLevel
                    ? `${profile.progression.xp.toLocaleString('en')} XP`
                    : `${profile.progression.xp.toLocaleString('en')} / ${progress.nextLevelThreshold?.toLocaleString('en')} XP`}
                </strong>
              </div>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-label="Level progress"
                aria-valuemin={0}
                aria-valuemax={10_000}
                aria-valuenow={progress.progressBasisPoints}
              >
                <span style={{ width: `${progress.progressBasisPoints / 100}%` }} />
              </div>
              <small>
                {progress.isMaxLevel
                  ? `Maximum Level ${progress.maxLevel} // curve v${progress.curveVersion}`
                  : `${progress.xpIntoLevel.toLocaleString('en')} of ${progress.xpRequiredForNextLevel?.toLocaleString('en')} XP earned within this Level // curve v${progress.curveVersion}`}
              </small>
            </div>
          </div>
        </header>

        <section className={styles.section} aria-labelledby="profile-attributes">
          <div className={styles.sectionHeading}>
            <div>
              <Kicker marker="◇">Core attributes</Kicker>
              <h2 id="profile-attributes">The four foundations of your character.</h2>
            </div>
            <p>
              These are authoritative character values. Later equipment and Discipline systems may
              contribute modifiers without replacing these foundations.
            </p>
          </div>

          <div className={styles.attributeGrid}>
            {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => (
              <article
                className={styles.attributeCard}
                data-testid={`profile-attribute-${attributeId}`}
                key={attributeId}
              >
                <div>
                  <h3>{attributeLabels[attributeId]}</h3>
                  <strong>{profile.attributes[attributeId]}</strong>
                </div>
                <p>{ATTRIBUTE_PROFILE_HELP[attributeId]}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="profile-derived">
          <div className={styles.sectionHeading}>
            <div>
              <Kicker marker="◇">Derived stats</Kicker>
              <h2 id="profile-derived">Calculated from authoritative character state.</h2>
            </div>
            <p>
              Ruleset v{profile.derived.rulesVersion} is development balance. Values are calculated
              from one versioned source rather than stored as independently editable browser stats.
            </p>
          </div>

          <div className={styles.derivedGroups}>
            {DERIVED_STAT_PROFILE_GROUPS.map((group) => (
              <section className={styles.derivedGroup} key={group.id} aria-label={group.label}>
                <h3>{group.label}</h3>
                <div className={styles.derivedGrid}>
                  {group.statIds.map((statId) => {
                    const stat = profile.derived.stats[statId]
                    return (
                      <article
                        className={styles.statCard}
                        data-testid={`derived-stat-${statId}`}
                        key={statId}
                      >
                        <div className={styles.statValueRow}>
                          <span>{stat.label}</span>
                          <strong>{formatDerivedStat(stat)}</strong>
                        </div>
                        <p>{DERIVED_STAT_PROFILE_HELP[statId]}</p>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      </Surface>

      <aside className={styles.sidebar}>
        <Surface className={styles.sideCard} tone="quiet">
          <Kicker marker={<StatusMark />}>Authoritative state</Kicker>
          <dl>
            <div>
              <dt>Base slot</dt>
              <dd>#{profile.slotIndex + 1}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>{profile.progression.level} / {progress.maxLevel}</dd>
            </div>
            <div>
              <dt>Cumulative XP</dt>
              <dd>{profile.progression.xp.toLocaleString('en')}</dd>
            </div>
            <div>
              <dt>XP curve</dt>
              <dd>v{progress.curveVersion}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{created}</dd>
            </div>
            <div>
              <dt>Derived rules</dt>
              <dd>v{profile.derived.rulesVersion}</dd>
            </div>
          </dl>
        </Surface>

        <Surface className={styles.sideCard} tone="quiet">
          <Kicker marker="◇">Profile guide</Kicker>
          <p>
            XP and Level are server-authoritative. Reward sources grant XP through one transactional
            progression boundary; the profile only reads the resulting state and configured curve.
          </p>
          <a className={styles.backLink} href="/game">
            Return to game entry
          </a>
        </Surface>
      </aside>
    </AuthenticatedShellFrame>
  )
}

function formatDerivedStat(stat: DerivedStatValue): string {
  if (stat.unit === 'basisPoints') {
    return `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(stat.value / 100)}%`
  }

  if (stat.unit === 'steps') {
    return `${stat.value} steps`
  }

  if (stat.unit === 'height') {
    return `${stat.value}`
  }

  return new Intl.NumberFormat('en').format(stat.value)
}
