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
import { useEffect, useRef, useState } from 'react'

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function eventChord(event: KeyboardEvent): string {
  return combatKeybindChord({ code: event.code, shift: event.shiftKey })
}

function tilePosition(button: HTMLButtonElement): { x: number; y: number } | null {
  const match = button.getAttribute('aria-label')?.match(/^Tile\s+(\d+),\s*(\d+)/i)
  if (!match) return null
  return { x: Number(match[1]) - 1, y: Number(match[2]) - 1 }
}

function tileElevation(button: HTMLButtonElement): number | null {
  const match = button.getAttribute('aria-label')?.match(/;\s*elevation\s+(-?\d+)/i)
  if (!match) return null
  const value = Number(match[1])
  return Number.isSafeInteger(value) ? value : null
}

function positionKey(position: { x: number; y: number }): string {
  return `${position.x}:${position.y}`
}

function positionsEqual(left: { x: number; y: number }, right: { x: number; y: number }): boolean {
  return left.x === right.x && left.y === right.y
}

function battleTiles(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]'),
  )
}

function playerTile(playerName: string): HTMLButtonElement | null {
  return (
    battleTiles().find((button) =>
      (button.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
    ) ?? null
  )
}

function legalVisibleTargetButtons(playerName: string): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  ).filter((button) => {
    if (button.disabled) return false
    const label = button.getAttribute('aria-label') ?? ''
    return !label.includes(`occupied by ${playerName}`)
  })
}

function commandButton(...labels: string[]): HTMLButtonElement | null {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
  )
  return (
    buttons.find((button) =>
      labels.includes(button.querySelector('strong')?.textContent?.trim() ?? ''),
    ) ?? null
  )
}

function commandIsActive(...labels: string[]): boolean {
  const button = commandButton(...labels)
  return Boolean(
    button &&
    (button.hasAttribute('data-active') ||
      button.dataset.battleActive === 'true' ||
      `${button.className}`.includes('commandActive')),
  )
}

function attackModeIsActive(): boolean {
  return commandIsActive('Basic Attack')
}

function moveModeIsActive(): boolean {
  return commandIsActive('Move')
}

function facingModeIsActive(): boolean {
  return Boolean(
    document.querySelector<HTMLButtonElement>('[aria-label="Face north"]:not(:disabled)') &&
    document.querySelector<HTMLButtonElement>('[aria-label="Face south"]:not(:disabled)') &&
    document.querySelector<HTMLButtonElement>('[aria-label="Face west"]:not(:disabled)') &&
    document.querySelector<HTMLButtonElement>('[aria-label="Face east"]:not(:disabled)'),
  )
}

function planningButton(text: string): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('footer button'))
  return buttons.find((button) => button.textContent?.includes(text)) ?? null
}

function combatLogButton(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>('header button')).find((button) =>
      button.textContent?.includes('Combat Log'),
    ) ?? null
  )
}

function configuredAction(bindings: CombatKeybindMap, chord: string): CombatKeybindAction | null {
  return (
    COMBAT_KEYBIND_ACTIONS.find((action) => combatKeybindChord(bindings[action]) === chord) ?? null
  )
}

function isSharedCategoryAction(action: CombatKeybindAction): boolean {
  return action === 'move' || action === 'basicAttack' || action === 'guard' || action === 'recover'
}

function defaultAction(chord: string): CombatKeybindAction | null {
  return (
    COMBAT_KEYBIND_ACTIONS.find(
      (action) => combatKeybindChord(DEFAULT_COMBAT_KEYBINDS[action]) === chord,
    ) ?? null
  )
}

function directionForCode(code: string): { dx: number; dy: number } | null {
  if (code === 'ArrowUp' || code === 'KeyW') return { dx: 0, dy: -1 }
  if (code === 'ArrowDown' || code === 'KeyS') return { dx: 0, dy: 1 }
  if (code === 'ArrowLeft' || code === 'KeyA') return { dx: -1, dy: 0 }
  if (code === 'ArrowRight' || code === 'KeyD') return { dx: 1, dy: 0 }
  return null
}

function chooseFacing(direction: { dx: number; dy: number }): boolean {
  const label =
    direction.dy < 0
      ? 'Face north'
      : direction.dy > 0
        ? 'Face south'
        : direction.dx < 0
          ? 'Face west'
          : 'Face east'
  const button = document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)
  if (!button || button.disabled) return false
  button.click()
  return true
}

function syncVisibleCommandLabels(bindings: CombatKeybindMap) {
  const commands: readonly [CombatKeybindAction, readonly string[]][] = [
    ['inspect', ['Inspect']],
    ['move', ['Move']],
    ['basicAttack', ['Basic Attack']],
    ['guard', ['Guard']],
    ['recover', ['Recover', 'HP Recovery', 'MP Recovery']],
    ['endTurn', ['Finish Turn', 'End Turn', 'Facing / End Turn']],
  ]
  for (const [action, labels] of commands) {
    const button = commandButton(...labels)
    const badge = button?.querySelector<HTMLElement>(':scope > span')
    if (!badge) continue
    const binding = formatCombatKeybind(bindings[action])
    const label = action === 'move' || action === 'endTurn' ? `${binding} · WASD` : binding
    if (badge.textContent !== label) badge.textContent = label
  }
}

function syncAttackRangeMarkers(playerName: string) {
  const tiles = battleTiles()
  if (!attackModeIsActive()) {
    for (const tile of tiles) tile.removeAttribute('data-attack-range')
    return
  }

  const actorTile = playerTile(playerName)
  const actorPosition = actorTile ? tilePosition(actorTile) : null
  const actorElevation = actorTile ? tileElevation(actorTile) : null
  const attackAvailable = !commandButton('Basic Attack')?.disabled

  for (const tile of tiles) {
    const position = tilePosition(tile)
    if (!actorPosition || !position) {
      tile.dataset.attackRange = 'neutral'
      continue
    }

    const distance = Math.abs(position.x - actorPosition.x) + Math.abs(position.y - actorPosition.y)
    if (distance !== 1) {
      tile.dataset.attackRange = 'neutral'
      continue
    }

    const label = tile.getAttribute('aria-label') ?? ''
    const elevation = tileElevation(tile)
    const containsEnemy =
      label.includes('occupied by ') && !label.includes(`occupied by ${playerName}`)
    const elevationLegal =
      actorElevation !== null && elevation !== null && Math.abs(elevation - actorElevation) <= 1
    tile.dataset.attackRange =
      attackAvailable && containsEnemy && elevationLegal ? 'legal' : 'illegal'
  }
}

function repeatableCommand(label: string): HTMLButtonElement | null {
  if (!['Move', 'Basic Attack', 'Recover', 'HP Recovery', 'MP Recovery'].includes(label))
    return null
  const button = commandButton(label)
  if (!button || button.disabled) return null
  return button
}

export function BattleKeyboardAssist({ playerName }: { playerName: string }) {
  const [bindings, setBindings] = useState<CombatKeybindMap>(DEFAULT_COMBAT_KEYBINDS)
  const targetIndex = useRef(-1)
  const movementPlan = useRef<{
    committedOriginKey: string
    endpoint: { x: number; y: number }
  } | null>(null)
  const lastRepeatableCommand = useRef<string | null>(null)
  const repeatSequence = useRef(0)

  useEffect(() => {
    let cancelled = false
    async function loadControls() {
      try {
        const response = await fetch('/api/account/controls', { method: 'GET', cache: 'no-store' })
        const body = (await response.json()) as { controls?: { combatKeybinds?: unknown } }
        const parsed = parseCombatKeybindMap(body.controls?.combatKeybinds)
        if (!cancelled && response.ok && parsed) setBindings(parsed)
      } catch {
        // Defaults remain available if account preferences cannot be refreshed mid-battle.
      }
    }
    void loadControls()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function syncBattlePresentation() {
      syncVisibleCommandLabels(bindings)
      syncAttackRangeMarkers(playerName)
      if (!moveModeIsActive()) movementPlan.current = null
    }

    syncBattlePresentation()
    const deckObserver = new MutationObserver(syncBattlePresentation)
    const deck = document.querySelector('section[aria-label="Command Deck"]')
    if (deck) deckObserver.observe(deck, { childList: true, subtree: true })

    const battlefieldObserver = new MutationObserver(() => syncAttackRangeMarkers(playerName))
    const battlefield = document.querySelector('#battlefield')
    if (battlefield) battlefieldObserver.observe(battlefield, { childList: true, subtree: true })

    return () => {
      deckObserver.disconnect()
      battlefieldObserver.disconnect()
    }
  }, [bindings, playerName])

  useEffect(() => {
    function scheduleRepeat(label: string) {
      const sequence = ++repeatSequence.current
      let attempts = 0

      const timer = window.setInterval(() => {
        attempts += 1
        if (sequence !== repeatSequence.current || attempts > 80) {
          window.clearInterval(timer)
          return
        }

        const confirm = planningButton('Confirm Action')
        const committing = confirm?.textContent?.includes('Committing') ?? false
        if (committing) return

        const action = repeatableCommand(label)
        if (!action) {
          if (attempts > 8) window.clearInterval(timer)
          return
        }

        // Successful commits clear planning. Re-select only after that clear has happened; failures
        // leave the current mode selected and therefore do not create a second synthetic click.
        if (commandIsActive(label)) {
          window.clearInterval(timer)
          return
        }

        action.click()
        window.clearInterval(timer)
      }, 75)
    }

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null
      const button = target?.closest<HTMLButtonElement>('button')
      if (!button) return

      const deck = button.closest('section[aria-label="Command Deck"]')
      if (deck) {
        const label = button.querySelector('strong')?.textContent?.trim() ?? ''
        if (
          ['Move', 'Basic Attack', 'Recover', 'HP Recovery', 'MP Recovery'].includes(label) &&
          !button.disabled
        ) {
          lastRepeatableCommand.current = label
          if (label !== 'Move') movementPlan.current = null
        } else if (label === 'Guard') {
          // Guard is intentionally one-shot. Its status forbids an immediate second Guard, so never
          // schedule a synthetic repeat after confirmation even when older rail markup is absent.
          lastRepeatableCommand.current = null
          repeatSequence.current += 1
          movementPlan.current = null
        }
        if (label === 'Finish Turn') {
          lastRepeatableCommand.current = null
          movementPlan.current = null
          repeatSequence.current += 1
        }
        return
      }

      if (button.textContent?.includes('Confirm Action')) {
        const label = lastRepeatableCommand.current
        if (label) scheduleRepeat(label)
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      repeatSequence.current += 1
    }
  }, [])

  useEffect(() => {
    function cycleTarget(reverse: boolean) {
      if (!attackModeIsActive()) return false
      const targets = legalVisibleTargetButtons(playerName).filter(
        (button) => button.dataset.attackRange === 'legal',
      )
      if (targets.length === 0) return false
      const direction = reverse ? -1 : 1
      targetIndex.current =
        targetIndex.current < 0
          ? reverse
            ? targets.length - 1
            : 0
          : (targetIndex.current + direction + targets.length) % targets.length
      const target = targets[targetIndex.current]
      target?.focus()
      target?.click()
      return true
    }

    function moveAdjacent(direction: { dx: number; dy: number }): boolean {
      const tiles = battleTiles()
      const actorTile = playerTile(playerName)
      const committed = actorTile ? tilePosition(actorTile) : null
      if (!committed || !actorTile) return false

      const committedKey = positionKey(committed)
      if (!movementPlan.current || movementPlan.current.committedOriginKey !== committedKey) {
        movementPlan.current = { committedOriginKey: committedKey, endpoint: committed }
      }

      const base = movementPlan.current.endpoint
      const targetPosition = { x: base.x + direction.dx, y: base.y + direction.dy }

      // Crossing back through the committed origin cancels the current movement projection without
      // leaving Move mode. The next direction can then project immediately to the opposite side.
      if (positionsEqual(targetPosition, committed)) {
        const move = commandButton('Move')
        if (!move || move.disabled) return false
        move.click()
        movementPlan.current = { committedOriginKey: committedKey, endpoint: committed }
        actorTile.focus({ preventScroll: true })
        return true
      }

      const targetPrefix = `Tile ${targetPosition.x + 1}, ${targetPosition.y + 1};`
      const target = tiles.find((button) =>
        (button.getAttribute('aria-label') ?? '').startsWith(targetPrefix),
      )
      if (!target || target.disabled) return false
      if ((target.getAttribute('aria-label') ?? '').includes('occupied by ')) return false
      if (!target.hasAttribute('data-reachable')) return false

      movementPlan.current = {
        committedOriginKey: committedKey,
        endpoint: targetPosition,
      }
      target.focus({ preventScroll: true })
      target.click()
      return true
    }

    function execute(action: CombatKeybindAction): boolean {
      if (action === 'inspect') {
        commandButton('Inspect')?.click()
        return true
      }
      if (action === 'move') {
        commandButton('Move')?.click()
        return true
      }
      if (action === 'basicAttack') {
        commandButton('Basic Attack')?.click()
        return true
      }
      if (action === 'guard') {
        commandButton('Guard')?.click()
        return true
      }
      if (action === 'recover') {
        commandButton('Recover', 'HP Recovery', 'MP Recovery')?.click()
        return true
      }
      if (action === 'endTurn') {
        lastRepeatableCommand.current = null
        repeatSequence.current += 1
        movementPlan.current = null
        commandButton('Finish Turn', 'End Turn', 'Facing / End Turn')?.click()
        return true
      }
      if (action === 'confirm') {
        planningButton('Confirm Action')?.click()
        return true
      }
      if (action === 'cancel') {
        planningButton('Cancel')?.click()
        return true
      }
      if (action === 'faceNorth') {
        document.querySelector<HTMLButtonElement>('[aria-label="Face north"]')?.click()
        return true
      }
      if (action === 'faceWest') {
        document.querySelector<HTMLButtonElement>('[aria-label="Face west"]')?.click()
        return true
      }
      if (action === 'faceSouth') {
        document.querySelector<HTMLButtonElement>('[aria-label="Face south"]')?.click()
        return true
      }
      if (action === 'faceEast') {
        document.querySelector<HTMLButtonElement>('[aria-label="Face east"]')?.click()
        return true
      }
      if (action === 'nextTarget') return cycleTarget(false)
      if (action === 'previousTarget') return cycleTarget(true)
      if (action === 'combatLog') {
        const trigger = combatLogButton()
        if (trigger) trigger.click()
        else window.dispatchEvent(new Event('aurevane:battle-log-toggle'))
        return true
      }
      return false
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target) || !event.code) return

      const movementDirection = directionForCode(event.code)
      if (movementDirection && moveModeIsActive()) {
        event.preventDefault()
        event.stopImmediatePropagation()
        moveAdjacent(movementDirection)
        return
      }

      if (movementDirection && facingModeIsActive()) {
        event.preventDefault()
        event.stopImmediatePropagation()
        chooseFacing(movementDirection)
        return
      }

      const chord = eventChord(event)
      const action = configuredAction(bindings, chord)
      if (action) {
        // Desktop Move / Attack / Guard / Recovery belong to BattleSelfActionQuickCommitAssist.
        // Mobile keeps this existing handler because the shared quick-commit owner is desktop-only.
        if (isSharedCategoryAction(action) && window.matchMedia('(min-width: 821px)').matches)
          return
        if ((action === 'nextTarget' || action === 'previousTarget') && !attackModeIsActive())
          return
        event.preventDefault()
        event.stopImmediatePropagation()
        execute(action)
        return
      }
      const legacyAction = defaultAction(chord)
      if (legacyAction && combatKeybindChord(bindings[legacyAction]) !== chord) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [bindings, playerName])

  return null
}
