'use client'

import { useState } from 'react'
import {
  RESTORATION_ROUTE_LABELS,
  type PersonalInventoryRestoration,
} from '@aurevane/game-core/events/persistent-event'
import type { PublishedStoryNpc } from '@aurevane/validation/combat/npc-design'
import { WorldDialogue } from '@/components/world/world-dialogue'
import { resolvePublicCharacterImageUrl } from '@/media/public-character-portrait'
import type { WorldInteraction } from '@/world/types'

type Stage = 'offer' | 'recovery' | 'trial' | 'recovery-ready' | 'trial-ready' | 'completed'

export function RestorationDialogueRehearsal({
  restoration,
  giver,
}: {
  restoration: PersonalInventoryRestoration
  giver: PublishedStoryNpc
}) {
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null)
  const [stage, setStage] = useState<Stage>('offer')
  const { trial } = restoration
  const bodies: Record<Stage, string> = {
    offer: restoration.offer,
    recovery: restoration.travel,
    trial: trial?.active ?? '',
    'recovery-ready': restoration.ready,
    'trial-ready': trial?.ready ?? '',
    completed: restoration.completed,
  }
  const ready = stage === 'recovery-ready' || stage === 'trial-ready'
  const progressing = stage === 'recovery' || stage === 'trial'
  const offer = stage === 'offer'
  const actionId = offer ? 'choose-restoration' : ready ? 'restore-item' : null
  const description = (offer && trial?.offer ? [bodies[stage], trial.offer] : [bodies[stage]])
    .filter(Boolean)
    .join(' ')
  const topic: WorldInteraction = {
    id: 'restoration-rehearsal',
    objectiveId: 'restoration-rehearsal',
    title: 'Restoration dialogue rehearsal',
    speakerId: giver.id,
    speaker: giver.name,
    portraitUrl: resolvePublicCharacterImageUrl(giver.imageUrl, giver.portraitRef) ?? undefined,
    body: description || 'Add the dialogue for this step.',
    progress: ready ? 'ready' : stage === 'completed' ? 'completed' : 'active',
    actionId,
    actionLabel: offer
      ? restoration.recoveryReply?.trim() || RESTORATION_ROUTE_LABELS['choose-restoration']
      : ready
        ? 'Restore weapon'
        : null,
    ...(offer && trial
      ? {
          alternative: {
            actionId: 'choose-restoration-trial',
            label: trial.reply?.trim() || RESTORATION_ROUTE_LABELS['choose-restoration-trial'],
          },
        }
      : {}),
    ...(ready
      ? {
          confirmation: {
            prompt: 'Hand over both fragments to restore the weapon?',
            label: 'Confirm restoration',
            cancelLabel: 'Keep them for now',
          },
        }
      : {}),
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={(event) => {
          setStage('offer')
          setOpener(event.currentTarget)
        }}
      >
        Rehearse dialogue
      </button>
      <p>Preview both paths without publishing, spending Items, or granting rewards.</p>
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
          onReply={async (_id, action) => {
            if (offer && action === 'choose-restoration') setStage('recovery')
            else if (offer && action === 'choose-restoration-trial' && trial) setStage('trial')
            else if (ready && action === 'restore-item') setStage('completed')
            else return false
            return true
          }}
          extraResponses={
            progressing ? (
              <button
                type="button"
                onClick={() => setStage(stage === 'recovery' ? 'recovery-ready' : 'trial-ready')}
              >
                {stage === 'recovery'
                  ? 'Rehearse reaching the checkpoint'
                  : 'Rehearse winning the trial'}
              </button>
            ) : null
          }
        />
      ) : null}
    </>
  )
}
