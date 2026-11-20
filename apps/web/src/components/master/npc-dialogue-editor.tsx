'use client'

import {
  NPC_DIALOGUE_LABEL_LIMIT,
  NPC_DIALOGUE_MAX_DEPTH,
  NPC_DIALOGUE_MAX_NODES,
  NPC_DIALOGUE_MAX_REPLIES,
  NPC_GREETING_EXPRESSIONS,
  NPC_GREETING_LIMIT,
  npcDialogueNodeCount,
  type NpcDialogueReply,
} from '@aurevane/validation/combat/npc-design'
import styles from './npc-design-editor.module.css'

export function NpcDialogueEditor({
  replies,
  onChange,
}: {
  replies: NpcDialogueReply[]
  onChange: (replies: NpcDialogueReply[]) => void
}) {
  return (
    <fieldset className={styles.dialogueTree}>
      <legend>Conversation replies</legend>
      <ReplyList
        replies={replies}
        onChange={onChange}
        atLimit={npcDialogueNodeCount(replies) >= NPC_DIALOGUE_MAX_NODES}
        path={[]}
      />
    </fieldset>
  )
}

function ReplyList({
  replies,
  onChange,
  atLimit,
  path,
}: {
  replies: NpcDialogueReply[]
  onChange: (replies: NpcDialogueReply[]) => void
  atLimit: boolean
  path: readonly number[]
}) {
  const prefix = path.join('.')
  return (
    <>
      {replies.map((reply, index) => {
        const nextPath = [...path, index + 1]
        const label = nextPath.join('.')
        const edit = (change: Partial<NpcDialogueReply>) =>
          onChange(replies.map((row, offset) => (offset === index ? { ...row, ...change } : row)))
        return (
          <fieldset key={index}>
            <legend>Reply {label}</legend>
            <label>
              Player choice
              <input
                value={reply.label}
                maxLength={NPC_DIALOGUE_LABEL_LIMIT}
                onChange={(event) => edit({ label: event.target.value })}
              />
            </label>
            <label>
              NPC response
              <textarea
                rows={3}
                value={reply.body}
                maxLength={NPC_GREETING_LIMIT}
                onChange={(event) => edit({ body: event.target.value })}
              />
            </label>
            <label>
              Response expression
              <select
                value={reply.expression ?? 'neutral'}
                onChange={(event) => {
                  const expression = NPC_GREETING_EXPRESSIONS.find(
                    (value) => value === event.target.value,
                  )
                  if (expression) edit({ expression })
                }}
              >
                {NPC_GREETING_EXPRESSIONS.map((expression) => (
                  <option key={expression} value={expression}>
                    {expression}
                  </option>
                ))}
              </select>
            </label>
            {nextPath.length < NPC_DIALOGUE_MAX_DEPTH ? (
              <ReplyList
                replies={reply.replies}
                onChange={(next) => edit({ replies: next })}
                atLimit={atLimit}
                path={nextPath}
              />
            ) : null}
            <button
              type="button"
              onClick={() => onChange(replies.filter((_, offset) => offset !== index))}
            >
              Remove reply {label}
            </button>
          </fieldset>
        )
      })}
      {replies.length < NPC_DIALOGUE_MAX_REPLIES ? (
        <button
          type="button"
          disabled={atLimit}
          onClick={() => onChange([...replies, { label: '', body: '', replies: [] }])}
        >
          {prefix ? `Add follow-up to reply ${prefix}` : 'Add greeting reply'}
        </button>
      ) : null}
    </>
  )
}
