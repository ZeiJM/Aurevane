import { handleMasterPlayersRequest } from '@/server/master/players-handler'
export async function POST(request: Request) {
  return handleMasterPlayersRequest(request)
}
