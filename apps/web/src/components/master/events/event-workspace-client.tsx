'use client'
import { useState } from 'react'
import { EventBuilderClient } from './event-builder-client'
import { EventOperationsClient } from './event-operations-client'
import styles from './event-builder.module.css'

export function EventWorkspaceClient({
  canPublish,
  canUseGlobalScope,
  canEmergencyStop,
  initialView = 'author',
}: {
  canPublish: boolean
  canUseGlobalScope: boolean
  canEmergencyStop: boolean
  initialView?: 'author' | 'live'
}) {
  const [view, setView] = useState(initialView)
  return (
    <>
      <nav className={styles.workspaceTabs} aria-label="Events workspace">
        <button type="button" aria-pressed={view === 'author'} onClick={() => setView('author')}>
          Definitions &amp; Schedule
        </button>
        <button type="button" aria-pressed={view === 'live'} onClick={() => setView('live')}>
          Live Operations
        </button>
      </nav>
      <div hidden={view !== 'author'}>
        <EventBuilderClient canPublish={canPublish} canUseGlobalScope={canUseGlobalScope} />
      </div>
      <div hidden={view !== 'live'}>
        <EventOperationsClient canEmergencyStop={canEmergencyStop} />
      </div>
    </>
  )
}
