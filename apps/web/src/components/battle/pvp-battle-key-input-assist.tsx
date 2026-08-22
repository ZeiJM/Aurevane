'use client'

import { useEffect } from 'react'

const BATTLE_KEY_PLACEHOLDER = 'AVB-0000-0000'

function formatPvpBattleKeyInput(value: string): string {
  const compact = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 11)

  if (compact.length <= 3) return compact
  if (compact.length <= 7) return `${compact.slice(0, 3)}-${compact.slice(3)}`
  return `${compact.slice(0, 3)}-${compact.slice(3, 7)}-${compact.slice(7)}`
}

function isBattleKeyInput(target: EventTarget | null): target is HTMLInputElement {
  return (
    target instanceof HTMLInputElement &&
    target.getAttribute('aria-label') === 'Battle Key' &&
    target.placeholder === BATTLE_KEY_PLACEHOLDER
  )
}

function configureBattleKeyInput(input: HTMLInputElement) {
  input.autocapitalize = 'characters'
  input.autocomplete = 'off'
  input.spellcheck = false
  input.maxLength = 13
}

export function PvpBattleKeyInputAssist() {
  useEffect(() => {
    const nativeValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set

    function handleFocus(event: FocusEvent) {
      if (!isBattleKeyInput(event.target)) return
      configureBattleKeyInput(event.target)
    }

    function handleInput(event: Event) {
      if (!isBattleKeyInput(event.target)) return

      const input = event.target
      configureBattleKeyInput(input)
      const formatted = formatPvpBattleKeyInput(input.value)
      if (formatted === input.value) return

      if (nativeValueSetter) nativeValueSetter.call(input, formatted)
      else input.value = formatted

      input.setSelectionRange(formatted.length, formatted.length)
    }

    document.addEventListener('focusin', handleFocus, true)
    document.addEventListener('input', handleInput, true)
    return () => {
      document.removeEventListener('focusin', handleFocus, true)
      document.removeEventListener('input', handleInput, true)
    }
  }, [])

  return null
}
