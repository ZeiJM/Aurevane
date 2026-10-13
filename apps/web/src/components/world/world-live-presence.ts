import type { WorldView } from '@/world/types'
import type { WorldLivePlayers } from '@/world/live-presence'

const sceneKey = (view: WorldView) =>
  [...new Set(view.sectors.map((sector) => sector.id))].sort().join('\n')
const receiptKey = (view: WorldView) => `${view.characterId}:${sceneKey(view)}`

/** Private invalidations and peer reads run independently of travel commands. */
export class WorldLivePresence {
  private context = ''
  private sectors: WorldView['sectors'] | null = null
  private atlas: WorldView['atlas'] = undefined
  private channels = new Map<string, () => void>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private renewal: ReturnType<typeof setTimeout> | null = null
  private request: AbortController | null = null
  private dirty = false
  private disposed = false
  private lastServerNow = -Infinity

  constructor(
    private transport: {
      getView: () => WorldView
      subscribe: (topic: string, changed: () => void) => () => void
      read: (view: WorldView, signal: AbortSignal) => Promise<WorldLivePlayers>
      accept: (view: WorldView, receipt: WorldLivePlayers) => void
    },
  ) {}

  update(view: WorldView, active = true) {
    if (this.disposed) return
    const ids = [...new Set(view.sectors.map((sector) => sector.id))]
    const enabled = active && view.livePresence === true && ids.length > 0 && ids.length <= 25
    const nextContext = enabled ? receiptKey(view) : ''
    const topics = new Set(enabled ? ids.map((id) => `world-scene:${id}`) : [])
    const contextChanged =
      nextContext !== this.context ||
      (enabled && (view.sectors !== this.sectors || view.atlas !== this.atlas))
    const retryRead =
      enabled &&
      contextChanged &&
      Boolean(this.request || this.dirty) &&
      topics.size === this.channels.size &&
      [...topics].every((topic) => this.channels.has(topic))
    if (contextChanged) {
      this.cancelRead()
      this.context = nextContext
      this.sectors = enabled ? view.sectors : null
      this.atlas = enabled ? view.atlas : undefined
      this.lastServerNow = -Infinity
    }
    for (const [topic, remove] of this.channels)
      if (!topics.has(topic)) {
        remove()
        this.channels.delete(topic)
      }
    for (const topic of topics)
      if (!this.channels.has(topic))
        this.channels.set(
          topic,
          this.transport.subscribe(topic, () => this.invalidate()),
        )
    if (!enabled && this.renewal) {
      clearTimeout(this.renewal)
      this.renewal = null
    } else if (enabled && !this.renewal) this.renew()
    // Geometry changes supersede an old authorized read even when topic IDs remain.
    // Preserve its pending invalidation for the newly authorized scene.
    if (retryRead) this.invalidate()
  }

  private renew() {
    this.renewal = setTimeout(() => {
      this.renewal = null
      if (!this.context || this.disposed) return
      this.invalidate(true)
      this.renew()
    }, 35_000)
  }

  private invalidate(immediate = false) {
    if (!this.context || this.disposed) return
    this.dirty = true
    if (this.timer || this.request) return
    if (immediate) {
      void this.read()
      return
    }
    this.timer = setTimeout(() => {
      this.timer = null
      void this.read()
    }, 100)
  }

  private async read() {
    if (this.disposed || !this.context || this.request || !this.dirty) return
    const view = this.transport.getView()
    const context = receiptKey(view)
    if (context !== this.context || view.sectors !== this.sectors || view.atlas !== this.atlas)
      return
    const request = new AbortController()
    this.request = request
    this.dirty = false
    try {
      const receipt = await this.transport.read(view, request.signal)
      const current = this.transport.getView()
      if (
        !request.signal.aborted &&
        this.context === context &&
        receiptKey(current) === context &&
        current.sectors === view.sectors &&
        current.atlas === view.atlas &&
        current.version >= view.version &&
        receipt.characterId === view.characterId &&
        receipt.version === view.version &&
        receipt.registered &&
        [...receipt.sceneSectorIds].sort().join('\n') === sceneKey(view) &&
        Number.isFinite(receipt.serverNow) &&
        receipt.serverNow >= this.lastServerNow
      ) {
        this.lastServerNow = receipt.serverNow
        this.transport.accept(view, receipt)
      }
    } catch {
      // The existing owned polling channel remains available during disconnects.
    } finally {
      if (this.request === request) {
        this.request = null
        if (this.dirty) this.invalidate()
      }
    }
  }

  private cancelRead() {
    this.request?.abort()
    this.request = null
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.dirty = false
  }

  dispose() {
    this.disposed = true
    this.context = ''
    this.cancelRead()
    if (this.renewal) clearTimeout(this.renewal)
    this.renewal = null
    for (const remove of this.channels.values()) remove()
    this.channels.clear()
  }
}
