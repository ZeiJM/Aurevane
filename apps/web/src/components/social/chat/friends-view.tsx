'use client'

import { useCallback, useEffect, useState } from 'react'

import { chatApi, type ChatSettings, type FriendsState } from './chat-api'
import styles from './chat.module.css'

type Tab = 'friends' | 'requests' | 'blocked' | 'group'

export function FriendsView({
  onWhisper,
  onOpenGroup,
  onChanged,
}: {
  onWhisper: (characterId: string) => void
  onOpenGroup: (groupId: string) => void
  onChanged: () => void
}) {
  const [state, setState] = useState<FriendsState | null>(null)
  const [tab, setTab] = useState<Tab>('friends')
  const [name, setName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => {
    void chatApi
      .friends()
      .then(setState)
      .catch((error: Error) => setNotice(error.message))
  }, [])
  useEffect(load, [load])

  const act = async (payload: { action: string; name?: string; characterId?: string }) => {
    setNotice(null)
    try {
      await chatApi.friendAction(payload)
      load()
      onChanged()
      return true
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That did not work.')
      return false
    }
  }

  const createGroup = async () => {
    setNotice(null)
    try {
      const result = (await chatApi.groupAction({
        action: 'create',
        name: groupName.trim(),
        inviteIds: picked,
      })) as { group?: { id?: string } | string }
      const id = typeof result.group === 'string' ? result.group : result.group?.id
      onChanged()
      if (id) onOpenGroup(id)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Group not created.')
    }
  }

  const used = state?.slotsUsed ?? 0
  const max = state?.slotsMax ?? 10
  const requestCount = state?.incoming.length ?? 0

  return (
    <div className={styles.section}>
      <div className={styles.tabs} role="tablist">
        {(
          [
            ['friends', `Friends ${used}/${max}`],
            ['requests', requestCount ? `Requests (${requestCount})` : 'Requests'],
            ['group', 'New group'],
            ['blocked', 'Blocked'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {notice ? (
        <p className={styles.notice} role="alert">
          {notice}
        </p>
      ) : null}

      {tab === 'friends' ? (
        <>
          <div className={styles.slots} aria-hidden="true">
            <i style={{ width: `${Math.min(100, (used / max) * 100)}%` }} />
          </div>
          <form
            className={styles.field}
            onSubmit={(event) => {
              event.preventDefault()
              const trimmed = name.trim()
              if (trimmed)
                void act({ action: 'request', name: trimmed }).then((ok) => ok && setName(''))
            }}
          >
            <input
              value={name}
              maxLength={40}
              placeholder="Add a friend by name"
              aria-label="Friend name"
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className={styles.small} disabled={!name.trim()}>
              Add
            </button>
          </form>
          {state?.friends.length === 0 ? <p className={styles.empty}>No friends yet.</p> : null}
          {state?.friends.map((friend) => (
            <div key={friend.id} className={styles.person}>
              <span className={styles.dot} data-online={Boolean(friend.online)} />
              <span>
                <strong>{friend.name}</strong>
                <small>
                  Level {friend.level}
                  {friend.online ? ' · online' : ''}
                </small>
              </span>
              <span className={styles.actions}>
                <button type="button" className={styles.small} onClick={() => onWhisper(friend.id)}>
                  Whisper
                </button>
                <button
                  type="button"
                  className={styles.small}
                  data-tone="danger"
                  onClick={() => void act({ action: 'remove', characterId: friend.id })}
                >
                  Remove
                </button>
              </span>
            </div>
          ))}
        </>
      ) : null}

      {tab === 'requests' ? (
        <>
          <h3>Incoming</h3>
          {requestCount === 0 ? <p className={styles.empty}>No requests.</p> : null}
          {state?.incoming.map((person) => (
            <div key={person.id} className={styles.person}>
              <span>
                <strong>{person.name}</strong>
                <small>Level {person.level}</small>
              </span>
              <span className={styles.actions}>
                <button
                  type="button"
                  className={styles.small}
                  onClick={() => void act({ action: 'accept', characterId: person.id })}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className={styles.small}
                  data-tone="danger"
                  onClick={() => void act({ action: 'decline', characterId: person.id })}
                >
                  Decline
                </button>
                <button
                  type="button"
                  className={styles.small}
                  data-tone="danger"
                  onClick={() => void act({ action: 'block', characterId: person.id })}
                >
                  Block
                </button>
              </span>
            </div>
          ))}
          {state && state.outgoing.length > 0 ? <h3>Sent</h3> : null}
          {state?.outgoing.map((person) => (
            <div key={person.id} className={styles.person}>
              <span>
                <strong>{person.name}</strong>
                <small>Waiting for reply</small>
              </span>
              <span className={styles.actions}>
                <button
                  type="button"
                  className={styles.small}
                  onClick={() => void act({ action: 'decline', characterId: person.id })}
                >
                  Cancel
                </button>
              </span>
            </div>
          ))}
        </>
      ) : null}

      {tab === 'blocked' ? (
        <>
          {state?.blocked.length === 0 ? <p className={styles.empty}>Nobody blocked.</p> : null}
          {state?.blocked.map((person) => (
            <div key={person.id} className={styles.person}>
              <strong>{person.name}</strong>
              <span className={styles.actions}>
                <button
                  type="button"
                  className={styles.small}
                  onClick={() => void act({ action: 'unblock', characterId: person.id })}
                >
                  Unblock
                </button>
              </span>
            </div>
          ))}
        </>
      ) : null}

      {tab === 'group' ? (
        <>
          <div className={styles.field}>
            <input
              value={groupName}
              maxLength={24}
              placeholder="Group name"
              aria-label="Group name"
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>
          <p className={styles.empty}>
            Invite up to 9 friends ({picked.length}/9). Groups hold 10 people with you.
          </p>
          {state?.friends.map((friend) => (
            <label key={friend.id} className={styles.person}>
              <input
                type="checkbox"
                className={styles.check}
                checked={picked.includes(friend.id)}
                disabled={!picked.includes(friend.id) && picked.length >= 9}
                onChange={(event) =>
                  setPicked((current) =>
                    event.target.checked
                      ? [...current, friend.id]
                      : current.filter((id) => id !== friend.id),
                  )
                }
              />
              <strong>{friend.name}</strong>
            </label>
          ))}
          <button
            type="button"
            className={styles.small}
            style={{ width: '100%', marginTop: 10 }}
            disabled={!groupName.trim()}
            onClick={() => void createGroup()}
          >
            Create group
          </button>
        </>
      ) : null}
    </div>
  )
}

const PRIVACY = [
  ['everyone', 'Everyone'],
  ['friends', 'Friends only'],
  ['nobody', 'Nobody'],
] as const

export function SettingsView({
  settings,
  onSaved,
}: {
  settings: ChatSettings | null
  onSaved: (settings: ChatSettings) => void
}) {
  const [notice, setNotice] = useState<string | null>(null)
  if (!settings)
    return (
      <div className={styles.section}>
        <p className={styles.empty}>Loading…</p>
      </div>
    )

  const save = (patch: Partial<ChatSettings>) => {
    setNotice(null)
    void chatApi
      .saveSettings(patch)
      .then(({ settings: next }) => onSaved(next))
      .catch((error: Error) => setNotice(error.message))
  }

  return (
    <div className={styles.section}>
      {notice ? (
        <p className={styles.notice} role="alert">
          {notice}
        </p>
      ) : null}
      <label className={styles.setting}>
        <span>Who can whisper you</span>
        <select
          className={styles.select}
          style={{ flex: '0 0 auto' }}
          value={settings.whisperPrivacy}
          onChange={(e) =>
            save({ whisperPrivacy: e.target.value as ChatSettings['whisperPrivacy'] })
          }
        >
          {PRIVACY.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.setting}>
        <span>Who can invite you to groups</span>
        <select
          className={styles.select}
          style={{ flex: '0 0 auto' }}
          value={settings.groupInvitePrivacy}
          onChange={(e) =>
            save({ groupInvitePrivacy: e.target.value as ChatSettings['groupInvitePrivacy'] })
          }
        >
          {PRIVACY.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.setting}>
        <span>Opens to</span>
        <select
          className={styles.select}
          style={{ flex: '0 0 auto' }}
          value={settings.defaultChannel}
          onChange={(e) =>
            save({ defaultChannel: e.target.value as ChatSettings['defaultChannel'] })
          }
        >
          <option value="world">World</option>
          <option value="village">Village</option>
          <option value="feed">Game feed only</option>
        </select>
      </label>
      <label className={styles.setting}>
        <span>
          Show GIFs, images and videos<small>Links stay hidden when shown</small>
        </span>
        <input
          type="checkbox"
          className={styles.check}
          checked={settings.showEmbeds}
          onChange={(e) => save({ showEmbeds: e.target.checked })}
        />
      </label>
      <label className={styles.setting}>
        <span>Appear offline to friends</span>
        <input
          type="checkbox"
          className={styles.check}
          checked={settings.appearOffline}
          onChange={(e) => save({ appearOffline: e.target.checked })}
        />
      </label>
    </div>
  )
}
