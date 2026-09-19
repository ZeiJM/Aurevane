import { handleCombatContentAuthoringRequest } from '@/server/master/combat-content-authoring-handler'

export async function POST(request: Request) {
  return handleCombatContentAuthoringRequest(request)
}
