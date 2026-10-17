import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { ChatMessage } from './chat-api'
import { ChatLine } from './chat-message'

const base: ChatMessage = {
  id: 1,
  channelKey: 'world',
  kind: 'chat',
  body: 'hi @Mira https://media.tenor.com/x/y.gif',
  createdAt: new Date().toISOString(),
  senderCharacterId: 'a',
  senderName: 'Kael',
  senderLevel: 3,
  replyTo: null,
}

const render = (message: ChatMessage, showEmbeds = true) =>
  renderToStaticMarkup(
    createElement(ChatLine, {
      message,
      grouped: false,
      selfName: 'Mira',
      knownNames: ['Kael'],
      showEmbeds,
      onReply: () => undefined,
    }),
  )

describe('ChatLine', () => {
  it('hides embed URLs, shows the image and flags a mention of you', () => {
    const html = render(base)
    expect(html).toContain('<img')
    expect(html).not.toContain('>https://media.tenor.com')
    expect(html).toContain('data-mention="true"')
  })

  it('renders system lines without a sender', () => {
    const html = render({ ...base, kind: 'system', body: 'A storm gathers.', senderName: null })
    expect(html).toContain('A storm gathers.')
    expect(html).not.toContain('Reply')
  })
})
