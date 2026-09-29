'use client'

import type { WorldInteraction } from '@/world/types'
import styles from './world.module.css'

function interactionStatus(interaction: WorldInteraction) {
  if (interaction.progress === 'completed') return 'This objective is complete.'
  if (interaction.progress === 'active') return 'Your current objective is already underway.'
  if (interaction.progress === 'ready') return 'Your report is ready to turn in.'
  return 'A local objective is available.'
}

export function WorldConversation({
  interaction,
  locationName,
  disabled,
  onAction,
  onClose,
}: {
  interaction: WorldInteraction
  locationName: string
  disabled: boolean
  onAction: () => void
  onClose: () => void
}) {
  const headingId = `world-conversation-${interaction.id}`

  return (
    <div className={styles.conversationScrim} data-world-conversation>
      <section
        className={styles.conversation}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <aside className={styles.conversationNpc} aria-label="Conversation contact">
          <span>Local contact</span>
          <strong>{interaction.speaker}</strong>
          <small>{locationName}</small>
          <div className={styles.conversationNpcPlaceholder} aria-hidden="true">
            ✦
          </div>
        </aside>

        <div className={styles.conversationDialogue}>
          <header>
            <div>
              <small>{interaction.title}</small>
              <h2 id={headingId}>{interaction.speaker}</h2>
            </div>
            <button type="button" className={styles.conversationClose} onClick={onClose}>
              End conversation
            </button>
          </header>

          <p className={styles.conversationBody}>{interaction.body}</p>

          <div className={styles.conversationChoices} aria-label="Conversation choices">
            {interaction.actionLabel ? (
              <button
                type="button"
                className={styles.conversationChoice}
                disabled={disabled}
                onClick={onAction}
              >
                <strong>{interaction.actionLabel}</strong>
                <span>{interactionStatus(interaction)}</span>
              </button>
            ) : (
              <p className={styles.conversationState}>{interactionStatus(interaction)}</p>
            )}
          </div>

          <footer>
            <button type="button" onClick={onClose}>
              End conversation
            </button>
          </footer>
        </div>
      </section>
    </div>
  )
}
