'use client'

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
    label: 'Movement Skill',
    description:
      'Activate the currently equipped Movement skill. With Move equipped, a normal tile costs 25 AP.',
  },
  basicAttack: {
    label: 'Attack Skill',
    description: 'Activate the currently equipped Attack skill and enter its targeting or preview flow.',
  },
  guard: {
    label: 'Defense Skill',
    description: 'Activate the currently equipped Defense skill and enter its preview flow.',
  },
  recover: {
    label: 'Heal Skill',
    description: 'Activate the currently equipped Heal skill, such as HP Recovery or MP Recovery.',
  },
  endTurn: {
    label: 'Finish Turn',
    description: 'Choose final facing; the chosen direction immediately ends the turn.',
  },
  confirm: {
    label: 'Confirm Action',
    description: 'Commit the current legal move or action preview.',
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
    <section className={styles.panel} aria-label="Combat controls settings">
      <p className={styles.intro}>
        Keybinds follow your account and trigger the same visible cockpit slots you can click.
        Movement, Attack, Defense, and Heal bindings stay with their slot when you switch the
        equipped skill. They never bypass battle previews, confirmation, legality checks, or server
        authority. When Move is the equipped Movement skill and active, WASD and the arrow keys
        select adjacent destinations; Enter confirms a legal proposal.
      </p>

      <div className={styles.grid}>
        {COMBAT_KEYBIND_ACTIONS.map((action) => (
          <div className={styles.row} key={action} data-testid={`keybind-${action}`}>
            <div>
              <strong>{ACTION_COPY[action].label}</strong>
              <small>{ACTION_COPY[action].description}</small>
            </div>
            <kbd className={styles.key}>{formatCombatKeybind(draft[action])}</kbd>
            <button
              type="button"
              className={styles.button}
              aria-label={`Change ${ACTION_COPY[action].label} keybind`}
              onClick={() => {
                setCapturing(action)
                setError(null)
                setNotice(
                  `Press the new key for ${ACTION_COPY[action].label}. Escape itself can be assigned when capturing.`,
                )
              }}
              disabled={pending || capturing !== null}
            >
              {capturing === action ? 'Press a key…' : 'Change'}
            </button>
          </div>
        ))}
      </div>

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
    </section>
  )
}
