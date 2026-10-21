'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import styles from './staff-management.module.css'

interface Option {
  readonly id: string
  readonly label: string
  readonly description: string
}
interface StaffMember {
  readonly userId: string
  readonly email: string | null
  readonly characterId: string | null
  readonly characterName: string | null
  readonly accessVersion: number
  readonly roles: readonly string[]
  readonly specialCapabilities: readonly string[]
  readonly status: string
  readonly expiresAt: string | null
}
interface ResolvedAccount {
  readonly userId: string
  readonly email: string
  readonly characters: readonly { characterId: string; name: string; playable: boolean }[]
}
interface StaffManagementProps {
  readonly staff: readonly StaffMember[]
  readonly roleOptions: readonly Option[]
  readonly capabilityOptions: readonly Option[]
}
function utc(value: string | null): string {
  return value
    ? new Date(value)
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d{3}Z$/, ' UTC')
    : 'No Expiry'
}
function scope(roles: readonly string[], caps: readonly string[]): string {
  const labels: string[] = []
  if (roles.includes('game-owner')) return 'Global administration · protected Owner'
  if (roles.includes('moderator')) labels.push('Moderation access')
  if (roles.includes('content-staff')) labels.push('Game Content authoring')
  if (roles.includes('event-staff')) labels.push('Event authoring and live operations')
  if (caps.length)
    labels.push(`${caps.length} additional permission${caps.length === 1 ? '' : 's'}`)
  return labels.join(' · ') || 'Choose a role'
}
function errorMessage(value: unknown): string {
  if (value && typeof value === 'object' && 'error' in value) {
    const error = value.error
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    )
      return error.message
  }
  return 'Staff & Access could not complete this request.'
}
export function StaffManagement({ staff, roleOptions, capabilityOptions }: StaffManagementProps) {
  const router = useRouter(),
    editorRef = useRef<HTMLHeadingElement>(null)
  const [query, setQuery] = useState(''),
    [identity, setIdentity] = useState<ResolvedAccount | null>(null)
  const [selected, setSelected] = useState(''),
    [roles, setRoles] = useState<string[]>([]),
    [caps, setCaps] = useState<string[]>([])
  const [duration, setDuration] = useState('none'),
    [days, setDays] = useState('7'),
    [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null)
  const [previewClock, setPreviewClock] = useState(() => Date.now())
  useEffect(() => {
    if (identity) editorRef.current?.focus()
  }, [identity])
  const existing = staff.find(
    (row) => row.characterId === selected && row.userId === identity?.userId,
  )
  const linked = identity?.characters.find((row) => row.characterId === selected)
  const validDays =
    duration === 'none' ||
    (Number.isSafeInteger(Number(days)) && Number(days) > 0 && Number(days) <= 36500)
  const canSave = Boolean(
    identity && linked?.playable && roles.length && validDays && confirmed && !pending,
  )
  async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await fetch('/api/master/staff-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body),
    })
    const payload: unknown = await response.json()
    if (!response.ok) throw new Error(errorMessage(payload))
    return payload as Record<string, unknown>
  }
  function choose(characterId: string, account: ResolvedAccount) {
    const row = staff.find(
      (member) => member.characterId === characterId && member.userId === account.userId,
    )
    setSelected(characterId)
    setRoles([...(row?.roles ?? [])])
    setCaps([...(row?.specialCapabilities ?? [])])
    setDuration(row?.expiresAt ? 'days' : 'none')
    setDays(
      row?.expiresAt
        ? String(Math.max(1, Math.ceil((Date.parse(row.expiresAt) - Date.now()) / 86400000)))
        : '7',
    )
    setConfirmed(false)
    setPreviewClock(Date.now())
  }
  async function resolve(value: string, characterId?: string) {
    setPending(true)
    setError(null)
    setNotice(null)
    setIdentity(null)
    setSelected('')
    setConfirmed(false)
    try {
      const payload = await post({ operation: 'resolve-account', query: value.trim() })
      const account = payload.account as ResolvedAccount | null
      if (!account) {
        setError('No verified identity matches that exact character name or email.')
        return
      }
      setIdentity(account)
      if (characterId) choose(characterId, account)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Identity lookup failed.')
    } finally {
      setPending(false)
    }
  }
  function toggle(value: string, values: string[], setter: (values: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
    setConfirmed(false)
  }
  async function save(enabled: boolean) {
    if (!canSave || !identity) return
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      await post({
        operation: 'set-character-access',
        targetUserId: identity.userId,
        targetCharacterId: selected,
        roles,
        specialCapabilities: caps,
        days: duration === 'none' ? null : Number(days),
        expectedVersion: existing?.accessVersion ?? 0,
        enabled,
        confirmed,
      })
      setNotice(`${linked?.name ?? 'Character'} access ${enabled ? 'saved' : 'revoked'}.`)
      setIdentity(null)
      setSelected('')
      setConfirmed(false)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Access change failed.')
    } finally {
      setPending(false)
    }
  }
  const preview =
    duration === 'none' || !validDays
      ? null
      : new Date(previewClock + Number(days) * 86400000).toISOString()
  return (
    <div className={styles.layout}>
      <section className={styles.directory} aria-labelledby="staff-directory-title">
        <div className={styles.heading}>
          <h2 id="staff-directory-title">Staff directory</h2>
          <span>{staff.length} records</span>
        </div>
        <form
          className={styles.lookup}
          onSubmit={(event) => {
            event.preventDefault()
            void resolve(query)
          }}
        >
          <label htmlFor="staff-identity">Character name or verified email</label>
          <div>
            <input
              id="staff-identity"
              autoComplete="off"
              maxLength={320}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Exact name or email"
            />
            <button disabled={pending || !query.trim()}>Find identity</button>
          </div>
        </form>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
        {pending && <p role="status">Checking verified access…</p>}
        <div className={styles.rows}>
          {staff.length === 0 && (
            <p>No staff assignments yet. Find a verified identity to assign a linked character.</p>
          )}
          {staff.map((member, index) => (
            <article className={styles.row} key={member.characterId ?? `${member.userId}:${index}`}>
              <div className={styles.identity}>
                <strong>
                  {member.characterName ??
                    (member.status === 'owner' ? 'Game Owner' : 'Unbound legacy account')}
                </strong>
                <span title={member.email ?? undefined}>
                  {member.email ?? 'Verified identity unavailable'}
                </span>
              </div>
              <div>
                <strong>
                  {member.roles
                    .map(
                      (role) =>
                        roleOptions.find((option) => option.id === role)?.label ?? 'Game Owner',
                    )
                    .join(', ')}
                </strong>
                <span>{scope(member.roles, member.specialCapabilities)}</span>
              </div>
              <div>
                <strong>
                  {member.status === 'needs-binding' ? 'Needs binding' : member.status}
                </strong>
                <span>{utc(member.expiresAt)}</span>
              </div>
              <div className={styles.actions}>
                {member.status === 'owner' ? (
                  <span>Protected</span>
                ) : (
                  <>
                    <button
                      disabled={pending}
                      onClick={() =>
                        void resolve(
                          member.email ?? member.characterName ?? '',
                          member.characterId ?? undefined,
                        )
                      }
                    >
                      {member.status === 'needs-binding' ? 'Bind character' : 'Edit'}
                    </button>
                    {member.characterId && member.status !== 'revoked' && (
                      <button
                        disabled={pending}
                        onClick={() => {
                          void resolve(
                            member.email ?? member.characterName ?? '',
                            member.characterId ?? undefined,
                          )
                          setNotice('Review the character, confirm, then Revoke access.')
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      {identity && (
        <section className={styles.editor} aria-labelledby="staff-editor-title">
          <div className={styles.heading}>
            <h2 id="staff-editor-title" tabIndex={-1} ref={editorRef}>
              Character access
            </h2>
            <button
              onClick={() => {
                setIdentity(null)
                setSelected('')
              }}
              disabled={pending}
            >
              Close editor
            </button>
          </div>
          <p className={styles.verified}>
            {identity.email} <span>Verified identity</span>
          </p>
          <label htmlFor="staff-character">Linked character · choose exactly one</label>
          <select
            id="staff-character"
            value={selected}
            onChange={(event) => choose(event.target.value, identity)}
            disabled={pending}
          >
            <option value="">Select a character</option>
            {identity.characters.map((character) => (
              <option
                key={character.characterId}
                value={character.characterId}
                disabled={!character.playable}
              >
                {character.name}
                {character.playable ? '' : ' · deletion pending'}
              </option>
            ))}
          </select>
          {identity.characters.length === 0 && <p>This identity has no linked characters.</p>}
          {selected && (
            <>
              <fieldset disabled={pending}>
                <legend>Role presets</legend>
                <div className={styles.presets}>
                  {roleOptions.map((option) => (
                    <label key={option.id}>
                      <input
                        type="checkbox"
                        checked={roles.includes(option.id)}
                        onChange={() => toggle(option.id, roles, setRoles)}
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className={styles.summary}>
                <strong>Effective scope</strong>
                <p>{scope(roles, caps)}</p>
                {caps.length > 0 && (
                  <p>
                    {caps
                      .map(
                        (cap) =>
                          capabilityOptions.find((option) => option.id === cap)?.label ?? cap,
                      )
                      .join(' · ')}
                  </p>
                )}
                <small>
                  Staff delegation, global settings and identity changes remain protected Game Owner
                  powers.
                </small>
              </div>
              <details className={styles.additional}>
                <summary>Additional scoped permissions</summary>
                <div>
                  {capabilityOptions.map((option) => (
                    <label key={option.id}>
                      <input
                        type="checkbox"
                        disabled={pending}
                        checked={caps.includes(option.id)}
                        onChange={() => toggle(option.id, caps, setCaps)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </details>
              <div className={styles.expiry}>
                <label htmlFor="staff-expiry">
                  Duration
                  <select
                    id="staff-expiry"
                    value={duration}
                    disabled={pending}
                    onChange={(event) => {
                      setDuration(event.target.value)
                      setConfirmed(false)
                      setPreviewClock(Date.now())
                    }}
                  >
                    <option value="none">No Expiry</option>
                    <option value="days">Number of days</option>
                  </select>
                </label>
                {duration === 'days' && (
                  <label htmlFor="staff-days">
                    Days
                    <input
                      id="staff-days"
                      type="number"
                      min="1"
                      max="36500"
                      step="1"
                      value={days}
                      disabled={pending}
                      onChange={(event) => {
                        setDays(event.target.value)
                        setConfirmed(false)
                        setPreviewClock(Date.now())
                      }}
                    />
                  </label>
                )}
              </div>
              <p className={styles.expiryPreview}>
                {validDays
                  ? `Expiry on save: ${utc(preview)}`
                  : 'Enter a positive whole number of days (1–36500).'}
                {duration === 'days' && (
                  <small>UTC estimate; the server records the exact expiry when saved.</small>
                )}
              </p>
              <label className={styles.confirm}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={pending}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  Confirm access change for {linked?.name}. Other linked characters receive no
                  powers.
                </span>
              </label>
              <div className={styles.actions}>
                <button disabled={!canSave} onClick={() => void save(true)}>
                  Save character access
                </button>
                {existing && existing.status !== 'revoked' && (
                  <button disabled={!canSave} onClick={() => void save(false)}>
                    Revoke access
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
