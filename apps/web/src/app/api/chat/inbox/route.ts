import { toServerErrorResponse } from '@/server/http/error-response'
import { chatContext, chatJson } from '@/server/social/chat-route'
import { currentVillageKey, getInbox } from '@/server/social/chat-service'

export async function GET() {
  try {
    const { userId, characterId } = await chatContext()
    const [inbox, village] = await Promise.all([
      getInbox(userId, characterId),
      currentVillageKey(userId, characterId),
    ])
    return chatJson({ ...inbox, village: village ? { available: true } : { available: false } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
