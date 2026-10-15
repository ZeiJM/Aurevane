'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import {
  DEFAULT_COMBAT_KEYBINDS,
  formatCombatKeybind,
  type CombatKeybindMap,
} from '@aurevane/validation/player/combat-controls'
import { ResonanceParameters } from '../character/resonance-parameters'
import { BattleInfoPopover } from './battle-info-popover'
import { battleCooldownLabel } from './battle-action-cooldown'
import { BattleSkillCooldown } from './battle-skill-cooldown'
import { BattleControlledReady } from './battle-controlled-ready'
import { BattleSkillParameters } from './battle-skill-parameters'
import type { BattleRuntime } from './battle-runtime'
import { battleResonanceArtwork, battleSkillArtwork } from './battle-skill-presentation'
import styles from './battle-selected-skills.module.css'

function disciplineName(id: string): string {
  return id
    .split(/[-_.]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function SkillControls({
  title,
  hotkey,
  children,
}: {
  title: string
  hotkey: string
  children: ReactNode
}) {
  return (
    <div className={styles.controls} data-battle-cockpit-controls="true">
      <BattleInfoPopover
        label={`About ${title}`}
        title={title}
        trigger="i"
        consumeOutsideClick
        className={styles.infoTrigger}
      >
        {children}
      </BattleInfoPopover>
      <span className={styles.number}>{hotkey}</span>
    </div>
  )
}

/** Four committed slots, followed by the exclusive Essence/Resonance and future path. */
export function BattleSelectedSkills({
  runtime,
  activeId,
  disabled,
  actionEconomy,
  cooldowns = {},
  primeAvailableIds = [],
  readyActionId,
  onSelect,
  bindings = DEFAULT_COMBAT_KEYBINDS,
}: {
  runtime: BattleRuntime
  activeId?: string
  disabled: boolean
  actionEconomy: number
  cooldowns?: Readonly<Record<string, number>>
  primeAvailableIds?: readonly string[]
  readyActionId?: string
  bindings?: CombatKeybindMap
  onSelect: (skillId: string, category: 'attack' | 'defense' | 'heal') => void
}) {
  const essencePrime = !!runtime.essence && primeAvailableIds.includes(runtime.essence.id)
  const essenceDisabled =
    disabled ||
    (!essencePrime &&
      !!runtime.essence &&
      (actionEconomy < runtime.essence.apCost || (cooldowns[runtime.essence.id] ?? 0) > 0))
  const essenceReady =
    !!runtime.essence && readyActionId === runtime.essence.id && !essenceDisabled && !essencePrime
  return (
    <div className={styles.root} data-battle-selected-skills="true">
      <div className={styles.skills} aria-label="Selected Discipline Skills">
        {Array.from({ length: 4 }, (_, index) => {
          const skill = runtime.techniques?.[index]
          const cooldownTurns = skill ? (cooldowns[skill.id] ?? 0) : 0
          const primeAvailable = !!skill && primeAvailableIds.includes(skill.id)
          const actionDisabled =
            disabled ||
            (!primeAvailable && !!skill && (actionEconomy < skill.apCost || cooldownTurns > 0))
          const ready = !!skill && readyActionId === skill.id && !actionDisabled && !primeAvailable
          const binding = bindings[(['skill1', 'skill2', 'skill3', 'skill4'] as const)[index]!]
          const hotkey = formatCombatKeybind(binding)
          return (
            <article
              key={index}
              className={skill ? styles.skill : styles.empty}
              data-battle-skill-slot={index + 1}
            >
              {skill ? (
                <>
                  <button
                    type="button"
                    className={styles.skillAction}
                    data-battle-skill-hotkey={hotkey}
                    aria-label={`Selected ${skill.name}, ${primeAvailable ? 'prime without payment' : `${skill.apCost} AP`}${battleCooldownLabel(cooldownTurns)}${ready ? ', ready to release' : ''}`}
                    aria-pressed={activeId === skill.id}
                    disabled={actionDisabled}
                    data-battle-cooldown-active={cooldownTurns > 0 || undefined}
                    onClick={() => onSelect(skill.id, skill.category)}
                  >
                    <span
                      className={styles.artworkFrame}
                      data-av-square-media="true"
                      data-battle-skill-cooldown={cooldownTurns || undefined}
                    >
                      <Image
                        src={battleSkillArtwork(skill.id, skill.iconKey)}
                        width={192}
                        height={192}
                        alt=""
                        unoptimized
                      />
                      <BattleSkillCooldown turns={cooldownTurns} />
                      <BattleControlledReady ready={ready} />
                    </span>
                    <strong>{skill.name}</strong>
                  </button>
                  <SkillControls title={skill.name} hotkey={hotkey}>
                    <BattleSkillParameters skill={skill} />
                  </SkillControls>
                  <small className={styles.discipline}>
                    {disciplineName(skill.sourceDisciplineId)}
                  </small>
                </>
              ) : (
                <>
                  <span className={styles.emptyArt} aria-label="Empty selected Skill slot">
                    +
                  </span>
                  <strong>Empty</strong>
                  <SkillControls title={`selected Skill slot ${index + 1}`} hotkey={hotkey}>
                    <p>No Skill is equipped in this committed battle slot.</p>
                  </SkillControls>
                </>
              )}
            </article>
          )
        })}
      </div>
      <article
        className={styles.special}
        data-battle-special={runtime.essence ? 'essence' : 'resonance'}
      >
        {runtime.essence ? (
          <>
            <button
              className={styles.specialAction}
              type="button"
              aria-label={`${runtime.essence.name}, Essence, ${essencePrime ? 'prime without payment' : `${runtime.essence.apCost} AP`}${battleCooldownLabel(cooldowns[runtime.essence.id] ?? 0)}${essenceReady ? ', ready to release' : ''}`}
              aria-pressed={activeId === runtime.essence.id}
              disabled={essenceDisabled}
              data-battle-cooldown-active={(cooldowns[runtime.essence.id] ?? 0) > 0 || undefined}
              onClick={() => onSelect(runtime.essence!.id, 'attack')}
            >
              <span
                className={styles.artworkFrame}
                data-av-square-media="true"
                data-battle-skill-cooldown={cooldowns[runtime.essence.id] || undefined}
              >
                <Image
                  src={battleSkillArtwork(runtime.essence.id, runtime.essence.iconKey)}
                  width={192}
                  height={192}
                  alt=""
                  unoptimized
                />
                <BattleSkillCooldown turns={cooldowns[runtime.essence.id] ?? 0} />
                <BattleControlledReady ready={essenceReady} />
              </span>
              <strong>{runtime.essence.name}</strong>
            </button>
            <SkillControls
              title={runtime.essence.name}
              hotkey={formatCombatKeybind(bindings.essence)}
            >
              <p>{runtime.essence.description}</p>
              <BattleSkillParameters skill={runtime.essence} />
            </SkillControls>
            <small>Essence</small>
          </>
        ) : runtime.resonance ? (
          <>
            <span className={styles.artworkFrame} data-av-square-media="true">
              <Image
                src={battleResonanceArtwork(runtime.resonance.id)}
                width={192}
                height={192}
                alt=""
                unoptimized
              />
            </span>
            <strong>{runtime.resonance.name}</strong>
            <SkillControls
              title={runtime.resonance.name}
              hotkey={formatCombatKeybind(bindings.essence)}
            >
              {!runtime.resonance.definition ? <p>{runtime.resonance.description}</p> : null}
              <ResonanceParameters
                definition={runtime.resonance.definition}
                knownSkills={(runtime.techniques ?? []).flatMap((skill) =>
                  skill.definition ? [skill.definition] : [],
                )}
              />
            </SkillControls>
            <small>Resonance · Passive</small>
          </>
        ) : (
          <>
            <span className={styles.emptyArt}>—</span>
            <strong>Essence / Resonance</strong>
            <SkillControls
              title="Essence / Resonance"
              hotkey={formatCombatKeybind(bindings.essence)}
            >
              <p>No Essence or Resonance is equipped in this battle.</p>
            </SkillControls>
            <small>Not equipped</small>
          </>
        )}
      </article>
      <article className={styles.future} data-battle-special="supernatural">
        <span className={styles.emptyArt} aria-hidden="true">
          ◇
        </span>
        <strong>Severance / Ascension</strong>
        <SkillControls
          title="Severance / Ascension"
          hotkey={formatCombatKeybind(bindings.supernatural)}
        >
          <p>This supernatural path is coming soon. No combat ability is equipped here yet.</p>
        </SkillControls>
      </article>
    </div>
  )
}
