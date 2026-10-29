import { readSelfAccountBanStatus } from '@/server/account/account-ban-status'
import { toServerErrorResponse } from '@/server/http/error-response'
export async function GET() {
  try {
    return Response.json(await readSelfAccountBanStatus(), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
