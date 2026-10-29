'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  orderedMasterPanelPages,
  type MasterPanelPage,
  type MasterPanelTab,
} from '@/lib/master-panel-pages'
import styles from './staff-management.module.css'
import { MasterHelp } from './master-help'
import type {
  DelegatedMasterPanelRole,
  MasterPanelRoleDefaults,
} from '@/server/master/staff-access'

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
  readonly navigationOrder?: readonly MasterPanelTab[]
  readonly roleDefaults?: MasterPanelRoleDefaults
  readonly staff: readonly StaffMember[]
  readonly roleOptions: readonly Option[]
  readonly capabilityOptions?: readonly Option[]
}
function utc(value: string | null): string {
  return value
    ? new Date(value)
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d{3}Z$/, ' UTC')
    : 'No Expiry'
}
function scope(roles: readonly string[]): string {
  const labels: string[] = []
  if (roles.includes('game-owner')) return 'Global administration · protected Owner'
  if (roles.includes('moderator')) labels.push('Moderation access')
  if (roles.includes('content-staff')) labels.push('Game Content authoring')
  if (roles.includes('event-staff')) labels.push('Event authoring and live operations')
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
export function StaffManagement({
  staff,
  roleOptions,
  roleDefaults,
  navigationOrder,
}: StaffManagementProps) {
  const router = useRouter(),
    editorRef = useRef<HTMLHeadingElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const lookupRef = useRef<HTMLInputElement>(null)
  const restoreFocus = useRef(false)
  const [revokedCharacters, setRevokedCharacters] = useState<readonly string[]>([])
  const visibleStaff = staff.filter(
    (member) =>
      member.status !== 'revoked' &&
      (!member.characterId || !revokedCharacters.includes(member.characterId)),
  )
  const [query, setQuery] = useState(''),
    [identity, setIdentity] = useState<ResolvedAccount | null>(null)
  const [selected, setSelected] = useState(''),
    [roles, setRoles] = useState<string[]>([])
  const [duration, setDuration] = useState('none'),
    [days, setDays] = useState('7'),
    [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null)
  const [previewClock, setPreviewClock] = useState(() => Date.now())
  const [defaults, setDefaults] = useState(roleDefaults)
  const [defaultDraft, setDefaultDraft] = useState(roleDefaults?.roles)
  const [defaultRole, setDefaultRole] = useState<DelegatedMasterPanelRole>('moderator')
  const defaultCapabilityOptions = orderedMasterPanelPages(navigationOrder)
  const defaultsChanged = JSON.stringify(defaultDraft) !== JSON.stringify(defaults?.roles)
  async function saveDefaults() {
    if (!defaults || !defaultDraft || pending || !defaultsChanged) return
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const result = await post({
        operation: 'save-role-defaults',
        expectedRevision: defaults.revision,
        roles: defaultDraft,
      })
      const saved = result.defaults as MasterPanelRoleDefaults
      setDefaults(saved)
      setDefaultDraft(saved.roles)
      setNotice('Role defaults saved.')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Role defaults could not be saved.')
    } finally {
      setPending(false)
    }
  }
  async function reloadDefaults() {
    setPending(true)
    setError(null)
    try {
      const result = await post({ operation: 'read-role-defaults' })
      const saved = result.defaults as MasterPanelRoleDefaults
      setDefaults(saved)
      setDefaultDraft(saved.roles)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Role defaults are unavailable.')
    } finally {
      setPending(false)
    }
  }
  useEffect(() => {
    if (identity) editorRef.current?.focus()
  }, [identity])
  useEffect(() => {
    if (identity || pending || !restoreFocus.current) return
    const frame = requestAnimationFrame(() => {
      const opener = openerRef.current
      if (opener?.isConnected && !opener.matches(':disabled')) opener.focus()
      else lookupRef.current?.focus()
      restoreFocus.current = false
    })
    return () => cancelAnimationFrame(frame)
  }, [identity, pending])
  function closeEditor() {
    restoreFocus.current = true
    setIdentity(null)
    setSelected('')
    setConfirmed(false)
  }
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
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
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
        specialCapabilities: [],
        days: duration === 'none' ? null : Number(days),
        expectedVersion: existing?.accessVersion ?? 0,
        enabled,
        confirmed,
      })
      setRevokedCharacters((current) =>
        enabled ? current.filter((id) => id !== selected) : [...new Set([...current, selected])],
      )
      setNotice(`${linked?.name ?? 'Character'} access ${enabled ? 'saved' : 'revoked'}.`)
      closeEditor()
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
    <div className={`${styles.layout} ${identity || defaults ? styles.withEditor : ''}`}>
      <section className={styles.directory} aria-labelledby="staff-directory-title">
        <div className={styles.heading}>
          <h2 id="staff-directory-title">Staff directory</h2>
          <span>{visibleStaff.length} staff</span>
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
              ref={lookupRef}
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
          <div className={styles.columns} aria-hidden="true">
            <span>Staff</span>
            <span>Roles</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {visibleStaff.length === 0 && (
            <p>No staff assignments yet. Find a verified identity to assign a linked character.</p>
          )}
          {visibleStaff.map((member, index) => (
            <article className={styles.row} key={member.characterId ?? `${member.userId}:${index}`}>
              <div className={styles.identity}>
                <strong>
                  {member.characterName ??
                    (member.status === 'owner' ? 'Game Owner' : 'Choose character')}
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
                        roleOptions.find((option) => option.id === role)?.label ??
                        (role === 'game-owner' ? 'Game Owner' : role),
                    )
                    .join(', ')}
                </strong>
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
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      {!identity && defaults && defaultDraft && (
        <section className={styles.editor} aria-labelledby="role-defaults-title">
          <div className={styles.heading}>
            <h2 id="role-defaults-title">Role page access</h2>
            <MasterHelp label="Role page access">
              Changes apply immediately to existing staff. Each page includes all of its tools. Only
              the Game Owner can manage Staff & Access.
            </MasterHelp>
          </div>
          <label htmlFor="staff-default-role">Role</label>
          <select
            id="staff-default-role"
            value={defaultRole}
            disabled={pending}
            onChange={(event) => setDefaultRole(event.target.value as DelegatedMasterPanelRole)}
          >
            {roleOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <fieldset disabled={pending}>
            <legend>Accessible pages</legend>
            <div className={styles.defaultPermissions}>
              {defaultCapabilityOptions.map((option) => (
                <label key={option.id}>
                  <input
                    type="checkbox"
                    aria-label={option.label}
                    checked={defaultDraft[defaultRole].includes(option.id as MasterPanelPage)}
                    onChange={() => {
                      const capability = option.id as MasterPanelPage
                      const current = defaultDraft[defaultRole]
                      setDefaultDraft({
                        ...defaultDraft,
                        [defaultRole]: current.includes(capability)
                          ? current.filter((value) => value !== capability)
                          : [...current, capability],
                      })
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className={styles.actions}>
            <button disabled={pending || !defaultsChanged} onClick={saveDefaults}>
              Save role defaults
            </button>
            <button disabled={pending} onClick={reloadDefaults}>
              Reload defaults
            </button>
          </div>
        </section>
      )}
      {identity && (
        <section className={styles.editor} aria-labelledby="staff-editor-title">
          <div className={styles.heading}>
            <h2 id="staff-editor-title" tabIndex={-1} ref={editorRef}>
              Character access
            </h2>
            <button onClick={closeEditor} disabled={pending}>
              Close editor
            </button>
          </div>
          <p className={styles.verified}>{identity.email}</p>
          <label htmlFor="staff-character">Character</label>
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
                <legend>
                  Roles{' '}
                  <MasterHelp label="Staff roles">
                    {roleOptions.map((option) => (
                      <p key={option.id}>
                        <strong>{option.label}</strong>: {option.description}
                      </p>
                    ))}
                  </MasterHelp>
                </legend>
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
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className={styles.summary}>
                <strong>Accessible pages</strong>
                <p>
                  {defaults
                    ? [
                        ...new Set([
                          ...roles.flatMap(
                            (role) => defaults.roles[role as DelegatedMasterPanelRole] ?? [],
                          ),
                        ]),
                      ]
                        .map(
                          (capability) =>
                            defaultCapabilityOptions.find((option) => option.id === capability)
                              ?.label ?? capability,
                        )
                        .join(' · ') || 'None'
                    : scope(roles)}
                </p>
              </div>
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
              <div className={styles.expiryPreview}>
                {validDays
                  ? `Expiry on save: ${utc(preview)}`
                  : 'Enter a positive whole number of days (1–36500).'}
                {duration === 'days' && (
                  <MasterHelp label="Expiry">
                    UTC estimate. The server records the exact expiry when saved.
                  </MasterHelp>
                )}
              </div>
              <label className={styles.confirm}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={pending}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>Confirm access change for {linked?.name}.</span>
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
