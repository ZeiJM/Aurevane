import { AurevaneError } from '@aurevane/game-core/errors'

import { toServerErrorResponse } from '@/server/http/error-response'
import { chatContext, chatJson, readJsonObject } from '@/server/social/chat-route'
import { reactToMessage } from '@/server/social/chat-service'

export async function POST(request: Request) {
  try {
    const { userId, characterId } = await chatContext()
    const input = await readJsonObject(request)
    const id = input.messageId
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0
        || typeof input.emoji !== 'string') {
      throw new AurevaneError('INVALID_REQUEST', 'Choose a message and reaction.')
    }
    const reactions = await reactToMessage(userId, characterId, id, input.emoji)
    return chatJson({ reactions })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
