/** Pure helpers: split a chat line into text, @mention pills and safe link embeds. */

export type ChatSegment =
  { type: 'text'; text: string } | { type: 'mention'; text: string; self: boolean }

export type ChatEmbed =
  { kind: 'image'; url: string; host: string } | { kind: 'youtube'; videoId: string; url: string }

const URL_PATTERN = /https:\/\/[^\s<>"']+/gi
const IMAGE_EXTENSION = /\.(gif|png|jpe?g|webp)$/i

/** Only these hosts may be loaded by other players' messages. Everything else stays plain text. */
const IMAGE_HOSTS: readonly { test: (host: string) => boolean; anyPath: boolean }[] = [
  { test: (host) => host === 'media.tenor.com' || host === 'c.tenor.com', anyPath: true },
  { test: (host) => /^media\d*\.giphy\.com$/.test(host) || host === 'i.giphy.com', anyPath: true },
  { test: (host) => host === 'i.imgur.com', anyPath: false },
]

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0] ?? null
  else if (host === 'youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else if (url.pathname.startsWith('/shorts/')) id = url.pathname.split('/')[2] ?? null
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

function embedFor(raw: string): ChatEmbed | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  const video = youtubeId(url)
  if (video) return { kind: 'youtube', videoId: video, url: raw }
  const host = url.hostname.toLowerCase()
  const rule = IMAGE_HOSTS.find((candidate) => candidate.test(host))
  if (rule && (rule.anyPath || IMAGE_EXTENSION.test(url.pathname))) {
    return { kind: 'image', url: raw, host }
  }
  return null
}

/** Embeds found in a message (at most three), and the text with those links removed. */
export function extractEmbeds(body: string, enabled = true): { text: string; embeds: ChatEmbed[] } {
  const embeds: ChatEmbed[] = []
  const text = body
    .replace(URL_PATTERN, (match) => {
      const trimmed = match.replace(/[.,;:!?)\]]+$/, '')
      const tail = match.slice(trimmed.length)
      const embed = enabled && embeds.length < 3 ? embedFor(trimmed) : null
      if (!embed) return match
      embeds.push(embed)
      return tail
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  return { text, embeds }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Highlights @Name for players we know about; the longest names win so "Ann Lee" beats "Ann". */
export function segmentMentions(
  text: string,
  knownNames: readonly string[],
  selfName: string,
): ChatSegment[] {
  const names = [...new Set(knownNames.filter(Boolean))].sort((a, b) => b.length - a.length)
  if (names.length === 0 || !text.includes('@')) return text ? [{ type: 'text', text }] : []
  const pattern = new RegExp(`@(${names.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}_])`, 'giu')
  const segments: ChatSegment[] = []
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) segments.push({ type: 'text', text: text.slice(last, index) })
    segments.push({
      type: 'mention',
      text: match[0],
      self: match[1]!.toLowerCase() === selfName.toLowerCase(),
    })
    last = index + match[0].length
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last) })
  return segments
}

export function mentionsName(body: string, selfName: string): boolean {
  return new RegExp(`@${escapeRegExp(selfName)}(?![\\p{L}\\p{N}_])`, 'iu').test(body)
}

/** The "@partial" being typed at the end of the composer, if any. */
export function activeMentionQuery(
  value: string,
  caret: number,
): { start: number; query: string } | null {
  const before = value.slice(0, caret)
  const match = /(^|\s)@([\p{L}\p{N}'’ -]{0,40})$/u.exec(before)
  if (!match) return null
  return { start: before.length - match[2]!.length - 1, query: match[2]! }
}

export function applyMention(
  value: string,
  caret: number,
  start: number,
  name: string,
): { value: string; caret: number } {
  const next = `${value.slice(0, start)}@${name} ${value.slice(caret)}`
  return { value: next, caret: start + name.length + 2 }
}

export const EMOJI_CHOICES: readonly string[] = [
  '😀',
  '😂',
  '🥹',
  '😍',
  '😎',
  '🤔',
  '😭',
  '🥳',
  '🤝',
  '👍',
  '👏',
  '🙏',
  '💪',
  '🔥',
  '✨',
  '⭐',
  '🎉',
  '❤️',
  '💜',
  '💛',
  '⚔️',
  '🛡️',
  '🏹',
  '🗝️',
  '🍻',
  '🍖',
  '🌙',
  '🐉',
  '🌲',
  '🏰',
  '💎',
  '☠️',
]
