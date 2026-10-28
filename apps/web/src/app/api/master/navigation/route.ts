import { handleMasterNavigationRequest } from '@/server/master/master-navigation-handler'
export async function POST(request: Request) {
  return handleMasterNavigationRequest(request)
}
