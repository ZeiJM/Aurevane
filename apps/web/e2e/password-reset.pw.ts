import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { createVerifiedAccountAndSignIn, signOutFromAccountMenu } from './pv1f-test-helpers'

const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const adminKey = process.env.SUPABASE_SECRET_KEY
const mailUrl = process.env.INBUCKET_URL ?? 'http://127.0.0.1:54324'
const oldPassword = 'Recovery-old-password-2026!'
const newPassword = 'Recovery-new-password-2026!'

function requireLocalServices() {
  for (const url of [authUrl, mailUrl]) {
    if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
      throw new Error(
        'Password recovery browser tests may use only disposable local Supabase and mail capture.',
      )
    }
  }
}

async function capturedRecoveryLink(request: APIRequestContext, email: string): Promise<string> {
  let link = ''
  await expect
    .poll(
      async () => {
        // Support Inbucket and the newer CLI Mailpit capture service.
        const inbox = await request.get(
          `${mailUrl}/api/v1/mailbox/${encodeURIComponent(email.split('@')[0]!)}`,
        )
        let messageText = ''
        if (inbox.ok()) {
          const rows = (await inbox.json()) as { id: string; subject: string }[]
          const message = rows.filter((row) => /reset|recover/i.test(row.subject)).at(-1)
          if (message) {
            const detail = await request.get(
              `${mailUrl}/api/v1/mailbox/${encodeURIComponent(email.split('@')[0]!)}/${message.id}`,
            )
            const body = (await detail.json()) as { body: { text?: string; html?: string } }
            messageText = `${body.body.text ?? ''} ${body.body.html ?? ''}`
          }
        } else {
          const inbox = await request.get(
            `${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
          )
          if (!inbox.ok()) return false
          const body = (await inbox.json()) as { messages?: { ID: string; Subject: string }[] }
          const message = body.messages?.find((row) => /reset|recover/i.test(row.Subject))
          if (message) {
            const detail = await request.get(`${mailUrl}/api/v1/message/${message.ID}`)
            const body = (await detail.json()) as { Text?: string; HTML?: string }
            messageText = `${body.Text ?? ''} ${body.HTML ?? ''}`
          }
        }
        link =
          messageText
            .replaceAll('&amp;', '&')
            .match(/https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/)?.[0] ?? ''
        return Boolean(link)
      },
      { timeout: 15_000, message: 'local captured password recovery email' },
    )
    .toBe(true)
  const url = new URL(link)
  expect(url.origin).toBe(new URL(authUrl!).origin)
  expect(url.searchParams.get('type')).toBe('recovery')
  return link
}

async function requestReset(page: Page, email: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByTestId('account-message')).toContainText(
    'If an account exists for that email',
  )
}

test.beforeEach(() => {
  test.skip(!authUrl || !adminKey, 'Disposable local Supabase credentials are required.')
  requireLocalServices()
})

test('email recovery updates the password, signs out, and requires a fresh gameplay claim', async ({
  page,
  request,
}, info) => {
  test.setTimeout(60_000)
  const email = `recover-${info.project.name}-${Date.now()}@example.test`
  await createVerifiedAccountAndSignIn({ page, email, password: oldPassword })
  await signOutFromAccountMenu(page)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Forgot password?' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await requestReset(page, email)
  const link = await capturedRecoveryLink(request, email)
  let claims = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/account/game-session/claim') claims += 1
  })
  await page.goto(link)
  await expect(page).toHaveURL(/\/auth\/reset-password$/)
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible()
  expect(claims).toBe(0)
  await page.getByLabel('New password', { exact: true }).fill(newPassword)
  await page.getByLabel('Confirm new password').fill('A-different-password!')
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page.getByRole('status')).toContainText('Your passwords do not match')
  await page.getByLabel('Confirm new password').fill(newPassword)
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page).toHaveURL(/\/\?account=password-reset$/)
  await expect(page.getByTestId('account-message')).toHaveText(
    'Password updated. Sign in with your new password.',
  )
  expect(claims).toBe(0)
  expect(
    (await page.context().cookies()).some((cookie) => cookie.name === 'aurevane-password-recovery'),
  ).toBe(false)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(oldPassword)
  await page.getByRole('button', { name: 'Enter AUREVANE' }).click()
  await expect(page.getByTestId('account-message')).toContainText('We could not sign you in')
  await page.getByLabel('Password', { exact: true }).fill(newPassword)
  await page.getByRole('button', { name: 'Enter AUREVANE' }).click()
  await expect(page).toHaveURL(/\/game$/)
  expect(claims).toBe(1)
  await page.goto('/auth/reset-password')
  await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0)
  await expect(
    page.getByText('This account link has expired or could not be verified.', { exact: false }),
  ).toBeVisible()
})

test('invalid callbacks and expired captured emails offer a safe recovery retry', async ({
  page,
  request,
}, info) => {
  test.setTimeout(60_000)
  await page.goto('/auth/callback?next=https://evil.test&code=not-a-valid-code')
  await expect(page).toHaveURL(/\/auth\/reset-password\?error=invalid-link$/)
  await expect(page.getByRole('link', { name: 'Request a new reset link' })).toBeVisible()
  await page.getByRole('link', { name: 'Request a new reset link' }).click()
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible()
  const email = `expired-${info.project.name}-${Date.now()}@example.test`
  const admin = createClient(authUrl!, adminKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: oldPassword,
    email_confirm: true,
  })
  if (error || !data.user) throw error ?? new Error('Local test user missing.')
  await requestReset(page, email)
  const link = await capturedRecoveryLink(request, email)
  // Expire only this disposable local user's real recovery token, without waiting for the TTL.
  execFileSync('docker', [
    'exec',
    '-i',
    'supabase_db_aurevane',
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `update auth.users set recovery_sent_at = now() - interval '2 days' where id = '${data.user.id}'::uuid;`,
  ])
  await page.goto(link)
  await expect(page).toHaveURL(/\/auth\/reset-password\?error=invalid-link/)
  await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Request a new reset link' })).toBeVisible()
})
