'use client'

import { useEffect } from 'react'

import styles from './battle-feedback-assist.module.css'

interface BattleFeedbackAssistProps {
  playerName: string
  playerProfileImageUrl?: string | null
}

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

function moveModeIsActive(): boolean {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
  )
  return buttons.some(
    (button) =>
      button.querySelector('strong')?.textContent?.trim() === 'Move' &&
      `${button.className}`.includes('commandActive'),
  )
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
    if (distance !== 1) continue

    const label = tile.getAttribute('aria-label') ?? ''
    const elevationLegal = Math.abs(candidate.elevation - player.elevation) <= 1
    const enemyPresent = label.includes('occupied by Recruit')
    tile.dataset.attackRange = elevationLegal && enemyPresent ? 'legal' : 'illegal'
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
    if (!tile.dataset.attackRange) continue
    tile.dataset.targetRelation = tile.dataset.attackRange === 'legal' ? 'enemy' : 'illegal'
  }
}

function setLegendEntry(
  entry: HTMLElement,
  label: string,
  detail: string,
  relation: 'friendly' | 'enemy' | 'illegal',
) {
  const heading = document.createElement('b')
  heading.textContent = label
  entry.replaceChildren(heading, document.createTextNode(` ${detail}`))
  entry.dataset.targetLegend = relation
}

function syncTargetLegend() {
  const battlefield = document.querySelector<HTMLElement>('#battlefield')
  const legend = battlefield?.lastElementChild
  if (!(legend instanceof HTMLElement) || legend.dataset.targetLegendReady === 'true') return

  const entries = Array.from(legend.querySelectorAll<HTMLElement>(':scope > span'))
  const green = entries.find((entry) => entry.textContent?.includes('Green'))
  const red = entries.find((entry) => entry.textContent?.includes('Red'))
  if (!green || !red) return

  setLegendEntry(green, 'Green', 'friendly / reachable', 'friendly')
  setLegendEntry(red, 'Red', 'unavailable', 'illegal')

  const orange = document.createElement('span')
  setLegendEntry(orange, 'Orange', 'legal enemy target', 'enemy')
  legend.insertBefore(orange, red)
  legend.dataset.targetLegendReady = 'true'
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

function emojiStorageKey(playerName: string): string {
  return `aurevane:battle-recent-emojis:${encodeURIComponent(playerName)}`
}

function extractEmoji(text: string): string[] {
  return (
    text.match(
      /\p{Extended_Pictographic}(?:\uFE0F)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?(?:\p{Emoji_Modifier})?)*/gu,
    ) ?? []
  )
}

function readRecentEmoji(playerName: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(emojiStorageKey(playerName)) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string').slice(0, 8)
  } catch {
    return []
  }
}

function rememberRecentEmoji(playerName: string, text: string) {
  const used = extractEmoji(text)
  if (used.length === 0) return

  let recent = readRecentEmoji(playerName)
  for (const emoji of used) {
    recent = [emoji, ...recent.filter((candidate) => candidate !== emoji)].slice(0, 8)
  }

  try {
    localStorage.setItem(emojiStorageKey(playerName), JSON.stringify(recent))
  } catch {
    // Chat remains fully usable if local recent-emoji storage is unavailable.
  }
}

function setControlledInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function installDragHandle(panel: HTMLElement, handle: HTMLElement) {
  if (handle.dataset.dragReady === 'true') return
  handle.dataset.dragReady = 'true'

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('button, input, textarea, select, a')) return

    event.preventDefault()
    const rect = panel.getBoundingClientRect()
    const offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top
    panel.style.inset = 'auto'
    panel.style.left = `${rect.left}px`
    panel.style.top = `${rect.top}px`
    panel.style.width = `${rect.width}px`
    panel.style.height = `${rect.height}px`
    panel.style.margin = '0'
    panel.style.transform = 'none'

    const move = (moveEvent: PointerEvent) => {
      const current = panel.getBoundingClientRect()
      const maxLeft = Math.max(4, window.innerWidth - current.width - 4)
      const maxTop = Math.max(4, window.innerHeight - current.height - 4)
      panel.style.left = `${Math.min(maxLeft, Math.max(4, moveEvent.clientX - offsetX))}px`
      panel.style.top = `${Math.min(maxTop, Math.max(4, moveEvent.clientY - offsetY))}px`
    }

    const finish = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish, { once: true })
    window.addEventListener('pointercancel', finish, { once: true })
  })
}

function buildEmojiPicker(form: HTMLFormElement, input: HTMLInputElement, playerName: string) {
  form.querySelector<HTMLElement>('[data-battle-emoji-picker]')?.remove()

  const picker = document.createElement('div')
  picker.dataset.battleEmojiPicker = 'true'
  picker.setAttribute('role', 'group')
  picker.setAttribute('aria-label', 'Recent emoji')

  const recent = readRecentEmoji(playerName)
  if (recent.length === 0) {
    const empty = document.createElement('span')
    empty.dataset.emptyRecentEmoji = 'true'
    empty.textContent = 'Use an emoji in chat to add it here.'
    picker.append(empty)
  } else {
    for (const emoji of recent) {
      const choice = document.createElement('button')
      choice.type = 'button'
      choice.textContent = emoji
      choice.setAttribute('aria-label', `Insert recent emoji ${emoji}`)
      choice.addEventListener('click', (choiceEvent) => {
        choiceEvent.stopPropagation()
        setControlledInputValue(input, `${input.value}${emoji}`)
        input.focus()
        picker.remove()
      })
      picker.append(choice)
    }
  }

  form.append(picker)
}

function enhanceChat(playerName: string) {
  const footer = document.querySelector<HTMLElement>('main[aria-busy] > footer')
  if (!footer) return
  const trigger = footer.querySelector<HTMLButtonElement>(':scope > div:first-child > button')
  if (trigger && trigger.dataset.a2ChatLabel !== 'ready') {
    trigger.dataset.a2ChatLabel = 'ready'
    for (const span of Array.from(trigger.querySelectorAll('span'))) span.remove()
  }

  const panel = footer.querySelector<HTMLElement>('[popover]')
  if (!panel || !panel.matches(':popover-open')) return
  panel.dataset.floatingChat = 'true'

  const heading = panel.firstElementChild
  if (heading instanceof HTMLElement) {
    heading.dataset.chatDragHandle = 'true'
    installDragHandle(panel, heading)
  }

  const headingMeta = panel.querySelector<HTMLElement>(':scope > div:first-child > span')
  if (headingMeta && headingMeta.textContent !== 'Battle channel') {
    headingMeta.textContent = 'Battle channel'
  }

  const input = panel.querySelector<HTMLInputElement>('form input')
  const form = input?.closest('form')
  if (!input || !form) return
  if (input.placeholder !== 'Message…') input.placeholder = 'Message…'

  if (form.dataset.recentEmojiCapture !== 'true') {
    form.dataset.recentEmojiCapture = 'true'
    form.addEventListener(
      'submit',
      () => {
        rememberRecentEmoji(playerName, input.value)
      },
      true,
    )
  }

  if (!form.querySelector('[data-battle-emoji-trigger]')) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.battleEmojiTrigger = 'true'
    button.setAttribute('aria-label', 'Recent emoji')
    button.textContent = '☺'
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const current = form.querySelector<HTMLElement>('[data-battle-emoji-picker]')
      if (current) {
        current.remove()
        return
      }
      buildEmojiPicker(form, input, playerName)
    })
    form.insertBefore(button, form.lastElementChild)
  }
}

function syncCombatantDetailDismissal() {
  const closeButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[aria-label="Close combatant details"]'),
  )

  for (const closeButton of closeButtons) {
    const popup = closeButton.parentElement
    if (!popup || popup.getAttribute('role') === 'dialog') continue
    closeButton.hidden = true
    closeButton.tabIndex = -1
    popup.dataset.clickOffCombatantDetails = 'true'
  }
}

function resetMoveProjectionByClick(event: PointerEvent, playerName: string): boolean {
  if (!moveModeIsActive() || !(event.target instanceof Element)) return false
  const tile = event.target.closest<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]')
  if (!tile || !(tile.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`)) {
    return false
  }

  const hasProjectedPath = Boolean(document.querySelector('#battlefield [data-board-auto-fit] button span'))
  const instruction = combatInstruction()
  if (!hasProjectedPath || !instruction.includes('path ready')) return false

  const moveButton = Array.from(
    document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
  ).find((button) => button.querySelector('strong')?.textContent?.trim() === 'Move')
  if (!moveButton) return false

  event.preventDefault()
  event.stopImmediatePropagation()
  moveButton.click()
  tile.focus({ preventScroll: true })
  return true
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
      syncTargetLegend()
      syncActionEconomyBar()
      applyCustomPortrait(playerName, playerProfileImageUrl)
      syncMapPortraits(playerName, playerProfileImageUrl)
      fitBattlefieldBoard()
      enhanceChat(playerName)
      syncCombatantDetailDismissal()
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

    function handleDocumentPointer(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (resetMoveProjectionByClick(event, playerName)) return

      const emojiPicker = document.querySelector<HTMLElement>('[data-battle-emoji-picker]')
      const emojiTrigger = document.querySelector<HTMLElement>('[data-battle-emoji-trigger]')
      if (
        emojiPicker &&
        !emojiPicker.contains(event.target) &&
        !emojiTrigger?.contains(event.target)
      ) {
        emojiPicker.remove()
      }

      const popup = document.querySelector<HTMLElement>('[data-click-off-combatant-details]')
      const closeButton = popup?.querySelector<HTMLButtonElement>(
        '[aria-label="Close combatant details"]',
      )
      const rail = popup?.closest('aside[aria-label$=" combat status"]')
      const portraitTrigger = rail?.querySelector<HTMLButtonElement>('button[aria-label^="Show "]')
      if (
        popup &&
        closeButton &&
        !popup.contains(event.target) &&
        !portraitTrigger?.contains(event.target)
      ) {
        closeButton.click()
      }
    }

    document.addEventListener('pointerdown', handleDocumentPointer, true)
    return () => {
      observer.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleRefresh)
      if (frame !== 0) window.cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', handleDocumentPointer, true)
      for (const tile of Array.from(
        document.querySelectorAll<HTMLButtonElement>('#battlefield button'),
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

  return <span className={styles.scope} hidden aria-hidden="true" />
}
