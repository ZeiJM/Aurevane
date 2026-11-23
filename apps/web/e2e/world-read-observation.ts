import type { APIResponse } from '@playwright/test'
import type { WorldView } from '../src/world/types'

type WorldReadResponse = Pick<APIResponse, 'ok' | 'status' | 'json'>

function errorCode(body: unknown) {
  const error = body && typeof body === 'object' && 'error' in body ? body.error : null
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null
  return typeof code === 'string' && /^[A-Z_]{1,64}$/.test(code) ? code : 'UNKNOWN_RESPONSE'
}

async function bodyOf(response: WorldReadResponse): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error(`World read returned HTTP ${response.status()} with unreadable JSON.`)
  }
}

function readFailed(response: WorldReadResponse, body: unknown): never {
  throw new Error(`World read returned HTTP ${response.status()} (${errorCode(body)}).`)
}

/** A strict read keeps unexpected failures visible without logging response bodies. */
export async function readWorldSnapshot(response: WorldReadResponse): Promise<WorldView> {
  const body = await bodyOf(response)
  if (!response.ok()) readFailed(response, body)
  return body as WorldView
}

/** One observation only; the native assertion owns its existing polling deadline. */
export async function observeWorldRead(
  read: () => Promise<WorldReadResponse>,
  ready: (view: WorldView) => boolean,
): Promise<boolean> {
  const response = await read()
  if (response.status() === 409) {
    const body = await bodyOf(response)
    // A bounded owned/scene join can race another movement commit. No stale
    // body is a snapshot, especially for negative assertions such as crossing.
    if (errorCode(body) === 'STALE_VERSION') return false
    readFailed(response, body)
  }
  return ready(await readWorldSnapshot(response))
}
