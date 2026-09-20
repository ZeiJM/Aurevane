'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import styles from './staff-management.module.css'

interface RoleOption {
  readonly id: string
  readonly label: string
  readonly description: string
}

interface CapabilityOption {
  readonly id: string
  readonly label: string
  readonly description: string
}

interface StaffMember {
  readonly userId: string
  readonly email: string | null
  readonly accessVersion: number
  readonly roles: readonly string[]
  readonly specialCapabilities: readonly string[]
}

interface ResolvedAccount {
  readonly userId: string
  readonly email: string
}

interface StaffManagementProps {
  readonly staff: readonly StaffMember[]
  readonly roleOptions: readonly RoleOption[]
  readonly capabilityOptions: readonly CapabilityOption[]
}

type MutationOperation = 'grant-role' | 'revoke-role' | 'grant-capability' | 'revoke-capability'

function responseMessage(payload: unknown): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'object' &&
    payload.error !== null &&
    'message' in payload.error &&
    typeof payload.error.message === 'string'
  ) {
    return payload.error.message
  }
  return 'The staff authority request could not be completed.'
}

export function StaffManagement({ staff, roleOptions, capabilityOptions }: StaffManagementProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(staff[0]?.userId ?? '')
  const [resolved, setResolved] = useState<ResolvedAccount | null>(null)
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const staffByUserId = useMemo(
    () => new Map(staff.map((member) => [member.userId, member] as const)),
    [staff],
  )

  const selectedStaff = staffByUserId.get(selectedUserId) ?? staff[0] ?? null
  const activeTarget = resolved ?? selectedStaff
  const activeRoles = selectedStaff?.roles ?? []
  const activeCapabilities = selectedStaff?.specialCapabilities ?? []
  const canMutate = confirmed && reason.trim() === reason && reason.length >= 3

  async function post(body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch('/api/master/staff-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body),
    })
    const payload: unknown = await response.json()
    if (!response.ok) throw new Error(responseMessage(payload))
    return payload
  }

  async function resolveAccount() {
    setBusyKey('resolve')
    setError(null)
    setNotice(null)
    try {
      const payload = (await post({ operation: 'resolve-account', email })) as {
        account?: ResolvedAccount | null
      }
      if (!payload.account) {
        setResolved(null)
        setError('No account matches that exact email address.')
        return
      }
      setResolved(payload.account)
      setNotice('Account resolved. Choose the authority to grant or revoke below.')
    } catch (caught) {
      setResolved(null)
      setError(caught instanceof Error ? caught.message : 'Account lookup failed.')
    } finally {
      setBusyKey(null)
    }
  }

  async function mutate(
    operation: MutationOperation,
    targetUserId: string,
    key: 'role' | 'capability',
    value: string,
  ) {
    const actionKey = [operation, targetUserId, value].join(':')
    setBusyKey(actionKey)
    setError(null)
    setNotice(null)
    try {
      await post({
        operation,
        targetUserId,
        [key]: value,
        reason,
        confirmed: true,
      })
      setNotice('Staff authority updated and access version advanced where required.')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Staff authority update failed.')
    } finally {
      setBusyKey(null)
    }
  }

  function controlsFor(member: StaffMember | ResolvedAccount) {
    const current = staffByUserId.get(member.userId)
    const roles = new Set(current?.roles ?? [])
    const capabilities = new Set(current?.specialCapabilities ?? [])
    const hasDelegatedRole = roles.size > 0
    const identity = member.email ?? member.userId

    if (roles.has('game-owner')) {
      return (
        <p className={styles.ownerNote}>
          The protected Game Owner identity cannot be created, removed, or modified here.
        </p>
      )
    }

    return (
      <div className={styles.controls}>
        <section className={styles.controlGroup} aria-label={'Role controls for ' + identity}>
          <h4>Delegated roles</h4>
          <div className={styles.controlList}>
            {roleOptions.map((option) => {
              const active = roles.has(option.id)
              const operation = active ? 'revoke-role' : 'grant-role'
              const actionKey = [operation, member.userId, option.id].join(':')
              return (
                <div className={styles.controlRow} data-active={active || undefined} key={option.id}>
                  <div>
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </div>
                  <button
                    type="button"
                    disabled={!canMutate || busyKey !== null}
                    onClick={() => mutate(operation, member.userId, 'role', option.id)}
                  >
                    {busyKey === actionKey ? 'Working…' : active ? 'Revoke' : 'Grant'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        <section
          className={styles.controlGroup}
          aria-label={'Special capability controls for ' + identity}
        >
          <h4>Special capabilities</h4>
          <p>
            These are explicit account grants. They never create another role and never include root
            Master Panel access or staff management.
          </p>
          {!hasDelegatedRole ? (
            <p className={styles.ownerNote}>
              Grant at least one delegated staff role before adding a special capability.
            </p>
          ) : null}
          <div className={styles.controlList}>
            {capabilityOptions.map((option) => {
              const active = capabilities.has(option.id)
              const operation = active ? 'revoke-capability' : 'grant-capability'
              const actionKey = [operation, member.userId, option.id].join(':')
              return (
                <div className={styles.controlRow} data-active={active || undefined} key={option.id}>
                  <div>
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </div>
                  <button
                    type="button"
                    disabled={!canMutate || busyKey !== null || (!active && !hasDelegatedRole)}
                    onClick={() => mutate(operation, member.userId, 'capability', option.id)}
                  >
                    {busyKey === actionKey ? 'Working…' : active ? 'Revoke' : 'Grant'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.rosterPane}>
        <section className={styles.lookup}>
          <div className={styles.navigatorHeading}>
            <div>
              <p className={styles.kicker}>Staff directory</p>
              <h2>Staff members</h2>
            </div>
            <span>{staff.length}</span>
          </div>
          <p>Find an exact account or select an existing staff member.</p>
          <div className={styles.lookupForm}>
            <label>
              <span>Account email</span>
              <input
                autoComplete="off"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@example.com"
                type="email"
                value={email}
              />
            </label>
            <button
              type="button"
              disabled={busyKey !== null || email.length < 3}
              onClick={resolveAccount}
            >
              {busyKey === 'resolve' ? 'Finding…' : 'Find'}
            </button>
          </div>
        </section>

        <section className={styles.staffList} aria-label="Current staff">
          <div className={styles.rosterFilters} aria-label="Staff filters">
            <span>All</span>
            <span>Owner</span>
            <span>Staff</span>
          </div>

          <div className={styles.rosterList}>
            {staff.map((member) => {
              const selected = selectedStaff?.userId === member.userId
              const owner = member.roles.includes('game-owner')
              return (
                <button
                  className={styles.rosterRow}
                  data-selected={selected || undefined}
                  key={member.userId}
                  type="button"
                  onClick={() => {
                    setSelectedUserId(member.userId)
                    setResolved(null)
                  }}
                >
                  <span className={styles.rosterGlyph} aria-hidden="true">
                    {owner ? '♛' : '✦'}
                  </span>
                  <span className={styles.rosterIdentity}>
                    <strong>{member.email ?? 'Account email unavailable'}</strong>
                    <small>{owner ? 'WORLDWRIGHT · GAME OWNER' : 'Staff account'}</small>
                  </span>
                  <span className={styles.rosterAuthority}>
                    {member.roles[0]?.replaceAll('-', ' ') ?? 'capability-only'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </aside>

      <main className={styles.authorityWorkspace}>
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

        {resolved ? (
          <article className={styles.resolved}>
            <header className={styles.accountHeader}>
              <div className={styles.accountGlyph} aria-hidden="true">
                ✦
              </div>
              <div>
                <span>Resolved account</span>
                <strong>{resolved.email}</strong>
                <small>New or existing staff target</small>
              </div>
            </header>
            <nav className={styles.workspaceTabs} aria-label="Staff workspace">
              <span>Role &amp; capabilities</span>
              <span>Profile</span>
              <span>Notes</span>
              <span>History</span>
            </nav>
            {controlsFor(resolved)}
          </article>
        ) : selectedStaff ? (
          <article className={styles.staffCard}>
            <header className={styles.accountHeader}>
              <div className={styles.accountGlyph} aria-hidden="true">
                {selectedStaff.roles.includes('game-owner') ? '♛' : '✦'}
              </div>
              <div>
                <span>
                  {selectedStaff.roles.includes('game-owner')
                    ? 'WORLDWRIGHT · GAME OWNER'
                    : 'Staff account'}
                </span>
                <strong>{selectedStaff.email ?? 'Account email unavailable'}</strong>
                <small>Access v{selectedStaff.accessVersion}</small>
              </div>
            </header>

            <nav className={styles.workspaceTabs} aria-label="Staff workspace">
              <span data-active="true">Role &amp; capabilities</span>
              <span>Profile</span>
              <span>Notes</span>
              <span>History</span>
            </nav>

            <div className={styles.chips} aria-label="Current authority">
              {selectedStaff.roles.map((role) => (
                <span key={role}>{role.replaceAll('-', ' ')}</span>
              ))}
              {selectedStaff.specialCapabilities.map((capability) => (
                <span key={capability}>{capability}</span>
              ))}
            </div>

            {controlsFor(selectedStaff)}
          </article>
        ) : (
          <section className={styles.emptyState}>
            <h2>No staff account selected</h2>
            <p>Choose a staff member or resolve an exact account email.</p>
          </section>
        )}
      </main>

      <aside className={styles.authorityDock}>
        <section className={styles.statusCard}>
          <div className={styles.dockHeading}>
            <h2>Account status</h2>
            <span>{activeTarget ? 'Active' : 'No selection'}</span>
          </div>
          <dl>
            <div>
              <dt>Account</dt>
              <dd>{activeTarget?.email ?? '—'}</dd>
            </div>
            <div>
              <dt>Roles</dt>
              <dd>{activeRoles.length}</dd>
            </div>
            <div>
              <dt>Capabilities</dt>
              <dd>{activeCapabilities.length}</dd>
            </div>
            <div>
              <dt>Access version</dt>
              <dd>{selectedStaff ? `v${selectedStaff.accessVersion}` : '—'}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.guardrail}>
          <div className={styles.guardrailHeading}>
            <div>
              <h2>Safety &amp; confirmation</h2>
              <p>Every live authority mutation requires an explicit reason and confirmation.</p>
            </div>
            <span>Audit enforced</span>
          </div>
          <div className={styles.guardrailFields}>
            <label>
              <span>Reason</span>
              <textarea
                maxLength={240}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why is this authority required or being removed?"
                rows={3}
                value={reason}
              />
            </label>
            <label className={styles.confirmation}>
              <input
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                type="checkbox"
              />
              <span>Confirm live authority change</span>
            </label>
          </div>
        </section>

        <section className={styles.auditCard}>
          <div className={styles.dockHeading}>
            <h2>Authority guardrails</h2>
            <span>Server enforced</span>
          </div>
          <p>
            Roles stay fixed to the approved staff model. Special capabilities only augment
            delegated roles, and the protected Game Owner identity cannot be mutated here.
          </p>
        </section>
      </aside>
    </div>
  )}
