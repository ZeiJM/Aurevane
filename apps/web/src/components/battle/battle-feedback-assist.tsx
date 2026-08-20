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

function combatInstruction(): string {
  return (
    document.querySelector<HTMLElement>('[data-testid="combat-mode-instruction"]')?.textContent ?? ''
  ).toLowerCase()
}

function attackModeIsActive(): boolean {
  return combatInstruction().includes('basic attack')
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

function syncTargetSemantics(playerName: string) {
  const battlefield = document.querySelector<HTMLElement>('#battlefield')
  if (!battlefield) return
  const tiles = Array.from(
    battlefield.querySelectorAll<HTMLButtonElement>('button[aria-label^="Tile "]'),
  )
  for (const tile of tiles) delete tile.dataset.targetRelation

  const instruction = combatInstruction()
  const selfTargeting = instruction.includes('guard') || instruction.includes('recover')
  if (selfTargeting) {
    const playerTile = tiles.find((tile) =>
      (tile.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
    )
    if (playerTile) playerTile.dataset.targetRelation = 'friendly'
    return
  }

  if (!instruction.includes('basic attack')) return

  for (const tile of tiles) {
    const label = tile.getAttribute('aria-label') ?? ''
    if (!label.includes('occupied by Recruit')) continue
    tile.dataset.targetRelation = tile.dataset.attackRange === 'legal' ? 'enemy' : 'illegal'
  }
}

function syncActionEconomyBar() {
  const track = document.querySelector<HTMLElement>(
    '[role="progressbar"][aria-label="Action Economy remaining"]',
  )
  if (!track) return
  const remaining = Number(track.getAttribute('aria-valuenow'))
  if (!Number.isFinite(remaining)) return
  const committed = track.querySelector<HTMLElement>(':scope > span:first-child')
  if (committed) committed.style.width = `${Math.max(0, Math.min(100, remaining))}%`
}

function applyCustomPortrait(playerName: string, imageUrl: string | null | undefined) {
  if (!imageUrl) return
  const rail = combatantRail(playerName)
  const portraitButton = rail?.querySelector<HTMLButtonElement>('button[aria-label^="Show "]')
  if (!portraitButton) return

  const existing = portraitButton.querySelector<HTMLImageElement>('img[data-custom-profile-image]')
  if (existing?.dataset.customProfileImage === imageUrl) return

  const source = portraitButton.firstElementChild
  if (!source) return

  const image = document.createElement('img')
  image.src = imageUrl
  image.alt = `${playerName} portrait`
  image.loading = 'eager'
  image.referrerPolicy = 'no-referrer'
  image.dataset.customProfileImage = imageUrl
  source.replaceWith(image)
}

function combatantRail(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>('aside[aria-label$=" combat status"]')).find(
      (candidate) => candidate.getAttribute('aria-label') === `${name} combat status`,
    ) ?? null
  )
}

function combatantTile(name: string): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]'),
    ).find((tile) => (tile.getAttribute('aria-label') ?? '').includes(`occupied by ${name}`)) ??
    null
  )
}

function syncMapTokenPortrait(
  name: string,
  team: 'player' | 'opponent',
  customImageUrl?: string | null,
) {
  const tile = combatantTile(name)
  const unit = tile?.querySelector<HTMLElement>(':scope > span:not(.tileMeta):last-child')
  if (!unit) return

  const existing = unit.querySelector<HTMLElement>('[data-map-token-portrait]')
  let source: HTMLElement | null = null
  let sourceSignature = ''

  if (customImageUrl) {
    const image = document.createElement('img')
    image.src = customImageUrl
    image.alt = ''
    image.referrerPolicy = 'no-referrer'
    image.dataset.customProfileImage = customImageUrl
    source = image
    sourceSignature = `${team}:custom:${customImageUrl}`
  } else {
    const rail = combatantRail(name)
    const portraitButton = rail?.querySelector<HTMLButtonElement>('button[aria-label^="Show "]')
    if (!portraitButton) return
    const candidate = portraitButton.firstElementChild
    if (!(candidate instanceof HTMLElement)) return
    source = candidate
    const sourceImage = source instanceof HTMLImageElement ? source.src : null
    sourceSignature = `${team}:${source.tagName}:${sourceImage ?? source.textContent ?? ''}`
  }

  if (existing?.dataset.mapTokenSignature === sourceSignature) return

  existing?.remove()
  const frame = document.createElement('span')
  frame.dataset.mapTokenPortrait = 'true'
  frame.dataset.mapTokenTeam = team
  frame.dataset.mapTokenSignature = sourceSignature
  frame.setAttribute('aria-hidden', 'true')

  const clone = source.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  clone.setAttribute('aria-hidden', 'true')
  if (clone instanceof HTMLImageElement) {
    clone.referrerPolicy = 'no-referrer'
    clone.alt = ''
  }
  frame.append(clone)
  unit.prepend(frame)
  unit.dataset.mapPortraitReady = 'true'
}

function syncMapPortraits(playerName: string, playerProfileImageUrl?: string | null) {
  syncMapTokenPortrait(playerName, 'player', playerProfileImageUrl)
  syncMapTokenPortrait('Recruit', 'opponent')
}

function fitBattlefieldBoard() {
  const battlefield = document.querySelector<HTMLElement>('#battlefield')
  const viewport = battlefield?.firstElementChild
  const board = viewport?.firstElementChild
  if (!(viewport instanceof HTMLElement) || !(board instanceof HTMLElement)) return

  const tiles = Array.from(
    board.querySelectorAll<HTMLButtonElement>('button[aria-label^="Tile "]'),
  )
  if (tiles.length === 0) return

  let columns = 0
  let rows = 0
  for (const tile of tiles) {
    const position = parseTilePosition(tile)
    if (!position) continue
    columns = Math.max(columns, position.x)
    rows = Math.max(rows, position.y)
  }
  if (columns <= 0 || rows <= 0) return

  const viewportStyle = window.getComputedStyle(viewport)
  const horizontalPadding =
    Number.parseFloat(viewportStyle.paddingLeft) + Number.parseFloat(viewportStyle.paddingRight)
  const verticalPadding =
    Number.parseFloat(viewportStyle.paddingTop) + Number.parseFloat(viewportStyle.paddingBottom)
  const availableWidth = Math.max(1, viewport.clientWidth - horizontalPadding)
  const availableHeight = Math.max(1, viewport.clientHeight - verticalPadding)
  const ratio = columns / rows

  let fittedWidth = availableWidth
  let fittedHeight = fittedWidth / ratio
  if (fittedHeight > availableHeight) {
    fittedHeight = availableHeight
    fittedWidth = fittedHeight * ratio
  }

  board.style.width = `${Math.floor(fittedWidth)}px`
  board.style.height = `${Math.floor(fittedHeight)}px`
  board.style.maxWidth = '100%'
  board.style.maxHeight = '100%'
  board.style.margin = 'auto'
  board.dataset.boardAutoFit = `${columns}x${rows}`
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
  if (headingMeta && headingMeta.textContent !== 'Battle channel') {
    headingMeta.textContent = 'Battle channel'
  }
  const input = panel.querySelector<HTMLInputElement>('form input')
  const form = input?.closest('form')
  if (!input || !form) return
  if (input.placeholder !== 'Message…') input.placeholder = 'Message…'

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
    let frame = 0
    const refresh = () => {
      frame = 0
      updateAttackRange(playerName)
      syncTargetSemantics(playerName)
      syncActionEconomyBar()
      applyCustomPortrait(playerName, playerProfileImageUrl)
      syncMapPortraits(playerName, playerProfileImageUrl)
      fitBattlefieldBoard()
      enhanceChat()
    }
    const scheduleRefresh = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(refresh)
    }

    refresh()
    const observer = new MutationObserver(scheduleRefresh)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const battlefield = document.querySelector<HTMLElement>('#battlefield')
    const viewport = battlefield?.firstElementChild
    const resizeObserver = new ResizeObserver(scheduleRefresh)
    if (battlefield) resizeObserver.observe(battlefield)
    if (viewport instanceof HTMLElement) resizeObserver.observe(viewport)
    window.addEventListener('resize', scheduleRefresh)

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
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleRefresh)
      if (frame !== 0) window.cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', closeChatOnOutsidePointer, true)
      for (const tile of Array.from(
        document.querySelectorAll<HTMLButtonElement>('#battlefield button[data-attack-range]'),
      )) {
        delete tile.dataset.attackRange
        delete tile.dataset.targetRelation
      }
      for (const portrait of Array.from(
        document.querySelectorAll<HTMLElement>('[data-map-token-portrait]'),
      )) {
        portrait.remove()
      }
    }
  }, [playerName, playerProfileImageUrl])

  return null
}
