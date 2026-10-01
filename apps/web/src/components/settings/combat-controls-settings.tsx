'use client'

import { PV1F_MOVEMENT_COST_PER_TERRAIN_POINT } from '@aurevane/game-core/combat/pv1f-skills'

import {
  COMBAT_KEYBIND_ACTIONS,
  DEFAULT_COMBAT_KEYBINDS,
  combatKeybindChord,
  formatCombatKeybind,
  parseCombatKeybindMap,
  type CombatKeybindAction,
  type CombatKeybindMap,
} from '@aurevane/validation/player/combat-controls'
import { useEffect, useMemo, useState } from 'react'

import styles from './combat-controls-settings.module.css'

interface CombatControlsSettingsProps {
  initialBindings: CombatKeybindMap
}

const ACTION_COPY: Record<CombatKeybindAction, { label: string; description: string }> = {
  inspect: { label: 'Inspect', description: 'Open optional terrain and combatant inspection.' },
  move: {
    label: 'Move',
    description: `Move within your allowance; normal tiles cost ${PV1F_MOVEMENT_COST_PER_TERRAIN_POINT} AP.`,
  },
  basicAttack: {
    label: 'Basic Attack',
    description: 'Select Basic Attack and preview a legal target.',
  },
  guard: {
    label: 'Guard',
    description: 'Select Guard and preview its effect.',
  },
  recover: {
    label: 'Recover',
    description: 'Open the secondary recovery command.',
  },
  skill1: {
    label: 'Discipline Skill 1',
    description: 'Preview a legal target for your first committed Discipline Skill.',
  },
  skill2: {
    label: 'Discipline Skill 2',
    description: 'Preview a legal target for your second committed Discipline Skill.',
  },
  skill3: {
    label: 'Discipline Skill 3',
    description: 'Preview a legal target for your third committed Discipline Skill.',
  },
  skill4: {
    label: 'Discipline Skill 4',
    description: 'Preview a legal target for your fourth committed Discipline Skill.',
  },
  essence: {
    label: 'Essence / Resonance',
    description: 'Select actionable Essence; inspect passive Essence or Resonance.',
  },
  supernatural: {
    label: 'Severance / Ascension',
    description: 'Inspect the future path slot without issuing a battle command.',
  },
  endTurn: {
    label: 'Finish Turn',
    description: 'Press twice to keep facing, or choose a direction to finish.',
  },
  confirm: {
    label: 'Execute selected action',
    description: 'Optional keyboard execution of the current legal preview.',
  },
  cancel: { label: 'Cancel Action', description: 'Clear current planning without committing.' },
  faceNorth: { label: 'Face North', description: 'Finish the turn facing north.' },
  faceWest: { label: 'Face West', description: 'Finish the turn facing west.' },
  faceSouth: { label: 'Face South', description: 'Finish the turn facing south.' },
  faceEast: { label: 'Face East', description: 'Finish the turn facing east.' },
  nextTarget: { label: 'Next target', description: 'Cycle attack targets while targeting.' },
  previousTarget: { label: 'Previous target', description: 'Reverse-cycle attack targets.' },
  combatLog: { label: 'Combat Log', description: 'Open or close committed battle history.' },
}

function cloneBindings(bindings: CombatKeybindMap): CombatKeybindMap {
  return Object.fromEntries(
    COMBAT_KEYBIND_ACTIONS.map((action) => [action, { ...bindings[action] }]),
  ) as CombatKeybindMap
}

function modifierOnly(code: string): boolean {
  return /^(Shift|Control|Alt|Meta)(Left|Right)?$/.test(code)
}

export function CombatControlsSettings({ initialBindings }: CombatControlsSettingsProps) {
  const [draft, setDraft] = useState<CombatKeybindMap>(() => cloneBindings(initialBindings))
  const [saved, setSaved] = useState<CombatKeybindMap>(() => cloneBindings(initialBindings))
  const [capturing, setCapturing] = useState<CombatKeybindAction | null>(null)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const changed = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved])

  useEffect(() => {
    if (!capturing) return
    const capturedAction = capturing

    function capture(event: KeyboardEvent) {
      if (!event.code || modifierOnly(event.code)) return
      event.preventDefault()
      event.stopPropagation()

      const nextBinding = { code: event.code, shift: event.shiftKey }
      const nextChord = combatKeybindChord(nextBinding)
      const conflict = COMBAT_KEYBIND_ACTIONS.find(
        (action) => action !== capturedAction && combatKeybindChord(draft[action]) === nextChord,
      )

      if (conflict) {
        setError(`${nextChord} is already assigned to ${ACTION_COPY[conflict].label}.`)
        setNotice(null)
        setCapturing(null)
        return
      }

      const candidate = { ...draft, [capturedAction]: nextBinding } as CombatKeybindMap
      const parsed = parseCombatKeybindMap(candidate)
      if (!parsed) {
        setError('That key could not be assigned safely.')
        setNotice(null)
        setCapturing(null)
        return
      }

      setDraft(parsed)
      setError(null)
      setNotice(
        `${ACTION_COPY[capturedAction].label} is now ${formatCombatKeybind(nextBinding)}. Save to keep it on your account.`,
      )
      setCapturing(null)
    }

    window.addEventListener('keydown', capture, true)
    return () => window.removeEventListener('keydown', capture, true)
  }, [capturing, draft])

  async function save() {
    if (pending) return
    setPending(true)
    setError(null)
    setNotice('Saving account controls…')

    try {
      const response = await fetch('/api/account/controls', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ combatKeybinds: draft }),
      })
      const body = (await response.json()) as {
        controls?: { combatKeybinds?: CombatKeybindMap }
        error?: { message?: string }
      }
      if (!response.ok || !body.controls?.combatKeybinds) {
        throw new Error(body.error?.message ?? 'Account controls could not be saved.')
      }
      const persisted = cloneBindings(body.controls.combatKeybinds)
      setDraft(persisted)
      setSaved(persisted)
      setNotice('Combat controls saved to your account.')
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Account controls could not be saved.',
      )
      setNotice(null)
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      className={styles.panel}
      data-character-concept="controls"
      data-av-surface="moonstone"
      aria-label="Combat controls settings"
    >
      <p className={styles.intro}>
        Change a battle key, then save. Preview actions before choosing a legal target. The server
        validates every action.
      </p>

      <div className={styles.grid}>
        {COMBAT_KEYBIND_ACTIONS.map((action) => (
          <div className={styles.row} key={action} data-testid={`keybind-${action}`}>
            <div>
              <strong>{ACTION_COPY[action].label}</strong>
              <small id={`keybind-${action}-description`}>{ACTION_COPY[action].description}</small>
            </div>
            <button
              type="button"
              className={styles.button}
              aria-label={`Change ${ACTION_COPY[action].label} keybind`}
              aria-describedby={`keybind-${action}-key keybind-${action}-description`}
              onClick={() => {
                setCapturing(action)
                setError(null)
                setNotice(
                  `Press the new key for ${ACTION_COPY[action].label}. Escape itself can be assigned when capturing.`,
                )
              }}
              disabled={pending || capturing !== null}
            >
              <kbd className={styles.key} id={`keybind-${action}-key`}>
                {formatCombatKeybind(draft[action])}
              </kbd>
              <span>{capturing === action ? 'Press…' : 'Change'}</span>
            </button>
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.feedback}>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className={styles.notice} role="status">
              {notice}
            </p>
          ) : null}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setDraft(cloneBindings(DEFAULT_COMBAT_KEYBINDS))
              setCapturing(null)
              setError(null)
              setNotice(
                'Default combat bindings restored locally. Save to keep them on your account.',
              )
            }}
            disabled={pending}
          >
            Reset defaults
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => void save()}
            disabled={pending || !changed}
          >
            {pending ? 'Saving…' : 'Save Controls'}
          </button>
        </div>
      </div>
    </section>
  )
}
