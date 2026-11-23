import { toServerErrorResponse } from '@/server/http/error-response'
import { parseChatChannel } from '@/server/social/chat-channel'
import { chatContext, chatJson, parseAfterId, readJsonObject } from '@/server/social/chat-route'
import { markRead, resolveChannel } from '@/server/social/chat-service'

export async function POST(request: Request) {
  try {
    const { userId, characterId } = await chatContext()
    const input = await readJsonObject(request)
    const channel = await resolveChannel(userId, characterId, parseChatChannel(input.channel))
    await markRead(userId, characterId, channel.key, parseAfterId(String(input.lastId ?? '')))
    return chatJson({ ok: true })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
