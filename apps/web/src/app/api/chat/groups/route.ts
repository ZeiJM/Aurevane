import { AurevaneError } from '@aurevane/game-core/errors'

import { toServerErrorResponse } from '@/server/http/error-response'
import { chatContext, chatJson, readJsonObject, requireUuid } from '@/server/social/chat-route'
import {
  createGroup,
  inviteToGroup,
  leaveGroup,
  renameGroup,
  respondToGroup,
} from '@/server/social/chat-service'

function requireName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > 60) {
    throw new AurevaneError('INVALID_REQUEST', 'Give the group a name (up to 24 characters).')
  }
  return value
}

export async function POST(request: Request) {
  try {
    const { userId, characterId } = await chatContext()
    const input = await readJsonObject(request)
    switch (input.action) {
      case 'create': {
        const ids = Array.isArray(input.inviteIds) ? input.inviteIds.map(requireUuid) : []
        if (ids.length > 9)
          throw new AurevaneError('INVALID_REQUEST', 'Private groups hold at most 10 people.')
        return chatJson(
          { group: await createGroup(userId, characterId, requireName(input.name), ids) },
          201,
        )
      }
      case 'invite':
        await inviteToGroup(
          userId,
          characterId,
          requireUuid(input.groupId),
          requireUuid(input.characterId),
        )
        return chatJson({ ok: true })
      case 'accept':
        await respondToGroup(userId, characterId, requireUuid(input.groupId), true)
        return chatJson({ ok: true })
      case 'decline':
        await respondToGroup(userId, characterId, requireUuid(input.groupId), false)
        return chatJson({ ok: true })
      case 'leave':
        await leaveGroup(
          userId,
          characterId,
          requireUuid(input.groupId),
          input.characterId === undefined ? null : requireUuid(input.characterId),
        )
        return chatJson({ ok: true })
      case 'rename':
        await renameGroup(userId, characterId, requireUuid(input.groupId), requireName(input.name))
        return chatJson({ ok: true })
      default:
        throw new AurevaneError('INVALID_REQUEST', 'That group action is not valid.')
    }
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
