import Image from 'next/image'

import type { BattleRuntime } from './battle-runtime'
import { battleResonanceArtwork, battleSkillArtwork } from './battle-skill-presentation'
import styles from './battle-selected-skills.module.css'

/** Committed build order, with the pure Essence or passive Resonance kept outside four slots. */
export function BattleSelectedSkills({
  runtime,
  activeId,
  disabled,
  actionEconomy,
  onSelect,
}: {
  runtime: BattleRuntime
  activeId?: string
  disabled: boolean
  actionEconomy: number
  onSelect: (skillId: string, category: 'attack' | 'defense' | 'heal') => void
}) {
  return (
    <div className={styles.root} data-battle-selected-skills="true">
      <div className={styles.skills} aria-label="Selected Discipline Skills">
        {(runtime.techniques ?? []).map((skill, index) => (
          <button
            key={skill.id}
            type="button"
            className={styles.skill}
            aria-label={`Selected ${skill.name}, ${skill.apCost} AP`}
            aria-pressed={activeId === skill.id}
            title={`${skill.name} · ${skill.apCost} AP · ${skill.mpCost} MP`}
            disabled={disabled || actionEconomy < skill.apCost}
            onClick={() => onSelect(skill.id, skill.category)}
          >
            <Image src={battleSkillArtwork(skill.id)} width={80} height={80} alt="" unoptimized />
            <span className={styles.number}>{index + 1}</span>
            <strong>{skill.name}</strong>
          </button>
        ))}
        {Array.from({ length: Math.max(0, 4 - (runtime.techniques?.length ?? 0)) }, (_, index) => (
          <span key={index} className={styles.empty} aria-label="Empty selected Skill slot">
            —
          </span>
        ))}
      </div>
      {(runtime.copiedSkills?.length ?? 0) > 0 ? (
        <details className={styles.copied} data-battle-copied-skills="true">
          <summary>
            <strong>Copied Skills</strong>
            <small>{runtime.copiedSkills!.length} battle-only</small>
          </summary>
          <div className={styles.copiedMenu} role="group" aria-label="Copied Skills">
            {runtime.copiedSkills!.map((skill) => (
              <button
                key={skill.id}
                type="button"
                data-battle-copied-skill-option={skill.id}
                aria-pressed={activeId === skill.id}
                disabled={disabled || actionEconomy < skill.apCost}
                onClick={() => onSelect(skill.id, skill.category)}
              >
                <Image
                  src={battleSkillArtwork(skill.sourceSkillId)}
                  width={48}
                  height={48}
                  alt=""
                  unoptimized
                />
                <span>
                  <strong>{skill.name}</strong>
                  <small>{skill.apCost} AP · {skill.mpCost} MP</small>
                </span>
              </button>
            ))}
          </div>
        </details>
      ) : null}
      {runtime.essence ? (
        <button
          className={styles.special}
          type="button"
          aria-label={`${runtime.essence.name}, Essence, ${runtime.essence.apCost} AP`}
          aria-pressed={activeId === runtime.essence.id}
          disabled={disabled || actionEconomy < runtime.essence.apCost}
          onClick={() => onSelect(runtime.essence!.id, 'attack')}
        >
          <Image
            src={battleSkillArtwork(runtime.essence.id)}
            width={64}
            height={64}
            alt=""
            unoptimized
          />
          <span>
            <strong>{runtime.essence.name}</strong>
            <small>Essence · {runtime.essence.apCost} AP</small>
          </span>
        </button>
      ) : runtime.resonance ? (
        <div
          className={styles.special}
          title={runtime.resonance.description}
          aria-label="Active Resonance"
        >
          <Image
            src={battleResonanceArtwork(runtime.resonance.id)}
            width={64}
            height={64}
            alt=""
            unoptimized
          />
          <span>
            <strong>{runtime.resonance.name}</strong>
            <small>Passive Resonance</small>
          </span>
        </div>
      ) : null}
    </div>
  )
}
