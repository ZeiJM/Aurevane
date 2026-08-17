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
  inspect: { label: 'Inspect', description: 'Return to neutral inspection mode.' },
  move: { label: 'Move', description: 'Enter movement planning without spending the Action.' },
  basicAttack: { label: 'Basic Attack', description: 'Enter normal Basic Attack targeting.' },
  guard: { label: 'Guard', description: 'Preview the defensive Guard action.' },
  endTurn: {
    label: 'End Turn preparation',
    description: 'Open final-facing review before commit.',
  },
  confirm: { label: 'Confirm', description: 'Commit the current legal preview.' },
  cancel: { label: 'Cancel / Back', description: 'Clear current planning without committing.' },
  faceNorth: { label: 'Face North', description: 'Choose north in facing context.' },
  faceWest: { label: 'Face West', description: 'Choose west in facing context.' },
  faceSouth: { label: 'Face South', description: 'Choose south in facing context.' },
  faceEast: { label: 'Face East', description: 'Choose east in facing context.' },
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
        These bindings follow your account. They only choose the same visible combat controls you
        can click; they never bypass preview, confirmation, legality, version checks, or server
        authority. Arrow keys remain an alternate navigation/facing aid where the battle UI supports
        them.
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
          Reset combat defaults
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={() => void save()}
          disabled={pending || !changed}
        >
          {pending ? 'Saving…' : 'Save account controls'}
        </button>
      </div>
    </section>
  )
}
