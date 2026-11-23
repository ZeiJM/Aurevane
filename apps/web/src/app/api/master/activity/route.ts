import { handleMasterActivityRequest } from '@/server/master/activity-log-handler'

export async function GET(request: Request) {
  return handleMasterActivityRequest(request)
}
