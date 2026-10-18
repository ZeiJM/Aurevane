import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function identity(prefix: string) {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100000)}`
  const suffix = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return { email: `${prefix}.${seed}@example.com`, name: `${prefix} ${suffix}` }
}

test('chat reactions, ephemeral typing and private Game feed work on a phone', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Phone chat regression')
  test.slow()
  const hostId = identity('ChatHost')
  const guestId = identity('ChatGuest')
  const opts = {
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  }
  const hostContext = await browser.newContext(opts)
  const guestContext = await browser.newContext(opts)
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

  try {
    for (const [page, who] of [
      [host, hostId],
      [guest, guestId],
    ] as const) {
      await provisionAccountAndEnterCharacter({
        page,
        email: who.email,
        password: 'AurevaneTest!42',
        characterName: who.name,
      })
    }

    const selectedCharacterId = (await hostContext.cookies()).find(
      (cookie) => cookie.name === 'aurevane_selected_character',
    )?.value
    const request = await host.request.post('/api/chat/friends', {
      data: { action: 'request', name: guestId.name },
    })
    const requestStatus = request.status()
    const requestBody = await request.json().catch(() => null)
    const safeError =
      requestBody && typeof requestBody === 'object' && 'error' in requestBody
        ? (requestBody as { error?: { code?: unknown; message?: unknown } }).error
        : null
    expect(
      request.ok(),
      [
        'Friend request failed.',
        `status=${requestStatus}`,
        `selectedCharacterId=${selectedCharacterId ?? 'missing'}`,
        `targetCharacterName=${guestId.name}`,
        `response=${JSON.stringify(
          safeError ? { code: safeError.code, message: safeError.message } : requestBody,
        )}`,
      ].join(' '),
    ).toBe(true)
    const sent = requestBody as { outgoing: { id: string }[] }
    const guestCharacter = sent.outgoing[0]?.id
    expect(guestCharacter).toMatch(/^[0-9a-f-]{36}$/)
    const guestState = await guest.request.get('/api/chat/friends')
    expect(guestState.ok()).toBe(true)
    const incoming = (await guestState.json()) as { incoming: { id: string }[] }
    const hostCharacter = incoming.incoming[0]?.id
    expect(hostCharacter).toMatch(/^[0-9a-f-]{36}$/)
    const accept = await guest.request.post('/api/chat/friends', {
      data: { action: 'accept', characterId: hostCharacter },
    })
    expect(accept.ok()).toBe(true)

    const word = `Reaction smoke ${Date.now()}`
    const posted = await host.request.post('/api/chat/messages', {
      data: { channel: 'world', body: word },
    })
    expect(posted.ok()).toBe(true)
    const sentMessage = (await posted.json()) as { message: { id: number } }

    await host.goto('/game/world')
    await host.getByRole('button', { name: 'Details', exact: true }).click()
    await host.getByRole('tab', { name: /Chat/ }).click()
    const panel = host.locator('[data-chat-panel]')
    const row = panel.locator(`[data-chat-message-id="${sentMessage.message.id}"]`)
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /React to message from/ }).click()
    await row.getByRole('button', { name: 'React 🔥' }).click()
    await expect(row.getByRole('button', { name: '🔥, 1 reactions' })).toBeVisible()

    const dmChannel = `whisper:${guestCharacter}`
    const ping = await host.request.post('/api/chat/typing', {
      data: { channel: dmChannel, isTyping: true },
    })
    expect(ping.ok()).toBe(true)
    const typing = await guest.request.get(
      `/api/chat/typing?channel=${encodeURIComponent(`whisper:${hostCharacter}`)}`,
    )
    expect(typing.ok()).toBe(true)
    const seenTyping = (await typing.json()) as { typers: { name: string }[] }
    expect(seenTyping.typers.some((who) => who.name === hostId.name)).toBe(true)

    const hidden = await host.request.patch('/api/chat/settings', {
      data: { appearOffline: true },
    })
    expect(hidden.ok()).toBe(true)
    const invisible = await guest.request.get(
      `/api/chat/typing?channel=${encodeURIComponent(`whisper:${hostCharacter}`)}`,
    )
    const notSeen = (await invisible.json()) as { typers: { name: string }[] }
    expect(notSeen.typers).toHaveLength(0)

    await panel.locator('button[aria-haspopup="listbox"]').click()
    await panel.getByRole('option', { name: /Game feed only/ }).click()
    await expect(panel.getByRole('log', { name: /Game feed/ })).toBeVisible()
    const personalFeed = await host.request.get('/api/chat/messages?channel=feed&after=0')
    expect(personalFeed.ok()).toBe(true)
    const forbiddenWrite = await host.request.post('/api/chat/messages', {
      data: { channel: 'feed', body: 'forged event' },
    })
    expect(forbiddenWrite.status()).toBe(403)
  } finally {
    await hostContext.close()
    await guestContext.close()
  }
})
