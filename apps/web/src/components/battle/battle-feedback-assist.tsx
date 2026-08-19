'use client'

import { useEffect } from 'react'

interface BattleFeedbackAssistProps {
  playerName: string
  playerProfileImageUrl?: string | null
}

const EMOJI = ['⚔️', '🛡️', '✨', '🔥', '❄️', '💚', '👍', '😄', '🎯', '💬'] as const

function parseTilePosition(
  button: HTMLButtonElement,
): { x: number; y: number; elevation: number } | null {
  const label = button.getAttribute('aria-label') ?? ''
  const match = label.match(/^Tile\s+(\d+),\s*(\d+);.*?elevation\s+(-?\d+)/i)
  if (!match) return null
  return { x: Number(match[1]), y: Number(match[2]), elevation: Number(match[3]) }
}

function attackModeIsActive(): boolean {
  const instruction = document.querySelector<HTMLElement>('[data-testid="combat-mode-instruction"]')
  return (instruction?.textContent ?? '').toLowerCase().includes('basic attack')
}

function updateAttackRange(playerName: string) {
  const battlefield = document.querySelector<HTMLElement>('#battlefield')
  if (!battlefield) return
  const tiles = Array.from(
    battlefield.querySelectorAll<HTMLButtonElement>('button[aria-label^="Tile "]'),
  )
  for (const tile of tiles) delete tile.dataset.attackRange
  if (!attackModeIsActive()) return

  const playerTile = tiles.find((tile) =>
    (tile.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
  )
  const player = playerTile ? parseTilePosition(playerTile) : null
  if (!player) return

  for (const tile of tiles) {
    const candidate = parseTilePosition(tile)
    if (!candidate) continue
    const distance = Math.abs(candidate.x - player.x) + Math.abs(candidate.y - player.y)
    const reachable = distance === 1 && Math.abs(candidate.elevation - player.elevation) <= 1
    tile.dataset.attackRange = reachable ? 'legal' : 'illegal'
  }
}

function applyCustomPortrait(playerName: string, imageUrl: string | null | undefined) {
  if (!imageUrl) return
  const rail = Array.from(
    document.querySelectorAll<HTMLElement>('aside[aria-label$=" combat status"]'),
  ).find((candidate) => candidate.getAttribute('aria-label') === `${playerName} combat status`)
  const image = rail?.querySelector<HTMLImageElement>('button[aria-label^="Show "] img')
  if (!image || image.dataset.customProfileImage === imageUrl) return
  image.src = imageUrl
  image.removeAttribute('srcset')
  image.referrerPolicy = 'no-referrer'
  image.dataset.customProfileImage = imageUrl
}

function setControlledInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function enhanceChat() {
  const footer = document.querySelector<HTMLElement>('main[aria-busy] > footer')
  if (!footer) return
  const trigger = footer.querySelector<HTMLButtonElement>(':scope > div:first-child > button')
  if (trigger && trigger.dataset.a2ChatLabel !== 'ready') {
    trigger.dataset.a2ChatLabel = 'ready'
    for (const span of Array.from(trigger.querySelectorAll('span'))) span.remove()
  }

  const panel = footer.querySelector<HTMLElement>('[popover]')
  if (!panel || !panel.matches(':popover-open')) return
  const headingMeta = panel.querySelector<HTMLElement>(':scope > div:first-child > span')
  if (headingMeta) headingMeta.textContent = 'Battle channel'
  const input = panel.querySelector<HTMLInputElement>('form input')
  const form = input?.closest('form')
  if (!input || !form) return
  input.placeholder = 'Message…'

  if (!form.querySelector('[data-battle-emoji-trigger]')) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.battleEmojiTrigger = 'true'
    button.setAttribute('aria-label', 'Choose emoji')
    button.textContent = '☺'
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const current = form.querySelector<HTMLElement>('[data-battle-emoji-picker]')
      if (current) {
        current.remove()
        return
      }
      const picker = document.createElement('div')
      picker.dataset.battleEmojiPicker = 'true'
      picker.setAttribute('role', 'group')
      picker.setAttribute('aria-label', 'Emoji')
      for (const emoji of EMOJI) {
        const choice = document.createElement('button')
        choice.type = 'button'
        choice.textContent = emoji
        choice.setAttribute('aria-label', `Insert ${emoji}`)
        choice.addEventListener('click', (choiceEvent) => {
          choiceEvent.stopPropagation()
          setControlledInputValue(input, `${input.value}${emoji}`)
          input.focus()
          picker.remove()
        })
        picker.append(choice)
      }
      form.append(picker)
    })
    form.insertBefore(button, form.lastElementChild)
  }
}

export function BattleFeedbackAssist({
  playerName,
  playerProfileImageUrl,
}: BattleFeedbackAssistProps) {
  useEffect(() => {
    const refresh = () => {
      updateAttackRange(playerName)
      applyCustomPortrait(playerName, playerProfileImageUrl)
      enhanceChat()
    }

    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    function closeChatOnOutsidePointer(event: PointerEvent) {
      const footer = document.querySelector<HTMLElement>('main[aria-busy] > footer')
      const panel = footer?.querySelector<HTMLElement>('[popover]:popover-open')
      const trigger = footer?.querySelector<HTMLButtonElement>(':scope > div:first-child > button')
      if (!panel || !trigger || !(event.target instanceof Node)) return
      if (panel.contains(event.target) || trigger.contains(event.target)) return
      panel.querySelector<HTMLElement>('[data-battle-emoji-picker]')?.remove()
      trigger.click()
    }

    document.addEventListener('pointerdown', closeChatOnOutsidePointer, true)
    return () => {
      observer.disconnect()
      document.removeEventListener('pointerdown', closeChatOnOutsidePointer, true)
      for (const tile of Array.from(
        document.querySelectorAll<HTMLButtonElement>('#battlefield button[data-attack-range]'),
      )) {
        delete tile.dataset.attackRange
      }
    }
  }, [playerName, playerProfileImageUrl])

  return null
}
