import { handleCombatContentAuthoringRequest } from '@/server/master/combat-content-authoring-handler'

export function POST(request: Request): Promise<Response> {
  return handleCombatContentAuthoringRequest(request)
}
