import { handleStaffAccessRequest } from '@/server/master/staff-access-handler'

export async function POST(request: Request) {
  return handleStaffAccessRequest(request)
}
