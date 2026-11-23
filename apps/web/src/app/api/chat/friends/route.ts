import { AurevaneError } from '@aurevane/game-core/errors'

import { toServerErrorResponse } from '@/server/http/error-response'
import { chatContext, chatJson, readJsonObject, requireUuid } from '@/server/social/chat-route'
import {
  getFriends,
  removeFriend,
  requestFriend,
  respondFriend,
  setBlocked,
} from '@/server/social/chat-service'

export async function GET() {
  try {
    const { userId, characterId } = await chatContext()
    return chatJson(await getFriends(userId, characterId))
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { userId, characterId } = await chatContext()
    const input = await readJsonObject(request)
    switch (input.action) {
      case 'request': {
        if (typeof input.name !== 'string' || input.name.length < 1 || input.name.length > 80) {
          throw new AurevaneError('INVALID_REQUEST', 'Enter a character name.')
        }
        return chatJson(await requestFriend(userId, characterId, input.name))
      }
      case 'accept':
        return chatJson(
          await respondFriend(userId, characterId, requireUuid(input.characterId), true),
        )
      case 'decline':
        return chatJson(
          await respondFriend(userId, characterId, requireUuid(input.characterId), false),
        )
      case 'remove':
        return chatJson(await removeFriend(userId, characterId, requireUuid(input.characterId)))
      case 'block':
        return chatJson(await setBlocked(userId, characterId, requireUuid(input.characterId), true))
      case 'unblock':
        return chatJson(
          await setBlocked(userId, characterId, requireUuid(input.characterId), false),
        )
      default:
        throw new AurevaneError('INVALID_REQUEST', 'That friends action is not valid.')
    }
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
