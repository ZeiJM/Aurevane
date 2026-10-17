export interface ChatMessage {
  id: number
  channelKey: string
  kind: 'chat' | 'system' | 'story'
  body: string
  createdAt: string
  senderCharacterId: string | null
  senderName: string | null
  senderLevel: number | null
  replyTo: { id: number; senderName: string | null; body: string } | null
}

export interface InboxWhisper {
  characterId: string
  name: string
  level: number
  channelKey: string
  online: boolean
  lastBody: string
  unread: number
}
export interface InboxGroup {
  id: string
  name: string
  channelKey: string
  isOwner: boolean
  members: number
  unread: number
}
export interface InboxInvite {
  groupId: string
  name: string
  invitedBy: string | null
  members: number
}
export interface ChatInbox {
  whispers: InboxWhisper[]
  groups: InboxGroup[]
  groupInvites: InboxInvite[]
  unreadTotal: number
  village: { available: boolean }
}

export interface FriendEntry {
  id: string
  name: string
  level: number
  online?: boolean
}
export interface FriendsState {
  friends: FriendEntry[]
  incoming: FriendEntry[]
  outgoing: FriendEntry[]
  blocked: { id: string; name: string }[]
  slotsUsed: number
  slotsMax: number
}

export interface ChatSettings {
  whisperPrivacy: 'everyone' | 'friends' | 'nobody'
  groupInvitePrivacy: 'everyone' | 'friends' | 'nobody'
  defaultChannel: 'world' | 'village' | 'feed'
  showEmbeds: boolean
  appearOffline: boolean
}

export interface MentionCandidate {
  id: string
  name: string
  level: number
  friend: boolean
  online: boolean
}

/** Browser channel ids; the server turns them into canonical keys. */
export type ChannelId =
  'world' | 'village' | 'feed' | `whisper:${string}` | `group:${string}` | `lobby:${string}`

export class ChatRequestError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string }
  } & Record<string, unknown>
  if (!response.ok)
    throw new ChatRequestError(body.error?.message ?? 'Chat is unavailable right now.')
  return body as T
}

const post = (path: string, payload: unknown) =>
  call<Record<string, unknown>>(path, { method: 'POST', body: JSON.stringify(payload) })

export const chatApi = {
  messages: (channel: string, after: number) =>
    call<{ messages: ChatMessage[] }>(
      `/api/chat/messages?channel=${encodeURIComponent(channel)}&after=${after}`,
    ),
  send: (channel: string, body: string, replyToId: number | null) =>
    post('/api/chat/messages', { channel, body, replyToId }) as Promise<{ message: ChatMessage }>,
  read: (channel: string, lastId: number) => post('/api/chat/read', { channel, lastId }),
  inbox: () => call<ChatInbox>('/api/chat/inbox'),
  mentions: (channel: string, q: string) =>
    call<{ candidates: MentionCandidate[] }>(
      `/api/chat/mentions?channel=${encodeURIComponent(channel)}&q=${encodeURIComponent(q)}`,
    ),
  settings: () => call<{ settings: ChatSettings }>('/api/chat/settings'),
  saveSettings: (patch: Partial<ChatSettings>) =>
    call<{ settings: ChatSettings }>('/api/chat/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  friends: () => call<FriendsState>('/api/chat/friends'),
  friendAction: (payload: { action: string; name?: string; characterId?: string }) =>
    post('/api/chat/friends', payload) as unknown as Promise<FriendsState>,
  groupAction: (payload: Record<string, unknown>) => post('/api/chat/groups', payload),
}
