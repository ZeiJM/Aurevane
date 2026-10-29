'use client'

import Link from 'next/link'
import { Fragment, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MASTER_PANEL_NAVIGATION,
  normalizeMasterPanelOrder,
  type MasterPanelNavigationSettings,
  type MasterPanelTab,
} from '@/lib/master-panel-pages'
import { OperationalDialog } from './operational-dialog'
import styles from './master-panel-shell.module.css'

const icons = {
  combat: '⚔',
  'combat-timing': '◷',
  events: '✧',
  moderation: '⚑',
  players: '♙',
  staff: '♜',
  music: '♫',
  'world-environment': '☼',
  activity: '≡',
} as const

export function MasterPanelNavigation({
  items,
  activeSection,
  settings,
  canArrange,
}: {
  items: readonly (typeof MASTER_PANEL_NAVIGATION)[number][]
  activeSection: MasterPanelTab | 'overview'
  settings?: MasterPanelNavigationSettings
  canArrange: boolean
}) {
  return (
    <nav className={styles.navigation} aria-label="Master Panel navigation">
      {items.map((item) => (
        <Fragment key={item.id}>
          <Link href={item.href} aria-current={activeSection === item.id ? 'page' : undefined}>
            <span aria-hidden="true">{icons[item.id]}</span> {item.label}
          </Link>
          {item.id === 'activity' && canArrange && <NavigationOrder initial={settings} />}
        </Fragment>
      ))}
    </nav>
  )
}

export function NavigationOrder({ initial }: { initial?: MasterPanelNavigationSettings }) {
  const router = useRouter()
  const [saved, setSaved] = useState(
    initial ?? { revision: 1, order: normalizeMasterPanelOrder(null) },
  )
  const [order, setOrder] = useState(saved.order)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [message, setMessage] = useState('')
  function move(index: number, delta: number) {
    const next = [...order]
    const destination = index + delta
    if (destination < 0 || destination >= next.length) return
    ;[next[index], next[destination]] = [next[destination]!, next[index]!]
    setOrder(next)
    setMessage('')
  }
  async function save() {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/master/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: saved.revision, order }),
      })
      const result = await response.json()
      if (!response.ok || !result.settings)
        throw new Error(result.error?.message ?? 'Could not save tab order. Try again.')
      setSaved(result.settings)
      setOrder(result.settings.order)
      setMessage('Tab order saved for everyone.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save tab order. Try again.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <OperationalDialog
      id="master-navigation-order"
      title="Arrange Master Panel tabs"
      trigger="⚙"
      triggerLabel="Arrange Master Panel tabs"
    >
      <p className={styles.orderHint}>
        Choose the order for everyone. Staff only see pages they can access.
      </p>
      <ol className={styles.orderList} aria-label="Tab order">
        {order.map((id, index) => (
          <li key={id}>
            <span>{MASTER_PANEL_NAVIGATION.find((page) => page.id === id)!.label}</span>
            <button
              type="button"
              disabled={busy || index === 0}
              aria-label={`Move ${MASTER_PANEL_NAVIGATION.find((page) => page.id === id)!.label} up`}
              onClick={() => move(index, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={busy || index === order.length - 1}
              aria-label={`Move ${MASTER_PANEL_NAVIGATION.find((page) => page.id === id)!.label} down`}
              onClick={() => move(index, 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <div className={styles.orderActions}>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOrder(normalizeMasterPanelOrder(null))
            setMessage('Default order selected. Save to apply.')
          }}
        >
          Reset order
        </button>
        <button
          type="button"
          disabled={busy || order.join() === saved.order.join()}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : 'Save order'}
        </button>
      </div>
      <p role="status">{message}</p>
    </OperationalDialog>
  )
}
