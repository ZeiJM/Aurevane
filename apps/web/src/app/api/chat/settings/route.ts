import { toServerErrorResponse } from '@/server/http/error-response'
import { chatContext, chatJson, readJsonObject } from '@/server/social/chat-route'
import { getSettings, setSettings } from '@/server/social/chat-service'

export async function GET() {
  try {
    const { userId, characterId } = await chatContext()
    return chatJson({ settings: await getSettings(userId, characterId) })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId, characterId } = await chatContext()
    const input = await readJsonObject(request)
    // Only known keys reach the database; unknown fields are dropped.
    const patch: Record<string, unknown> = {}
    for (const key of ['whisperPrivacy', 'groupInvitePrivacy', 'defaultChannel']) {
      if (typeof input[key] === 'string') patch[key] = input[key]
    }
    for (const key of ['showEmbeds', 'appearOffline']) {
      if (typeof input[key] === 'boolean') patch[key] = input[key]
    }
    return chatJson({ settings: await setSettings(userId, characterId, patch) })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
