'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { normalizedResonanceMechanics } from '@aurevane/game-core/combat/resonance-v2'
import {
  DEFAULT_COMBAT_KEYBINDS,
  formatCombatKeybind,
  type CombatKeybindMap,
} from '@aurevane/validation/player/combat-controls'
import { CompactSkillEffectSummary } from '../character/compact-skill-effect-summary'
import { previewEffect } from '../character/skill-effect-preview'
import { BattleInfoPopover } from './battle-info-popover'
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
  onSelect,
  bindings = DEFAULT_COMBAT_KEYBINDS,
}: {
  runtime: BattleRuntime
  activeId?: string
  disabled: boolean
  actionEconomy: number
  bindings?: CombatKeybindMap
  onSelect: (skillId: string, category: 'attack' | 'defense' | 'heal') => void
}) {
  const resonanceMechanics = runtime.resonance?.definition
    ? normalizedResonanceMechanics(runtime.resonance.definition)
    : null
  return (
    <div className={styles.root} data-battle-selected-skills="true">
      <div className={styles.skills} aria-label="Selected Discipline Skills">
        {Array.from({ length: 4 }, (_, index) => {
          const skill = runtime.techniques?.[index]
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
                    aria-label={`Selected ${skill.name}, ${skill.apCost} AP`}
                    aria-pressed={activeId === skill.id}
                    disabled={disabled || actionEconomy < skill.apCost}
                    onClick={() => onSelect(skill.id, skill.category)}
                  >
                    <span className={styles.artworkFrame} data-av-square-media="true">
                      <Image
                        src={battleSkillArtwork(skill.id, skill.iconKey)}
                        width={192}
                        height={192}
                        alt=""
                        unoptimized
                      />
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
              aria-label={`${runtime.essence.name}, Essence, ${runtime.essence.apCost} AP`}
              aria-pressed={activeId === runtime.essence.id}
              disabled={disabled || actionEconomy < runtime.essence.apCost}
              onClick={() => onSelect(runtime.essence!.id, 'attack')}
            >
              <span className={styles.artworkFrame} data-av-square-media="true">
                <Image
                  src={battleSkillArtwork(runtime.essence.id, runtime.essence.iconKey)}
                  width={192}
                  height={192}
                  alt=""
                  unoptimized
                />
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
              <p>{runtime.resonance.description}</p>
              <strong>Parameters</strong>
              {resonanceMechanics ? (
                <>
                  <dl>
                    <div>
                      <dt>Type</dt>
                      <dd>
                        {resonanceMechanics.mode === 'immediate'
                          ? 'Immediate Resonance'
                          : 'Sequence Resonance'}
                      </dd>
                    </div>
                    <div>
                      <dt>Setup</dt>
                      <dd>
                        {resonanceMechanics.setup
                          ? `${disciplineName(resonanceMechanics.setup.sourceDisciplineId)} · ${resonanceMechanics.setup.requiredTags.join(' + ')}`
                          : 'None'}
                      </dd>
                    </div>
                    <div>
                      <dt>Trigger</dt>
                      <dd>{`${disciplineName(resonanceMechanics.trigger.sourceDisciplineId)} · ${resonanceMechanics.trigger.requiredTags.join(' + ')}`}</dd>
                    </div>
                  </dl>
                  {resonanceMechanics.resultEffects.map((effect, index) => (
                    <div key={index}>
                      <CompactSkillEffectSummary effect={effect} />
                      <p>{previewEffect(effect).explanation}</p>
                    </div>
                  ))}
                </>
              ) : null}
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
      {(runtime.copiedSkills?.length ?? 0) > 0 ? (
        <details className={styles.copied} data-battle-copied-skills="true">
          <summary
            aria-label={`Copied Skills · ${runtime.copiedSkills!.length} battle-only`}
            title={`Copied Skills · ${runtime.copiedSkills!.length} battle-only`}
          >
            <strong>Copied</strong>
            <small>{runtime.copiedSkills!.length}</small>
          </summary>
          <div className={styles.copiedMenu} role="group" aria-label="Copied Skills">
            {runtime.copiedSkills!.map((skill) => (
              <div key={skill.id}>
                <button
                  type="button"
                  data-battle-copied-skill-option={skill.id}
                  aria-pressed={activeId === skill.id}
                  disabled={disabled || actionEconomy < skill.apCost}
                  onClick={() => onSelect(skill.id, skill.category)}
                >
                  <Image
                    src={battleSkillArtwork(skill.sourceSkillId, skill.iconKey)}
                    width={96}
                    height={96}
                    alt=""
                    unoptimized
                  />
                  <span>
                    <strong>{skill.name}</strong>
                    <small>
                      {skill.apCost} AP · {skill.mpCost} MP
                    </small>
                  </span>
                </button>
                <BattleInfoPopover
                  label={`About copied ${skill.name}`}
                  title={skill.name}
                  trigger="i"
                >
                  <BattleSkillParameters skill={skill} />
                </BattleInfoPopover>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}
