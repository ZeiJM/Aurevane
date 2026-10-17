import { AurevaneError } from '@aurevane/game-core/errors'

import { toServerErrorResponse } from '@/server/http/error-response'
import { parseChatChannel } from '@/server/social/chat-channel'
import { chatContext, chatJson, parseAfterId, readJsonObject } from '@/server/social/chat-route'
import { listMessages, resolveChannel, sendMessage } from '@/server/social/chat-service'

export async function GET(request: Request) {
  try {
    const { userId, characterId } = await chatContext()
    const params = new URL(request.url).searchParams
    const channel = await resolveChannel(
      userId,
      characterId,
      parseChatChannel(params.get('channel')),
    )
    const messages = await listMessages(
      userId,
      characterId,
      channel.key,
      parseAfterId(params.get('after')),
    )
    return chatJson({ channel: channel.kind, messages })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { userId, characterId } = await chatContext()
    const input = await readJsonObject(request)
    if (typeof input.body !== 'string') {
      throw new AurevaneError('INVALID_REQUEST', 'Enter a message.')
    }
    const replyTo =
      typeof input.replyToId === 'number' &&
      Number.isSafeInteger(input.replyToId) &&
      input.replyToId > 0
        ? input.replyToId
        : null
    const channel = await resolveChannel(userId, characterId, parseChatChannel(input.channel))
    const message = await sendMessage(userId, characterId, channel.key, input.body, replyTo)
    return chatJson({ message }, 201)
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
