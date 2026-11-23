import { handleMasterModerationRequest } from '@/server/master/moderation-handler'
export async function POST(request: Request) {
  return handleMasterModerationRequest(request)
}
