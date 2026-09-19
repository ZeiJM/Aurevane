import { handleEventOperationsRequest } from '@/server/master/event-operations-handler'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return handleEventOperationsRequest(request)
}
