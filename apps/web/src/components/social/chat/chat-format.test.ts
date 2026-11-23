import { describe, expect, it } from 'vitest'

import {
  activeMentionQuery,
  applyMention,
  extractEmbeds,
  mentionsName,
  segmentMentions,
} from './chat-format'

describe('chat embeds', () => {
  it('turns allowlisted GIF and image links into embeds and hides the URL text', () => {
    const result = extractEmbeds('look https://media.tenor.com/abc/cat.gif lol')
    expect(result.embeds).toEqual([
      { kind: 'image', url: 'https://media.tenor.com/abc/cat.gif', host: 'media.tenor.com' },
    ])
    expect(result.text).toBe('look lol')
    expect(extractEmbeds('https://i.imgur.com/x1.png').text).toBe('')
  })

  it('recognises YouTube watch, share and shorts links', () => {
    for (const link of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      expect(extractEmbeds(link).embeds[0]).toMatchObject({
        kind: 'youtube',
        videoId: 'dQw4w9WgXcQ',
      })
    }
  })

  it('never embeds unknown hosts, http, credentials, ports or look-alikes', () => {
    for (const link of [
      'https://evil.example/cat.gif',
      'http://media.tenor.com/cat.gif',
      'https://media.tenor.com.evil.example/cat.gif',
      'https://user:pw@i.imgur.com/a.png',
      'https://i.imgur.com:8443/a.png',
      'https://i.imgur.com/not-an-image',
      'https://www.youtube.com/watch?v=short',
    ]) {
      const result = extractEmbeds(link)
      expect(result.embeds).toEqual([])
      expect(result.text).toBe(link)
    }
  })

  it('keeps links as text when embeds are switched off and caps embeds at three', () => {
    expect(extractEmbeds('https://i.imgur.com/a.png', false).embeds).toEqual([])
    const many = Array.from({ length: 5 }, (_, i) => `https://i.imgur.com/${i}.png`).join(' ')
    expect(extractEmbeds(many).embeds).toHaveLength(3)
  })

  it('keeps trailing punctuation outside the link', () => {
    const result = extractEmbeds('see https://i.imgur.com/a.png.')
    expect(result.embeds).toHaveLength(1)
    expect(result.text).toBe('see .')
  })
})

describe('mentions', () => {
  it('highlights known names and marks the viewer', () => {
    const parts = segmentMentions('hey @Veyra and @Ann Lee!', ['Veyra', 'Ann', 'Ann Lee'], 'Veyra')
    expect(parts.filter((p) => p.type === 'mention')).toEqual([
      { type: 'mention', text: '@Veyra', self: true },
      { type: 'mention', text: '@Ann Lee', self: false },
    ])
  })

  it('does not highlight unknown names or partial words', () => {
    expect(segmentMentions('@Veyrana is here', ['Veyra'], 'Kaelith')).toEqual([
      { type: 'text', text: '@Veyrana is here' },
    ])
    expect(mentionsName('ping @kaelith!', 'Kaelith')).toBe(true)
    expect(mentionsName('ping @Kaelithia', 'Kaelith')).toBe(false)
  })

  it('finds and completes the @name being typed', () => {
    const value = 'meet at gate @ve'
    const query = activeMentionQuery(value, value.length)
    expect(query).toEqual({ start: 13, query: 've' })
    expect(applyMention(value, value.length, 13, 'Veyra')).toEqual({
      value: 'meet at gate @Veyra ',
      caret: 20,
    })
    expect(activeMentionQuery('email me@home', 13)).toBeNull()
  })
})
