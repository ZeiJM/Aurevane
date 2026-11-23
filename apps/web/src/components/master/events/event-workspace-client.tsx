'use client'
import { useState, useSyncExternalStore } from 'react'
import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABELS,
  isEventCategory,
  type EventCategory,
} from '@aurevane/game-core/events/persistent-event'
import { EventBuilderClient } from './event-builder-client'
import { EventOperationsClient } from './event-operations-client'
import styles from './event-builder.module.css'

const preferenceKey = 'aurevane.master.event-category'
const categoryChange = 'aurevane:event-category'

function defaultCategory(): EventCategory {
  return 'world-events'
}

function readCategory(): EventCategory {
  try {
    const saved = window.sessionStorage.getItem(preferenceKey)
    return isEventCategory(saved) ? saved : defaultCategory()
  } catch {
    return defaultCategory()
  }
}

function subscribeCategory(listener: () => void) {
  window.addEventListener(categoryChange, listener)
  return () => window.removeEventListener(categoryChange, listener)
}

export function EventWorkspaceClient({
  canPublish,
  canUseGlobalScope,
  canEmergencyStop,
  canManageNpcs = false,
  initialView = 'author',
}: {
  canPublish: boolean
  canUseGlobalScope: boolean
  canEmergencyStop: boolean
  canManageNpcs?: boolean
  initialView?: 'author' | 'live'
}) {
  const [view, setView] = useState<'author' | 'live' | 'calendar'>(initialView)
  const savedCategory = useSyncExternalStore(subscribeCategory, readCategory, defaultCategory)
  const [currentCategory, setCurrentCategory] = useState<EventCategory>()
  const category = currentCategory ?? savedCategory

  function chooseCategory(next: EventCategory) {
    setCurrentCategory(next)
    try {
      window.sessionStorage.setItem(preferenceKey, next)
      window.dispatchEvent(new Event(categoryChange))
    } catch {
      // The current workspace still works when storage is unavailable.
    }
  }
  return (
    <>
      <nav className={styles.workspaceTabs} aria-label="Events workspace">
        <button type="button" aria-pressed={view === 'author'} onClick={() => setView('author')}>
          Definitions &amp; Schedule
        </button>
        <button type="button" aria-pressed={view === 'live'} onClick={() => setView('live')}>
          Live Operations
        </button>
        <button
          type="button"
          aria-pressed={view === 'calendar'}
          onClick={() => setView('calendar')}
        >
          Calendar
        </button>
      </nav>
      <nav className={styles.workspaceTabs} aria-label="Event categories">
        {EVENT_CATEGORIES.map((entry) => (
          <button
            key={entry}
            type="button"
            aria-pressed={category === entry}
            onClick={() => chooseCategory(entry)}
          >
            {EVENT_CATEGORY_LABELS[entry]}
          </button>
        ))}
      </nav>
      <div hidden={view !== 'author'}>
        <EventBuilderClient
          canPublish={canPublish}
          canManageNpcs={canManageNpcs}
          canUseGlobalScope={canUseGlobalScope}
          category={category}
        />
      </div>
      <div hidden={view === 'author'}>
        <EventOperationsClient
          canEmergencyStop={canEmergencyStop}
          category={category}
          calendar={view === 'calendar'}
        />
      </div>
    </>
  )
}
