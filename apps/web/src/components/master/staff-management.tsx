'use client'

import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'
import { CharacterDeletionDialog } from '@/components/character/character-deletion-dialog'
import type {
  MasterPanelAccountReference,
  MasterPanelStaffSummary,
} from '@/server/master/staff-access'
import styles from './staff-management.module.css'

interface Option {
  readonly id: string
  readonly label: string
  readonly description: string
}
interface Props {
  readonly staff: readonly MasterPanelStaffSummary[]
  readonly roleOptions: readonly Option[]
  readonly capabilityOptions: readonly Option[]
}
const statusLabels = {
  owner: 'Protected Owner',
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
  'needs-binding': 'Needs binding',
}
export function staffUtcDate(value: string | null): string {
  return value ? new Date(value).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'No Expiry'
}
function responseMessage(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = payload.error
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    )
      return error.message
  }
  return 'The staff access request could not be completed.'
}
async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch('/api/master/staff-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  })
  const payload: unknown = await response.json()
  if (!response.ok) throw new Error(responseMessage(payload))
  return payload as Record<string, unknown>
}

export function StaffManagement({ staff, roleOptions, capabilityOptions }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [accounts, setAccounts] = useState<readonly MasterPanelAccountReference[]>([])
  const [selection, setSelection] = useState<{
    account: MasterPanelAccountReference
    characterId: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [revoke, setRevoke] = useState<MasterPanelStaffSummary | null>(null)
  const editorRef = useRef<HTMLElement>(null)
  const dialogId = useId()

  async function find(value = query, characterId?: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    setSelection(null)
    try {
      const payload = await post({ operation: 'resolve-accounts', query: value })
      const found = payload.accounts as unknown as readonly MasterPanelAccountReference[]
      setAccounts(found)
      if (!found.length)
        setNotice('No verified identity matches that exact character name or email.')
      if (characterId) {
        const account = found.find((a) => a.characters.some((c) => c.id === characterId))
        if (account) setSelection({ account, characterId })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Lookup failed.')
    } finally {
      setBusy(false)
    }
  }
  async function revokeSelected() {
    if (!revoke) return
    setBusy(true)
    setError(null)
    try {
      await post({
        operation: revoke.characterId ? 'revoke-character-access' : 'revoke-legacy-access',
        targetCharacterId: revoke.characterId,
        targetUserId: revoke.userId,
        expectedAccessVersion: revoke.accessVersion,
        confirmed: true,
      })
      setRevoke(null)
      setSelection(null)
      setNotice(
        'Access revoked for this character. Open sessions are checked on their next protected action.',
      )
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Revocation failed.')
    } finally {
      setBusy(false)
    }
  }
  function choose(account: MasterPanelAccountReference, characterId: string) {
    setSelection({ account, characterId })
    setError(null)
    setNotice(null)
    requestAnimationFrame(() => editorRef.current?.focus({ preventScroll: true }))
  }

  return (
    <div className={styles.layout}>
      <section className={styles.directory} aria-label="Staff directory">
        <header>
          <h2>Staff directory</h2>
          <p>Access belongs to one character. Linked characters never inherit it.</p>
        </header>
        <form
          className={styles.lookup}
          onSubmit={(event) => {
            event.preventDefault()
            void find()
          }}
        >
          <label>
            Character name or verified email
            <input
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={320}
            />
          </label>
          <button disabled={busy || !query.trim()} type="submit">
            {busy ? 'Finding…' : 'Find / Add staff'}
          </button>
        </form>
        {accounts.length > 0 ? (
          <section className={styles.linked} aria-label="Verified identities and linked characters">
            <h3>Select the character receiving access</h3>
            {accounts.map((account) => (
              <fieldset key={account.userId}>
                <legend>{account.email}</legend>
                {account.characters.length ? (
                  account.characters.map((character) => (
                    <label key={character.id}>
                      <input
                        type="radio"
                        name="staff-target"
                        disabled={busy || !character.playable}
                        checked={selection?.characterId === character.id}
                        onChange={() => choose(account, character.id)}
                      />
                      <span>
                        {character.name}
                        {!character.playable ? ' · Pending deletion' : ''}
                      </span>
                    </label>
                  ))
                ) : (
                  <p>No linked characters.</p>
                )}
              </fieldset>
            ))}
          </section>
        ) : null}
        <div className={styles.rows}>
          {staff.length === 0 ? (
            <p>No staff assignments.</p>
          ) : (
            staff.map((member) => {
              const owner = member.status === 'owner'
              const name =
                member.characterName ??
                (owner ? 'WORLDWRIGHT · GAME OWNER' : 'Unbound legacy grant')
              return (
                <article className={styles.row} key={member.userId + ':' + member.characterId}>
                  <div className={styles.identity}>
                    <strong>{name}</strong>
                    <span>{member.email ?? 'Email unavailable'}</span>
                  </div>
                  <div className={styles.scope}>
                    <span>
                      {member.roles
                        .map(
                          (role) =>
                            roleOptions.find((o) => o.id === role)?.label ??
                            (role === 'game-owner' ? 'Game Owner' : role),
                        )
                        .join(' · ')}
                    </span>
                    <small>
                      {statusLabels[member.status]} · {staffUtcDate(member.expiresAt)}
                    </small>
                  </div>
                  <div className={styles.actions}>
                    {!owner ? (
                      <button
                        type="button"
                        aria-label={'Edit ' + name}
                        disabled={busy || !member.email}
                        onClick={() => {
                          setQuery(member.email ?? '')
                          void find(member.email ?? '', member.characterId ?? undefined)
                        }}
                      >
                        Edit
                      </button>
                    ) : (
                      <span>Nondelegable</span>
                    )}
                    {!owner ? (
                      <button
                        type="button"
                        aria-label={'Revoke ' + name}
                        disabled={busy || member.status === 'revoked'}
                        onClick={() => {
                          setError(null)
                          setRevoke(member)
                        }}
                      >
                        Revoke
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>
      <section
        className={styles.editor}
        ref={editorRef}
        tabIndex={-1}
        aria-label="Selected character access"
      >
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        ) : null}
        {selection ? (
          <StaffAccessEditor
            key={selection.characterId}
            account={selection.account}
            characterId={selection.characterId}
            member={staff.find((s) => s.characterId === selection.characterId)}
            legacy={staff.find(
              (s) => s.userId === selection.account.userId && s.status === 'needs-binding',
            )}
            ownerIdentity={staff.some(
              (s) => s.userId === selection.account.userId && s.status === 'owner',
            )}
            roleOptions={roleOptions}
            capabilityOptions={capabilityOptions}
            onSaved={() => {
              setSelection(null)
              setNotice('Selected-character access saved.')
              router.refresh()
            }}
          />
        ) : (
          <div className={styles.empty}>
            <h2>Assign or edit access</h2>
            <p>
              Find a verified identity, then explicitly select one linked character. Editing a
              legacy grant requires binding it to that character.
            </p>
            <p>
              Game Owner identity, staff management, Site Music and global settings remain protected
              Owner powers.
            </p>
          </div>
        )}
      </section>
      {revoke ? (
        <CharacterDeletionDialog titleId={dialogId} busy={busy} onDismiss={() => setRevoke(null)}>
          <h2 id={dialogId}>Revoke {revoke.characterName ?? revoke.email}’s access?</h2>
          <p>
            All delegated roles and special permissions for this character will stop authorizing
            protected actions immediately.
          </p>
          {error ? <p role="alert">{error}</p> : null}
          <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={() => setRevoke(null)}>
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={() => void revokeSelected()}>
              {busy ? 'Revoking…' : 'Revoke access'}
            </button>
          </div>
        </CharacterDeletionDialog>
      ) : null}
    </div>
  )
}

function StaffAccessEditor({
  account,
  characterId,
  member,
  legacy,
  ownerIdentity,
  roleOptions,
  capabilityOptions,
  onSaved,
}: {
  account: MasterPanelAccountReference
  characterId: string
  member?: MasterPanelStaffSummary
  legacy?: MasterPanelStaffSummary
  ownerIdentity: boolean
  roleOptions: readonly Option[]
  capabilityOptions: readonly Option[]
  onSaved: () => void
}) {
  const [roles, setRoles] = useState<readonly string[]>(
    member?.roles ?? legacy?.roles ?? ['content-staff'],
  )
  const [capabilities, setCapabilities] = useState<readonly string[]>(
    member?.specialCapabilities ?? legacy?.specialCapabilities ?? [],
  )
  const [days, setDays] = useState('')
  const [expiryChosen, setExpiryChosen] = useState(!member)
  const [bound, setBound] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openedAt] = useState(() => Date.now())
  const character = account.characters.find((c) => c.id === characterId)!
  const validDays =
    days === '' ||
    (Number.isSafeInteger(Number(days)) &&
      Number(days) > 0 &&
      Number(days) <= 2147483647 &&
      Number.isFinite(openedAt + Number(days) * 86400000) &&
      openedAt + Number(days) * 86400000 < 8640000000000000)
  const expiry =
    days !== '' && validDays ? new Date(openedAt + Number(days) * 86400000).toISOString() : null
  function preset(value: string) {
    setRoles(value === 'operations' ? ['moderator', 'content-staff', 'event-staff'] : [value])
    setCapabilities([])
    setConfirmed(false)
  }
  async function save() {
    setBusy(true)
    setError(null)
    try {
      await post({
        operation: 'set-character-access',
        targetCharacterId: characterId,
        roles,
        specialCapabilities: capabilities,
        days: days === '' ? null : Number(days),
        bindLegacy: bound,
        expectedAccessVersion: member?.accessVersion ?? legacy?.accessVersion ?? null,
        confirmed: true,
      })
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Access could not be saved.')
    } finally {
      setBusy(false)
    }
  }
  if (ownerIdentity)
    return (
      <>
        <h2>Protected Game Owner</h2>
        <p>The Owner’s identity cannot be delegated, rebound, revoked or modified here.</p>
      </>
    )
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <header>
        <p className={styles.kicker}>Selected character only</p>
        <h2>{character.name}</h2>
        <p>{account.email}</p>
      </header>
      <label>
        Role preset
        <select defaultValue="" disabled={busy} onChange={(event) => preset(event.target.value)}>
          <option value="" disabled>
            Choose a preset
          </option>
          <option value="content-staff">Content administration</option>
          <option value="event-staff">Event administration</option>
          <option value="moderator">Moderator / support</option>
          <option value="operations">Global administration · delegated operations</option>
        </select>
      </label>
      <fieldset>
        <legend>Role scope</legend>
        {roleOptions.map((option) => (
          <label className={styles.check} key={option.id}>
            <input
              type="checkbox"
              checked={roles.includes(option.id)}
              disabled={busy}
              onChange={(event) => {
                setRoles(
                  event.target.checked
                    ? [...roles, option.id]
                    : roles.filter((role) => role !== option.id),
                )
                setConfirmed(false)
              }}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <p className={styles.summary}>
        Effective scope:{' '}
        {roles.map((role) => roleOptions.find((o) => o.id === role)?.label).join(' · ') ||
          'No roles selected'}
        . {capabilities.length} special permissions. Staff management, Owner identity, Site Music
        and global settings are excluded.
      </p>
      <details>
        <summary>Special permissions · {capabilities.length} selected</summary>
        <div className={styles.permissions}>
          {capabilityOptions.map((option) => (
            <label className={styles.check} key={option.id}>
              <input
                type="checkbox"
                checked={capabilities.includes(option.id)}
                disabled={busy}
                onChange={(event) => {
                  setCapabilities(
                    event.target.checked
                      ? [...capabilities, option.id]
                      : capabilities.filter((c) => c !== option.id),
                  )
                  setConfirmed(false)
                }}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
      </details>
      <label>
        Expiry
        <select
          value={!expiryChosen ? '' : days === '' ? 'none' : 'days'}
          disabled={busy}
          onChange={(event) => {
            setDays(event.target.value === 'none' ? '' : '1')
            setExpiryChosen(true)
            setConfirmed(false)
          }}
        >
          <option value="" disabled>
            Choose expiry
          </option>
          <option value="none">No Expiry</option>
          <option value="days">After a number of days</option>
        </select>
      </label>
      {days !== '' ? (
        <label>
          Days
          <input
            type="number"
            min={1}
            step={1}
            value={days}
            disabled={busy}
            onChange={(event) => {
              setDays(event.target.value || '0')
              setConfirmed(false)
            }}
          />
        </label>
      ) : null}
      <p>
        {validDays
          ? `Resulting expiry: ${staffUtcDate(expiry)}${expiry ? ' (estimate; server starts the duration when saved)' : ''}`
          : 'Enter a positive whole number of days.'}
      </p>
      {member ? (
        <p>
          Current expiry: {staffUtcDate(member.expiresAt)}. Saving replaces the selected character’s
          current scope and duration.
        </p>
      ) : null}
      {legacy ? (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={bound}
            disabled={busy}
            onChange={(event) => setBound(event.target.checked)}
          />
          <span>
            Bind legacy authority explicitly to {character.name}; disable the unbound account
            grants.
          </span>
        </label>
      ) : null}
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>Confirm access for {character.name} only</span>
      </label>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={
          busy || !confirmed || !roles.length || !validDays || !expiryChosen || (!!legacy && !bound)
        }
      >
        {busy ? 'Saving…' : 'Save character access'}
      </button>
      <p className={styles.audit}>Actor, character, time and changes are recorded automatically.</p>
    </form>
  )
}
