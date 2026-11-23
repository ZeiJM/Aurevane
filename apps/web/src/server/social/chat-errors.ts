import { AurevaneError } from '@aurevane/game-core/errors'

const messages: readonly [string, AurevaneError['code'], string][] = [
  [
    'CHAT_RATE_LIMITED',
    'INVALID_REQUEST',
    'You are sending messages too quickly. Wait a few seconds.',
  ],
  ['CHAT_REACTION_RATE_LIMITED', 'INVALID_REQUEST', 'Too many reactions. Wait a moment.'],
  ['CHAT_DUPLICATE', 'INVALID_REQUEST', 'You just sent that message.'],
  ['CHAT_FRIEND_LIMIT', 'INVALID_REQUEST', 'Your friend list is full (10). Remove someone first.'],
  ['CHAT_OTHER_FRIEND_LIMIT', 'INVALID_REQUEST', 'That player’s friend list is full.'],
  ['CHAT_REQUEST_LIMIT', 'INVALID_REQUEST', 'You have too many pending friend requests.'],
  ['CHAT_ALREADY_FRIENDS', 'INVALID_REQUEST', 'You are already friends.'],
  ['CHAT_REQUEST_EXISTS', 'INVALID_REQUEST', 'A friend request is already waiting.'],
  ['CHAT_GROUP_FULL', 'INVALID_REQUEST', 'Private groups hold at most 10 people.'],
  ['CHAT_GROUP_LIMIT', 'INVALID_REQUEST', 'You are already in 10 private groups.'],
  ['CHAT_INVITE_NOT_ALLOWED', 'FORBIDDEN', 'That player does not accept group invites from you.'],
  ['CHAT_NOT_FOUND', 'INVALID_REQUEST', 'No matching player or request was found.'],
  ['CHAT_INVALID', 'INVALID_REQUEST', 'That chat request was not valid.'],
  ['CHAT_FORBIDDEN', 'FORBIDDEN', 'You cannot do that in this chat.'],
]

/** Maps RPC failures to calm, player-safe messages. Unknown failures stay generic. */
export function mapChatRpcError(error: { code?: string; message?: string }): never {
  const text = error.message ?? ''
  for (const [marker, code, message] of messages) {
    if (text.includes(marker)) throw new AurevaneError(code, message)
  }
  if (error.code === '42501')
    throw new AurevaneError('FORBIDDEN', 'You cannot do that in this chat.')
  throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Chat is unavailable right now.')
}
