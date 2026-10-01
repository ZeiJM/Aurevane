import type { CSSProperties } from 'react'
import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import type { BattleSessionView } from '@/server/battle/battle-session-service'
import { pvpParticipantAccent } from './battle-combatant-colors'
import { BattleCombatantEffects } from './battle-combatant-effects'
import { meterPercent } from './battle-geometry'
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
      <header className={styles.identity}>
        <strong title={participant.name}>{participant.name}</strong>
        <span
          className={styles.facing}
          aria-label={`${participant.name} facing ${placement?.facing ?? 'unknown'}`}
        >
          {placement ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 12h14m-6-6 6 6-6 6"
                transform={`rotate(${{ north: -90, east: 0, south: 90, west: 180 }[placement.facing]} 12 12)`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <i aria-hidden="true">—</i>
          )}
        </span>
      </header>
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
            sizes="(max-width: 820px) 72px, (max-width: 1100px) 124px, 204px"
            alt=""
          />
        ) : (
          <span className={styles.fallback} aria-hidden="true">
            {participant.name.charAt(0).toUpperCase()}
          </span>
        )}
      </button>
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
