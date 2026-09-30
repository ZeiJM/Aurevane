import type { CSSProperties } from 'react'
import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import type { BattleSessionView } from '@/server/battle/battle-session-service'
import { pvpParticipantAccent } from './battle-combatant-colors'
import { BattleCombatantEffects } from './battle-combatant-effects'
import { facingGlyph, meterPercent } from './battle-geometry'
import type { BattlePresentationParticipant } from './battle-runtime'
import styles from './battle-combatant-card.module.css'

/** Snapshot-only summary, shared by playable and spectator battle layouts. */
export function BattleCombatantCard({
  participant,
  battle,
  teamCount,
  role,
}: {
  participant: BattlePresentationParticipant | null
  battle: BattleSessionView
  teamCount: number
  role: 'local' | 'selected' | 'acting'
}) {
  if (!participant) return <p className={styles.empty}>Select a character to inspect.</p>
  const combatant = battle.snapshot.tactical.battle.combatants.find(
    (row) => row.id === participant.combatantId,
  )
  const placement = battle.snapshot.tactical.placements.find(
    (row) => row.combatantId === participant.combatantId,
  )
  if (!combatant) return null
  const accent = pvpParticipantAccent(participant.teamIndex, participant.seatIndex, teamCount)
  return (
    <article
      className={styles.card}
      aria-label={`${participant.name} battle summary`}
      data-battle-combatant-card={role}
      data-defeated={combatant.hp <= 0 || undefined}
      style={{ '--battle-combatant-accent': accent } as CSSProperties}
    >
      <button
        type="button"
        className={styles.portrait}
        data-av-square-media="true"
        data-desktop-inspect-combatant={participant.combatantId}
        aria-label={`Inspect ${participant.name}`}
      >
        {participant.portraitAssetId ? (
          <CharacterPortraitImage
            imageUrl={participant.profileImageUrl}
            fallbackAssetId={participant.portraitAssetId}
            sizes="(max-width: 820px) 72px, (min-width: 1600px) 224px, 176px"
            alt=""
          />
        ) : (
          <span className={styles.fallback} aria-hidden="true">
            {participant.name.charAt(0).toUpperCase()}
          </span>
        )}
      </button>
      <header className={styles.identity}>
        <div>
          <strong>{participant.name}</strong>
          <span>
            {role === 'local'
              ? 'Your character'
              : role === 'acting'
                ? 'Acting character'
                : 'Selected character'}
          </span>
        </div>
        <span
          className={styles.facing}
          aria-label={`${participant.name} facing ${placement?.facing ?? 'unknown'}`}
        >
          {placement ? facingGlyph(placement.facing) : '—'}
        </span>
      </header>
      <div className={styles.vitals}>
        {(['hp', 'mp'] as const).map((resource) => {
          const maximum = resource === 'hp' ? combatant.maxHp : combatant.maxMp
          return (
            <div key={resource} data-resource={resource}>
              <span>
                {resource.toUpperCase()} {combatant[resource]} / {maximum}
              </span>
              <i aria-hidden="true">
                <b style={{ width: `${meterPercent(combatant[resource], maximum)}%` }} />
              </i>
            </div>
          )
        })}
      </div>
      <BattleCombatantEffects
        compact
        name={participant.name}
        statuses={
          battle.snapshot.statusState.find((row) => row.combatantId === participant.combatantId)
            ?.statuses ?? []
        }
      />
    </article>
  )
}
