import type { DisciplineDefinition } from '@aurevane/game-core/character/discipline-build'
import type { CharacterProfileReadModel } from '@aurevane/game-core/character/profile'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'

import styles from './character-identity-card.module.css'

interface CharacterIdentityCardProps {
  profile: CharacterProfileReadModel
  primary: DisciplineDefinition
  secondary: DisciplineDefinition | null
  personalTitle?: string | null
  imageUrl?: string | null
  disciplineSummary: string
  maxHp: number
  maxMp: number
}

export function CharacterIdentityCard({
  profile,
  primary,
  secondary,
  personalTitle = null,
  imageUrl = null,
  disciplineSummary,
  maxHp,
  maxMp,
}: CharacterIdentityCardProps) {
  const progress = profile.progression.progress

  return (
    <article
      className={styles.card}
      data-testid="character-profile"
      data-profile-identity-banner="true"
      data-av-surface="ink"
    >
      <div className={styles.portraitFrame}>
        <div className={styles.portrait}>
          <CharacterPortraitImage
            imageUrl={imageUrl}
            fallbackAssetId={getStarterPortraitImageAssetId(profile.identity.portraitRef)}
            sizes="(min-width: 1200px) 20vw, (min-width: 761px) 38vw, 92vw"
            alt={`${profile.identity.name} portrait`}
          />
        </div>
      </div>

      <div className={styles.identity}>
        <h1>{profile.identity.name}</h1>
        <p className={styles.motto}>A quieter blade still changes the tide.</p>
        <div className={styles.tags}>
          <span data-testid="primary-discipline-chip">{primary.name}</span>
          {secondary ? <span data-testid="secondary-discipline-chip">{secondary.name}</span> : null}
          {personalTitle ? <span data-tone="title">{personalTitle}</span> : null}
        </div>
      </div>

      <section
        className={styles.progress}
        data-testid="level-progress"
        aria-label="Character progression"
      >
        <div className={styles.progressLabel}>
          <strong>Level {profile.progression.level}</strong>
          <span>
            {progress.isMaxLevel
              ? `${profile.progression.xp.toLocaleString('en')} XP`
              : `${profile.progression.xp.toLocaleString('en')} / ${progress.nextLevelThreshold?.toLocaleString('en')} XP`}
          </span>
        </div>
        <div
          className={styles.xpTrack}
          role="progressbar"
          aria-label="Level progress"
          aria-valuemin={0}
          aria-valuemax={10000}
          aria-valuenow={progress.progressBasisPoints}
        >
          <span style={{ width: `${progress.progressBasisPoints / 100}%` }} />
        </div>
      </section>

      <div className={styles.resources}>
        <div className={styles.resource} data-character-resource="hp">
          <div>
            <span aria-hidden="true">♥</span>
            <strong>HP</strong>
            <b>
              {maxHp.toLocaleString('en')} / {maxHp.toLocaleString('en')}
            </b>
          </div>
          <i>
            <span />
          </i>
        </div>
        <div className={styles.resource} data-character-resource="mp">
          <div>
            <span aria-hidden="true">◇</span>
            <strong>MP</strong>
            <b>
              {maxMp.toLocaleString('en')} / {maxMp.toLocaleString('en')}
            </b>
          </div>
          <i>
            <span />
          </i>
        </div>
      </div>

      <p className={styles.summary}>{disciplineSummary}</p>
      <div className={styles.ornament} aria-hidden="true">
        ◇
      </div>
    </article>
  )
}
