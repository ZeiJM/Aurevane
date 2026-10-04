import type { BattleIntent } from '@aurevane/validation/combat/battle-session'

interface PreviewRequest {
  battleSessionId: string
  battleVersion: number
  intent: BattleIntent
  signal: AbortSignal
  fetchPreview?: typeof fetch
}

interface PendingRequest {
  controller: AbortController
  consumers: Set<object>
  response: Promise<Response>
}

// Only in-flight requests are shared. No completed forecast survives a request's lifetime.
const transports = new WeakMap<typeof fetch, Map<string, PendingRequest>>()

export function requestBattlePreview({
  battleSessionId,
  battleVersion,
  intent,
  signal,
  fetchPreview = fetch,
}: PreviewRequest): Promise<Response> {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  let requests = transports.get(fetchPreview)
  if (!requests) {
    requests = new Map()
    transports.set(fetchPreview, requests)
  }
  const key = JSON.stringify([battleSessionId, battleVersion, intent])
  let pending = requests.get(key)
  if (!pending) {
    const controller = new AbortController()
    const consumers = new Set<object>()
    const entry: PendingRequest = {
      controller,
      consumers,
      response: (async () => {
        return fetchPreview(`/api/battles/${battleSessionId}/preview`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedBattleVersion: battleVersion, intent }),
        })
      })(),
    }
    entry.response = entry.response.finally(() => {
      if (requests.get(key) === entry) requests.delete(key)
    })
    requests.set(key, entry)
    pending = entry
  }
  const entry = pending
  const consumer = {}
  entry.consumers.add(consumer)
  return new Promise<Response>((resolve, reject) => {
    const detach = () => {
      signal.removeEventListener('abort', abort)
      entry.consumers.delete(consumer)
    }
    const abort = () => {
      detach()
      if (entry.consumers.size === 0) {
        if (requests.get(key) === entry) requests.delete(key)
        entry.controller.abort()
      }
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    void entry.response.then(
      (response) => {
        if (signal.aborted) return
        detach()
        try {
          resolve(response.clone())
        } catch (error) {
          reject(error)
        }
      },
      (error: unknown) => {
        detach()
        reject(error)
      },
    )
  })
}
