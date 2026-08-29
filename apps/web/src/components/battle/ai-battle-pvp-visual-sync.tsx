'use client'

import { useEffect } from 'react'

import styles from './ai-battle-pvp-visual-sync.module.css'

const COMMAND_LABELS = new Set([
  'Inspect',
  'Move',
  'Basic Attack',
  'Guard',
  'Recover',
  'Finish Turn',
])

function directNumericMarker(tile: HTMLButtonElement): HTMLSpanElement | null {
  for (const child of Array.from(tile.children)) {
    if (!(child instanceof HTMLSpanElement)) continue
    const text = child.textContent?.trim() ?? ''
    if (/^\d+$/.test(text)) return child
  }
  return null
}

function directUnitToken(tile: HTMLButtonElement): HTMLSpanElement | null {
  return (
    Array.from(tile.children).find(
      (child): child is HTMLSpanElement =>
        child instanceof HTMLSpanElement && Boolean(child.querySelector(':scope > strong')),
    ) ?? null
  )
}

function cleanPathZeroMarker(marker: HTMLSpanElement) {
  marker.querySelector('[data-map-token-portrait]')?.remove()
  delete marker.dataset.mapPortraitReady
}

function markAiHeader(root: HTMLElement) {
  root.dataset.aiBattleRoot = 'true'

  const header = root.querySelector<HTMLElement>(':scope > header')
  if (!header) return
  header.dataset.aiBattleHeader = 'true'

  const objective = header.firstElementChild
  if (objective instanceof HTMLElement) objective.dataset.aiBattleObjective = 'true'

  const economyTrack = header.querySelector<HTMLElement>(
    '[role="progressbar"][aria-label="Action Economy remaining"]',
  )
  const economy = economyTrack?.parentElement
  if (economy instanceof HTMLElement) economy.dataset.aiBattleEconomy = 'true'

  const round = Array.from(header.children).find(
    (child): child is HTMLButtonElement =>
      child instanceof HTMLButtonElement && child.textContent?.includes('Combat Log') === true,
  )
  if (round) round.dataset.aiBattleRound = 'true'

  const victory = Array.from(header.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
    const aria = button.getAttribute('aria-label')?.toLowerCase() ?? ''
    const text = button.textContent?.trim() ?? ''
    return aria.startsWith('victory conditions') || text.includes('Victory Conditions')
  })
  if (victory) victory.dataset.aiBattleVictory = 'true'
}

function markAiFooter(root: HTMLElement) {
  const footer = root.querySelector<HTMLElement>(':scope > footer')
  if (!footer) return

  const buttons = Array.from(footer.querySelectorAll<HTMLButtonElement>('button'))
  const cancel = buttons.find((button) => button.textContent?.includes('Cancel Action')) ?? null
  const actionGroup = cancel?.parentElement
  if (actionGroup instanceof HTMLElement) actionGroup.dataset.aiPvpFooterActions = 'true'

  for (const button of buttons) {
    const text = button.textContent?.trim() ?? ''
    if (text.includes('Cancel Action')) button.dataset.aiPvpFooterAction = 'cancel'
    else if (text.includes('Confirm Action') || text.includes('Committing')) {
      button.dataset.aiPvpFooterAction = 'confirm'
    } else if (text.includes('Abort Battle') || text.includes('Surrender')) {
      button.dataset.aiPvpFooterAction = 'danger'
    }
  }
}

export function AiBattlePvpVisualSync({ playerName }: { playerName: string }) {
  useEffect(() => {
    let frame: number | null = null

    const sync = () => {
      frame = null
      const battlefield = document.querySelector<HTMLElement>(
        'section[aria-label="Tactical battlefield"]',
      )
      const root = battlefield?.closest<HTMLElement>('main') ?? null
      if (!root || root.dataset.pvpBattle === 'true') return

      markAiHeader(root)
      markAiFooter(root)

      const commandDeck = root.querySelector<HTMLElement>('section[aria-label="Command Deck"]')
      if (commandDeck) {
        commandDeck.dataset.aiPvpVisualSync = 'true'

        const facingButtons: HTMLButtonElement[] = []
        for (const button of commandDeck.querySelectorAll<HTMLButtonElement>('button')) {
          const label =
            button.querySelector<HTMLElement>(':scope > strong')?.textContent?.trim() ?? ''
          if (COMMAND_LABELS.has(label)) {
            button.dataset.aiCommandButton = 'true'
            if (button.className.trim()) button.dataset.selected = 'true'
            else delete button.dataset.selected
          }

          if (button.getAttribute('aria-label')?.startsWith('Face ')) {
            button.dataset.aiFacingButton = 'true'
            facingButtons.push(button)
          }
        }

        const facingPad = facingButtons[0]?.parentElement
        if (facingPad instanceof HTMLElement) facingPad.dataset.aiFacingPad = 'true'
      }

      if (!battlefield) return

      const tiles = Array.from(
        battlefield.querySelectorAll<HTMLButtonElement>('button[aria-label^="Tile "]'),
      )
      let pathActive = false

      for (const tile of tiles) {
        const unitToken = directUnitToken(tile)
        if (unitToken) {
          unitToken.dataset.aiBattleToken = 'true'
          unitToken.dataset.aiTokenTeam = tile
            .getAttribute('aria-label')
            ?.includes(`occupied by ${playerName}`)
            ? 'player'
            : 'opponent'
        }

        const marker = directNumericMarker(tile)
        if (marker && marker.dataset.aiPathZero !== 'true') {
          marker.dataset.aiPathNumber = 'true'
          tile.dataset.aiPathTile = 'true'
          pathActive = true
        } else if (!marker) {
          delete tile.dataset.aiPathTile
        }
      }

      const existingZero = battlefield.querySelector<HTMLSpanElement>('[data-ai-path-zero="true"]')
      if (!pathActive) {
        existingZero?.remove()
        return
      }

      const playerTile = tiles.find((tile) =>
        tile.getAttribute('aria-label')?.includes(`occupied by ${playerName}`),
      )
      if (!playerTile) return

      playerTile.dataset.aiPathTile = 'true'
      const unitToken = directUnitToken(playerTile)
      if (!existingZero || existingZero.parentElement !== playerTile) {
        existingZero?.remove()
        const zero = document.createElement('span')
        zero.textContent = '0'
        zero.dataset.aiPathNumber = 'true'
        zero.dataset.aiPathZero = 'true'
        zero.setAttribute('aria-hidden', 'true')
        playerTile.insertBefore(zero, unitToken)
      } else {
        cleanPathZeroMarker(existingZero)
        if (unitToken && existingZero.nextElementSibling !== unitToken) {
          playerTile.insertBefore(existingZero, unitToken)
        }
      }
    }

    const schedule = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(sync)
    }

    sync()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'disabled'],
    })

    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
      document.querySelector('[data-ai-path-zero="true"]')?.remove()

      for (const root of document.querySelectorAll<HTMLElement>('[data-ai-battle-root="true"]')) {
        delete root.dataset.aiBattleRoot
        for (const element of root.querySelectorAll<HTMLElement>(
          '[data-ai-battle-header], [data-ai-battle-objective], [data-ai-battle-economy], [data-ai-battle-round], [data-ai-battle-victory], [data-ai-battle-token], [data-ai-pvp-footer-actions], [data-ai-pvp-footer-action]',
        )) {
          delete element.dataset.aiBattleHeader
          delete element.dataset.aiBattleObjective
          delete element.dataset.aiBattleEconomy
          delete element.dataset.aiBattleRound
          delete element.dataset.aiBattleVictory
          delete element.dataset.aiBattleToken
          delete element.dataset.aiTokenTeam
          delete element.dataset.aiPvpFooterActions
          delete element.dataset.aiPvpFooterAction
        }
      }
    }
  }, [playerName])

  return <span className={styles.hook} aria-hidden="true" />
}
