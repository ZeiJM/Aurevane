import { AurevaneError } from '@aurevane/game-core/errors'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** What the browser asks for. Canonical database keys are never trusted from the client. */
export type ChatChannelRequest =
  | { kind: 'world' }
  | { kind: 'village' }
  | { kind: 'whisper'; characterId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'lobby'; lobbyId: string }

export interface ResolvedChatChannel {
  key: string
  kind: ChatChannelRequest['kind']
}

export function parseChatChannel(value: unknown): ChatChannelRequest {
  const invalid = () => new AurevaneError('INVALID_REQUEST', 'That chat channel is not valid.')
  if (typeof value !== 'string' || value.length > 80) throw invalid()
  if (value === 'world') return { kind: 'world' }
  if (value === 'village') return { kind: 'village' }
  const [kind, id, ...rest] = value.split(':')
  if (rest.length > 0 || !id || !UUID.test(id)) throw invalid()
  if (kind === 'whisper') return { kind: 'whisper', characterId: id }
  if (kind === 'group') return { kind: 'group', groupId: id }
  if (kind === 'lobby') return { kind: 'lobby', lobbyId: id }
  throw invalid()
}

export function resolveChatChannel(
  characterId: string,
  request: ChatChannelRequest,
  villageKey: string | null,
): ResolvedChatChannel {
  switch (request.kind) {
    case 'world':
      return { key: 'world', kind: 'world' }
    case 'village':
      if (!villageKey)
        throw new AurevaneError('FORBIDDEN', 'Village chat opens when you stand in a village.')
      return { key: villageKey, kind: 'village' }
    case 'whisper': {
      if (request.characterId === characterId) {
        throw new AurevaneError('INVALID_REQUEST', 'You cannot whisper yourself.')
      }
      const [low, high] = [characterId, request.characterId].sort()
      return { key: `dm:${low}:${high}`, kind: 'whisper' }
    }
    case 'group':
      return { key: `group:${request.groupId}`, kind: 'group' }
    case 'lobby':
      return { key: `lobby:${request.lobbyId}`, kind: 'lobby' }
  }
}
