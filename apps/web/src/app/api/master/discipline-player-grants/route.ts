import { handleDisciplinePlayerGrants } from '@/server/master/discipline-player-grants'
export async function POST(request: Request) {
  return handleDisciplinePlayerGrants(request)
}
