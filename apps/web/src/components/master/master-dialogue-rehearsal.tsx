'use client'

import { useState, type ReactNode } from 'react'
import { WorldDialogue } from '@/components/world/world-dialogue'
import type { WorldInteraction, WorldInteractionActionId } from '@/world/types'

export function MasterDialogueRehearsal({
  topic,
  label,
  disabled,
  onOpen,
  onReply,
  extraResponses,
}: {
  topic: WorldInteraction
  label: string
  disabled?: boolean
  onOpen?: () => void
  onReply?: (id: string, action: WorldInteractionActionId) => Promise<boolean>
  extraResponses?: ReactNode
}) {
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null)
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={(event) => {
          onOpen?.()
          setOpener(event.currentTarget)
        }}
      >
        {label}
      </button>
      {opener ? (
        <WorldDialogue
          initialTopic={topic}
          opener={opener}
          topics={[topic]}
          objectives={[]}
          interruption={null}
          error=""
          busy={false}
          onClose={() => setOpener(null)}
          onReply={onReply ?? (async () => false)}
          extraResponses={extraResponses}
          showHistory={Boolean(onReply)}
        />
      ) : null}
    </>
  )
}
