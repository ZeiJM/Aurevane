import { toServerErrorResponse } from '@/server/http/error-response'
import { parseChatChannel } from '@/server/social/chat-channel'
import { chatContext, chatJson, readJsonObject } from '@/server/social/chat-route'
import { getTypers, resolveChannel, updateTyping } from '@/server/social/chat-service'

export async function GET(request: Request) {
  try {
    const { userId, characterId } = await chatContext()
    const input = new URL(request.url).searchParams
    const channel = await resolveChannel(
      userId,
      characterId,
      parseChatChannel(input.get('channel')),
    )
    const typers = await getTypers(userId, characterId, channel.key)
    return chatJson({ typers })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { userId, characterId } = await chatContext()
    const input = await readJsonObject(request)
    const channel = await resolveChannel(userId, characterId, parseChatChannel(input.channel))
    await updateTyping(userId, characterId, channel.key, input.isTyping === true)
    return chatJson({ ok: true })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
