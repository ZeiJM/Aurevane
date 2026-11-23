'use client'

import { useCallback, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import type { ManualCombatModifierSelection } from '@aurevane/game-core/combat/combat-ability-command'
import {
  formatCombatKeybind,
  type CombatKeybind,
} from '@aurevane/validation/player/combat-controls'
import type { BattleCommandQuote } from '@/server/battle/battle-command-quote'
import { AbilityParameters } from '../character/ability-parameters'
import { abilityCostDescription } from '@/lib/battle/ability-cost-presentation'
import { BattleInfoPopover } from './battle-info-popover'
import {
  battleModifierCanToggle,
  type BattleModifierActionChoice,
  type BattleModifierChoice,
  type BattleModifierPublicName,
} from './battle-modifier-picker-model'
import styles from './battle-modifier-picker.module.css'

interface BattleModifierPickerProps {
  actions: readonly BattleModifierActionChoice[]
  modifiers: readonly BattleModifierChoice[]
  publicNames?: readonly BattleModifierPublicName[]
  selectedActionKey: string | null
  selectedReferences: readonly ManualCombatModifierSelection[]
  locked: boolean
  readOnly: boolean
  binding: CombatKeybind | null
  quote: BattleCommandQuote | null
  quotePending: boolean
  onPrepareAction: (choice: BattleModifierActionChoice) => void
  onToggleModifier: (choice: BattleModifierChoice) => void
  triggerRef: RefObject<HTMLButtonElement | null>
}
function selected(choice: BattleModifierChoice, refs: readonly ManualCombatModifierSelection[]) {
  return refs.some(
    (ref) =>
      ref.sourceInstanceId === choice.reference.sourceInstanceId &&
      ref.behaviorId === choice.reference.behaviorId,
  )
}

/** One roving button list and one checkbox list; preparation never executes a command. */
export function BattleModifierPanel(
  props: BattleModifierPickerProps & { panelRef?: RefObject<HTMLDivElement | null> },
) {
  const ownRef = useRef<HTMLDivElement>(null)
  const panel = props.panelRef ?? ownRef
  const [actionFocus, setActionFocus] = useState(0)
  const [modifierFocus, setModifierFocus] = useState(0)
  const root = props.actions.find((action) => action.key === props.selectedActionKey) ?? null
  const focused = props.modifiers[modifierFocus]
  const reversal = root?.descriptor.controlled?.kind === 'reversal'
  const prime = root?.descriptor.controlled?.canPrime === true && !reversal
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (
      ![
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
        'Space',
        'Enter',
      ].includes(event.code)
    )
      return
    const active = document.activeElement as HTMLElement | null
    const list = active?.closest<HTMLElement>('[data-modifier-list]')
    if (!list || !panel.current?.contains(list)) return
    event.preventDefault()
    event.stopPropagation()
    if (event.code === 'Space' || event.code === 'Enter') {
      if (!event.repeat) active?.click()
      return
    }
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      panel.current
        .querySelector<HTMLElement>(
          `[data-modifier-list="${list.dataset.modifierList === 'actions' ? 'modifiers' : 'actions'}"] [data-modifier-row]`,
        )
        ?.focus()
      return
    }
    const rows = [...list.querySelectorAll<HTMLElement>('[data-modifier-row]')]
    const index = rows.indexOf(active!)
    const next =
      event.code === 'Home'
        ? 0
        : event.code === 'End'
          ? rows.length - 1
          : (index + (event.code === 'ArrowDown' ? 1 : rows.length - 1) + rows.length) % rows.length
    rows[next]?.focus()
  }
  return (
    <div className={styles.panel} ref={panel} onKeyDown={keys} data-battle-modifier-picker="true">
      <p>
        {root?.descriptor.controlled?.phase === 'spent'
          ? 'This Controlled action has already been used.'
          : props.locked
            ? 'This set is locked for the primed action.'
            : 'Choose modifiers before using or priming the action.'}
      </p>
      {props.readOnly ? <p role="status">Read only while this action cannot be prepared.</p> : null}
      <div className={styles.lists}>
        <section aria-label="Action" data-modifier-list="actions">
          <h3>Action</h3>
          {props.actions.map((action, index) => (
            <button
              key={action.key}
              type="button"
              data-modifier-row="true"
              aria-pressed={action.key === props.selectedActionKey}
              aria-disabled={props.readOnly}
              tabIndex={index === actionFocus ? 0 : -1}
              onFocus={() => setActionFocus(index)}
              onClick={() => {
                if (props.readOnly) return
                props.onPrepareAction(action)
                requestAnimationFrame(() =>
                  panel.current
                    ?.querySelector<HTMLElement>(
                      '[data-modifier-list="modifiers"] [data-modifier-row]',
                    )
                    ?.focus(),
                )
              }}
            >
              {action.label}
            </button>
          ))}
          {!props.actions.length ? <p>No equipped action is available.</p> : null}
        </section>
        <section aria-label="Modifiers" data-modifier-list="modifiers">
          <h3>Modifiers</h3>
          {!root ? <p role="status">Choose an action first.</p> : null}
          {props.modifiers.map((choice, index) => {
            const checked = selected(choice, props.selectedReferences)
            const allowed =
              battleModifierCanToggle(choice, checked, root, props.locked, props.readOnly) &&
              (checked || props.selectedReferences.length < 15)
            return (
              <button
                key={JSON.stringify(choice.reference)}
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-disabled={!allowed}
                data-modifier-row="true"
                tabIndex={index === modifierFocus ? 0 : -1}
                onFocus={() => setModifierFocus(index)}
                onClick={() => {
                  if (allowed) props.onToggleModifier(choice)
                }}
              >
                <strong>{choice.label}</strong>
                <small>
                  {choice.costs ? abilityCostDescription(choice.costs) : 'Cost unavailable'} ·{' '}
                  {choice.compatibility === null
                    ? 'Cooldown unavailable'
                    : choice.cooldown
                      ? `${choice.cooldown.ownerTurns} turns`
                      : 'No cooldown'}
                </small>
                {choice.blockedReasons.length ? (
                  <small>
                    {prime ? 'Release: ' : ''}
                    {choice.blockedReasons.map((reason) => reason.replaceAll('-', ' ')).join('; ')}
                  </small>
                ) : null}
                {!allowed && !props.locked && !props.readOnly && !choice.blockedReasons.length ? (
                  <small>
                    {props.selectedReferences.length >= 15
                      ? 'Modifier limit reached.'
                      : 'Incompatible with this action.'}
                  </small>
                ) : null}
              </button>
            )
          })}
          {!props.modifiers.length ? <p>No owned Manual modifiers.</p> : null}
        </section>
      </div>
      <section aria-label="Command information" className={styles.information}>
        {root ? (
          <p>
            {root.label}:{' '}
            {root.descriptor.costs
              ? abilityCostDescription(root.descriptor.costs)
              : 'Cost unavailable'}
          </p>
        ) : null}
        {reversal ? (
          <p>
            <strong>Prepare: Paid.</strong> Preparation pays the complete Skill cost and starts its
            cooldown immediately. While armed, only cancellation is available; cancellation gives no
            refund and causes Reversal Strain.
          </p>
        ) : null}
        {prime ? (
          <p>
            <strong>Prime: Free.</strong> Priming locks the chosen set. The release uses its
            combined cost.
          </p>
        ) : null}
        {props.quote ? (
          <>
            <p>
              <strong>
                {reversal
                  ? 'Preparation cost'
                  : root?.descriptor.controlled
                    ? 'Release cost'
                    : 'Command cost'}
                :
              </strong>{' '}
              {props.quote.commandCosts
                .map((cost) => `${cost.amount} ${cost.resource.toUpperCase()}`)
                .join(' / ')}
            </p>
            {props.quote.commandCooldowns.map((clock, index) => (
              <p key={index}>
                {props.modifiers.find(
                  (choice) =>
                    choice.pin?.abilityId === clock.actionId &&
                    choice.pin.contentVersion === clock.contentVersion &&
                    choice.pin.behaviorId === clock.behaviorId,
                )?.label ??
                  props.publicNames?.find(
                    (name) =>
                      name.id === clock.actionId && name.contentVersion === clock.contentVersion,
                  )?.name ??
                  (root?.context.actionId === clock.actionId &&
                  root.context.rootContentVersion === clock.contentVersion
                    ? root.label
                    : 'Ability')}
                : {clock.ownerTurns} turns ·{' '}
                {clock.ticksRemaining ? `${clock.ticksRemaining} ticks remaining` : 'Ready'}
              </p>
            ))}
          </>
        ) : (
          <p role="status">
            {props.quotePending
              ? 'Checking the complete release cost…'
              : 'Choose a target for the complete release cost.'}
          </p>
        )}
        {props.selectedReferences.length ? (
          <p>
            Modifier order:{' '}
            {props.modifiers
              .filter((choice) => selected(choice, props.selectedReferences))
              .map((choice) => choice.label)
              .join(' → ')}
          </p>
        ) : null}
        {focused?.report ? (
          <>
            <h3>{focused.label}</h3>
            <AbilityParameters report={focused.report} />
          </>
        ) : null}
      </section>
    </div>
  )
}

export function BattleModifierPicker(props: BattleModifierPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const initialFocus = useCallback(
    () =>
      (props.selectedActionKey
        ? (panelRef.current?.querySelector<HTMLElement>('[role="checkbox"][aria-checked="true"]') ??
          panelRef.current?.querySelector<HTMLElement>('[role="checkbox"]'))
        : null) ??
      panelRef.current?.querySelector<HTMLElement>(
        '[data-modifier-list="actions"] [data-modifier-row]',
      ) ??
      null,
    [props.selectedActionKey],
  )
  return (
    <BattleInfoPopover
      label="Modifiers"
      title="Modifiers"
      trigger={
        <span>
          Modifiers{props.selectedReferences.length ? ` (${props.selectedReferences.length})` : ''}
          {props.binding ? ` [${formatCombatKeybind(props.binding)}]` : ''}
        </span>
      }
      panelWidth={640}
      triggerRef={props.triggerRef}
      initialFocus={initialFocus}
      consumeOutsideClick
      className={styles.trigger}
    >
      <BattleModifierPanel {...props} panelRef={panelRef} />
    </BattleInfoPopover>
  )
}
