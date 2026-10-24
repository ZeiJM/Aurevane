'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import {
  DEFAULT_COMBAT_KEYBINDS,
  formatCombatKeybind,
  type CombatKeybindMap,
} from '@aurevane/validation/player/combat-controls'
import { ResonanceParameters } from '../character/resonance-parameters'
import { BattleCockpitInfo } from './battle-cockpit-info'
import { battleCooldownLabel } from './battle-action-cooldown'
import { BattleSkillCooldown } from './battle-skill-cooldown'
import { BattleControlledReady } from './battle-controlled-ready'
import { BattleSkillParameters } from './battle-skill-parameters'
import type { BattleRuntime } from './battle-runtime'
import { battleResonanceArtwork, battleSkillArtwork } from './battle-skill-presentation'
import styles from './battle-selected-skills.module.css'
import {
  battleCapturedActionChoices,
  battleCapturedActionCost,
  battleCapturedSpecialAction,
  battleSkillCastMode,
} from './battle-captured-action-cost'
import type { BattleCapturedActionTarget } from './battle-preview-selection'
import type { BattleSkillForecastPresentation } from './battle-runtime'

function disciplineName(id: string): string {
  return id
    .split(/[-_.]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function SkillControls({
  title,
  hotkey,
  shortcutAction,
  children,
}: {
  title: string
  hotkey: string
  shortcutAction: string
  children: ReactNode
}) {
  return (
    <div className={styles.controls} data-battle-cockpit-controls="true">
      <BattleCockpitInfo
        shortcutAction={shortcutAction}
        label={`About ${title}`}
        title={title}
        trigger="i"
        consumeOutsideClick
        className={styles.infoTrigger}
      >
        {children}
      </BattleCockpitInfo>
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
  actorId = null,
  manualActionTargets = [],
  resources,
  selectedBehavior,
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
  actorId?: string | null
  manualActionTargets?: readonly BattleCapturedActionTarget[]
  resources?: { mp: number; hp: number }
  selectedBehavior?: { actionId: string; behaviorId: string } | null
  cooldowns?: Readonly<Record<string, number>>
  primeAvailableIds?: readonly string[]
  readyActionId?: string
  bindings?: CombatKeybindMap
  onSelect: (skillId: string, category: 'attack' | 'defense' | 'heal') => void
}) {
  const actionCost = (skill: BattleSkillForecastPresentation) =>
    battleCapturedActionCost(
      battleCapturedActionChoices(manualActionTargets, skill.id, actorId),
      [
        { resource: 'ap', amount: skill.apCost },
        { resource: 'mp', amount: skill.mpCost },
      ],
      { ap: actionEconomy, mp: resources?.mp ?? Infinity, hp: resources?.hp ?? Infinity },
      selectedBehavior?.actionId === skill.id ? selectedBehavior.behaviorId : undefined,
    )
  const essenceCost = runtime.essence ? actionCost(runtime.essence) : undefined
  const essenceMode = runtime.essence ? battleSkillCastMode(runtime.essence) : undefined
  const special = battleCapturedSpecialAction(
    runtime,
    manualActionTargets,
    actorId,
    undefined,
    selectedBehavior && selectedBehavior.actionId === runtime.resonance?.id
      ? selectedBehavior.behaviorId
      : undefined,
  )
  const resonanceSkill = special?.kind === 'resonance' ? special.skill : undefined
  const resonanceCost = resonanceSkill ? actionCost(resonanceSkill) : undefined
  const resonancePrime =
    !!resonanceSkill &&
    !resonanceCost?.controlledSpent &&
    primeAvailableIds.includes(resonanceSkill.id)
  const resonanceDisabled =
    disabled ||
    (resonanceCost?.controlledSpent && !resonanceCost.chooseAction) ||
    (!resonancePrime &&
      !resonanceCost?.chooseAction &&
      !!resonanceSkill &&
      (!resonanceCost?.affordable || (cooldowns[resonanceSkill.id] ?? 0) > 0))
  const resonanceReady =
    !!resonanceSkill &&
    readyActionId === resonanceSkill.id &&
    !resonanceDisabled &&
    !resonancePrime &&
    !resonanceCost?.chooseAction
  const essencePrime =
    !!runtime.essence &&
    !essenceCost?.controlledSpent &&
    primeAvailableIds.includes(runtime.essence.id)
  const essenceDisabled =
    disabled ||
    (essenceCost?.controlledSpent && !essenceCost.chooseAction) ||
    essenceMode?.canCast === false ||
    (!essencePrime &&
      !essenceCost?.chooseAction &&
      !!runtime.essence &&
      (!essenceCost?.affordable || (cooldowns[runtime.essence.id] ?? 0) > 0))
  const essenceReady =
    !!runtime.essence &&
    readyActionId === runtime.essence.id &&
    !essenceDisabled &&
    !essencePrime &&
    !essenceCost?.chooseAction
  return (
    <div className={styles.root} data-battle-selected-skills="true">
      <div className={styles.skills} aria-label="Selected Discipline Skills">
        {Array.from({ length: 4 }, (_, index) => {
          const skill = runtime.techniques?.[index]
          const castMode = skill ? battleSkillCastMode(skill) : undefined
          const payment = skill ? actionCost(skill) : undefined
          const cooldownTurns = skill ? (cooldowns[skill.id] ?? 0) : 0
          const primeAvailable =
            !!skill && !payment?.controlledSpent && primeAvailableIds.includes(skill.id)
          const actionDisabled =
            disabled ||
            (payment?.controlledSpent && !payment.chooseAction) ||
            castMode?.canCast === false ||
            (!primeAvailable &&
              !payment?.chooseAction &&
              !!skill &&
              (!payment?.affordable || cooldownTurns > 0))
          const ready =
            !!skill &&
            readyActionId === skill.id &&
            !actionDisabled &&
            !primeAvailable &&
            !payment?.chooseAction
          const binding = bindings[(['skill1', 'skill2', 'skill3', 'skill4'] as const)[index]!]
          const hotkey = formatCombatKeybind(binding)
          return (
            <article
              key={index}
              className={skill ? styles.skill : styles.empty}
              data-battle-skill-slot={index + 1}
              data-battle-noncast={castMode?.canCast === false ? castMode.kind : undefined}
            >
              {skill ? (
                <>
                  <button
                    type="button"
                    className={styles.skillAction}
                    data-battle-skill-hotkey={hotkey}
                    aria-label={`Selected ${skill.name}, ${castMode?.canCast === false ? castMode.label : `${payment?.chooseAction ? 'choose another action' : primeAvailable ? 'prime without payment' : payment!.costLabel}${battleCooldownLabel(cooldownTurns)}${payment?.controlledSpent && !payment.chooseAction ? ', already used this battle' : ''}${payment?.controlledPrimed ? ', primed' : ''}${ready ? ', ready to release' : ''}`}`}
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
                      <BattleControlledReady ready={ready} primed={payment?.controlledPrimed} />
                    </span>
                    <strong>{skill.name}</strong>
                  </button>
                  <SkillControls
                    title={skill.name}
                    hotkey={hotkey}
                    shortcutAction={`skill${index + 1}`}
                  >
                    <BattleSkillParameters
                      skill={skill}
                      costLabel={payment?.costLabel}
                      cooldownLabel={payment?.cooldownLabel}
                      capturedReport={payment?.report}
                    />
                  </SkillControls>
                  <small className={styles.discipline}>
                    {disciplineName(skill.sourceDisciplineId)}
                    {castMode?.canCast === false ? ` · ${castMode.label}` : ''}
                  </small>
                </>
              ) : (
                <>
                  <span className={styles.emptyArt} aria-label="Empty selected Skill slot">
                    +
                  </span>
                  <strong>Empty</strong>
                  <SkillControls
                    title={`selected Skill slot ${index + 1}`}
                    hotkey={hotkey}
                    shortcutAction={`skill${index + 1}`}
                  >
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
        data-battle-noncast={essenceMode?.canCast === false ? essenceMode.kind : undefined}
      >
        {runtime.essence ? (
          <>
            <button
              className={styles.specialAction}
              type="button"
              aria-label={`${runtime.essence.name}, Essence, ${essenceMode?.canCast === false ? essenceMode.label : `${essenceCost?.chooseAction ? 'choose another action' : essencePrime ? 'prime without payment' : essenceCost!.costLabel}${battleCooldownLabel(cooldowns[runtime.essence.id] ?? 0)}${essenceCost?.controlledSpent && !essenceCost.chooseAction ? ', already used this battle' : ''}${essenceCost?.controlledPrimed ? ', primed' : ''}${essenceReady ? ', ready to release' : ''}`}`}
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
                <BattleControlledReady
                  ready={essenceReady}
                  primed={essenceCost?.controlledPrimed}
                />
              </span>
              <strong>{runtime.essence.name}</strong>
            </button>
            <SkillControls
              title={runtime.essence.name}
              shortcutAction="essence"
              hotkey={formatCombatKeybind(bindings.essence)}
            >
              <p>{runtime.essence.description}</p>
              <BattleSkillParameters
                skill={runtime.essence}
                costLabel={essenceCost?.costLabel}
                cooldownLabel={essenceCost?.cooldownLabel}
                capturedReport={essenceCost?.report}
              />
            </SkillControls>
            <small>Essence{essenceMode?.canCast === false ? ` · ${essenceMode.label}` : ''}</small>
          </>
        ) : runtime.resonance ? (
          <>
            {resonanceSkill ? (
              <button
                className={styles.specialAction}
                type="button"
                aria-label={`${runtime.resonance.name}, Resonance, ${resonanceCost?.chooseAction ? 'choose another action' : resonancePrime ? 'prime without payment' : resonanceCost!.costLabel}${battleCooldownLabel(cooldowns[runtime.resonance.id] ?? 0)}${resonanceCost?.controlledSpent && !resonanceCost.chooseAction ? ', already used this battle' : ''}${resonanceCost?.controlledPrimed ? ', primed' : ''}${resonanceReady ? ', ready to release' : ''}`}
                aria-pressed={activeId === runtime.resonance.id}
                disabled={resonanceDisabled}
                data-battle-cooldown-active={
                  (cooldowns[runtime.resonance.id] ?? 0) > 0 || undefined
                }
                onClick={() => onSelect(runtime.resonance!.id, special!.category)}
              >
                <span
                  className={styles.artworkFrame}
                  data-av-square-media="true"
                  data-battle-skill-cooldown={cooldowns[runtime.resonance.id] || undefined}
                >
                  <Image
                    src={battleResonanceArtwork(runtime.resonance.id)}
                    width={192}
                    height={192}
                    alt=""
                    unoptimized
                  />
                  <BattleSkillCooldown turns={cooldowns[runtime.resonance.id] ?? 0} />
                  <BattleControlledReady
                    ready={resonanceReady}
                    primed={resonanceCost?.controlledPrimed}
                  />
                </span>
                <strong>{runtime.resonance.name}</strong>
              </button>
            ) : (
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
              </>
            )}
            <SkillControls
              title={runtime.resonance.name}
              shortcutAction="essence"
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
            <small>Resonance</small>
          </>
        ) : (
          <>
            <span className={styles.emptyArt}>—</span>
            <strong>Essence / Resonance</strong>
            <SkillControls
              title="Essence / Resonance"
              shortcutAction="essence"
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
          shortcutAction="supernatural"
          hotkey={formatCombatKeybind(bindings.supernatural)}
        >
          <p>This supernatural path is coming soon. No combat ability is equipped here yet.</p>
        </SkillControls>
      </article>
    </div>
  )
}
