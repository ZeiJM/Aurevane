import { handleUsageBalanceRequest } from '@/server/master/usage-balance-handler'
export async function GET(request: Request) {
  return handleUsageBalanceRequest(request)
}
