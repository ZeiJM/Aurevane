import { toServerErrorResponse } from '@/server/http/error-response'
import { parseChatChannel } from '@/server/social/chat-channel'
import { chatContext, chatJson } from '@/server/social/chat-route'
import { mentionCandidates, resolveChannel } from '@/server/social/chat-service'

export async function GET(request: Request) {
  try {
    const { userId, characterId } = await chatContext()
    const params = new URL(request.url).searchParams
    const channel = await resolveChannel(
      userId,
      characterId,
      parseChatChannel(params.get('channel')),
    )
    const candidates = await mentionCandidates(
      userId,
      characterId,
      channel.key,
      params.get('q') ?? '',
    )
    return chatJson({ candidates })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
