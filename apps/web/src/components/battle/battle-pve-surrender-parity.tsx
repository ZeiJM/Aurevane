'use client'

import { useEffect } from 'react'

import styles from './battle-pve-surrender-parity.module.css'

function markPveSurrenderDialog(): void {
  const title = document.getElementById('battle-surrender-title')
  const modal = title?.parentElement
  const backdrop = modal?.parentElement
  if (!(modal instanceof HTMLElement) || !(backdrop instanceof HTMLElement)) return

  backdrop.dataset.pveSurrenderBackdrop = 'true'
  modal.dataset.pveSurrenderModal = 'true'

  const eyebrow = modal.querySelector<HTMLElement>(':scope > span')
  if (eyebrow && eyebrow.textContent !== 'Battle Hall · PvE') {
    eyebrow.textContent = 'Battle Hall · PvE'
  }

  const buttons = Array.from(modal.querySelectorAll<HTMLButtonElement>(':scope > button'))
  const stay = buttons.find((button) => button.textContent?.trim().toLowerCase().startsWith('stay'))
  const confirm = buttons.find((button) => {
    const text = button.textContent?.trim().toLowerCase() ?? ''
    return text.startsWith('confirm surrender') || text.startsWith('surrendering')
  })

  if (stay) stay.dataset.pveSurrenderStay = 'true'
  if (confirm) confirm.dataset.pveSurrenderConfirm = 'true'
}

export function BattlePveSurrenderParity() {
  useEffect(() => {
    const sync = () => markPveSurrenderDialog()
    sync()

    const observer = new MutationObserver(() => window.requestAnimationFrame(sync))
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      for (const element of document.querySelectorAll<HTMLElement>(
        '[data-pve-surrender-backdrop], [data-pve-surrender-modal], [data-pve-surrender-stay], [data-pve-surrender-confirm]',
      )) {
        delete element.dataset.pveSurrenderBackdrop
        delete element.dataset.pveSurrenderModal
        delete element.dataset.pveSurrenderStay
        delete element.dataset.pveSurrenderConfirm
      }
    }
  }, [])

  return <span className={styles.hook} aria-hidden="true" />
}
