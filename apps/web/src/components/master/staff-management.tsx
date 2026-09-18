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

type MutationOperation =
  | 'grant-role'
  | 'revoke-role'
  | 'grant-capability'
  | 'revoke-capability'

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

export function StaffManagement({
  staff,
  roleOptions,
  capabilityOptions,
}: StaffManagementProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
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
                <div className={styles.controlRow} key={option.id}>
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
            These are explicit account grants. They never create another role and never include
            root Master Panel access or staff management.
          </p>
          <div className={styles.controlList}>
            {capabilityOptions.map((option) => {
              const active = capabilities.has(option.id)
              const operation = active ? 'revoke-capability' : 'grant-capability'
              const actionKey = [operation, member.userId, option.id].join(':')
              return (
                <div className={styles.controlRow} key={option.id}>
                  <div>
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </div>
                  <button
                    type="button"
                    disabled={!canMutate || busyKey !== null}
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
      <section className={styles.guardrail}>
        <h2>Authority change guardrail</h2>
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
          <span>I confirm this changes live staff authority for the selected account.</span>
        </label>
        <p>
          Every mutation is re-authorized server-side, versioned for prompt revocation, and written
          to the staff audit trail.
        </p>
      </section>

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

      <section className={styles.lookup}>
        <div>
          <h2>Add or inspect an account</h2>
          <p>
            Resolve one exact account email. The browser never receives a general player directory.
          </p>
        </div>
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
            {busyKey === 'resolve' ? 'Finding…' : 'Find account'}
          </button>
        </div>

        {resolved ? (
          <article className={styles.resolved}>
            <div>
              <span>Resolved account</span>
              <strong>{resolved.email}</strong>
            </div>
            {controlsFor(resolved)}
          </article>
        ) : null}
      </section>

      <section className={styles.staffList}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Current staff</h2>
            <p>Game Owner plus every account with an enabled delegated role or special grant.</p>
          </div>
          <span>{staff.length} accounts</span>
        </div>

        {staff.map((member) => {
          const owner = member.roles.includes('game-owner')
          return (
            <article className={styles.staffCard} key={member.userId}>
              <header>
                <div>
                  <span>{owner ? 'WORLDWRIGHT · GAME OWNER' : 'Staff account'}</span>
                  <strong>{member.email ?? 'Account email unavailable'}</strong>
                </div>
                <span>Access v{member.accessVersion}</span>
              </header>
              <div className={styles.chips} aria-label="Current authority">
                {member.roles.map((role) => (
                  <span key={role}>{role.replaceAll('-', ' ')}</span>
                ))}
                {member.specialCapabilities.map((capability) => (
                  <span key={capability}>{capability}</span>
                ))}
              </div>
              {controlsFor(member)}
            </article>
          )
        })}
      </section>
    </div>
  )
}
