import { handleEventAuthoringRequest } from '@/server/master/event-authoring-handler'

export async function POST(request: Request) {
  return handleEventAuthoringRequest(request)
}
