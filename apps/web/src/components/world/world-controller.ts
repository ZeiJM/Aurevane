import type { WorldIntent, WorldView } from '@/world/types'

export class WorldConflict extends Error {}
type Receipt = { applied: boolean; view?: WorldView }
type Job = {
  intent: WorldIntent
  sequence: number
  resolve: (receipt: Receipt) => void
  promise: Promise<Receipt>
}
const movement = (intent: WorldIntent) => ['walk', 'autopath', 'stop'].includes(intent.kind)

/** One authority channel. New movement replaces queued movement, never an action. */
export class WorldController {
  private queue: Job[] = []
  private running = false
  private disposed = false
  private sequence = 0
  private latestMovement = 0
  private currentJob: Job | null = null
  constructor(
    public view: WorldView,
    private transport: {
      command: (intent: WorldIntent, view: WorldView) => Promise<WorldView>
      refresh: () => Promise<WorldView>
      accept: (view: WorldView, reconcile: boolean) => void
      error: (message: string) => void
      busy: (intent: WorldIntent | null) => void
    },
  ) {}
  get pending() {
    return this.running || this.queue.length > 0
  }
  send(intent: WorldIntent): Promise<Receipt> {
    if (this.disposed || this.view.battleSessionId || (intent.kind === 'tick' && this.pending))
      return Promise.resolve({ applied: false })
    if (!movement(intent) && intent.kind !== 'tick') {
      const duplicate = [this.currentJob, ...this.queue].find(
        (job) => job && JSON.stringify(job.intent) === JSON.stringify(intent),
      )
      if (duplicate) return duplicate.promise
    }
    const sequence = ++this.sequence
    if (movement(intent)) {
      this.latestMovement = sequence
      this.queue = this.queue.filter((job) => {
        if (!movement(job.intent)) return true
        job.resolve({ applied: false })
        return false
      })
    }
    let resolve!: (receipt: Receipt) => void
    const promise = new Promise<Receipt>((accept) => {
      resolve = accept
    })
    this.queue.push({ intent, sequence, resolve, promise })
    if (intent.kind !== 'tick') {
      const action = [this.currentJob, ...this.queue].find(
        (job) => job && !movement(job.intent) && job.intent.kind !== 'tick',
      )
      this.transport.busy(action?.intent ?? intent)
    }
    void this.drain()
    return promise
  }
  private accept(view: WorldView, reconcile: boolean) {
    if (this.disposed || view.version < this.view.version) return
    this.view = view
    this.transport.accept(view, reconcile)
    if (view.battleSessionId) {
      for (const job of this.queue) job.resolve({ applied: false })
      this.queue = []
    }
  }
  async refresh() {
    if (this.pending || this.disposed) return
    this.running = true
    try {
      this.accept(await this.transport.refresh(), !this.queue.some((job) => movement(job.intent)))
    } catch (error) {
      if (!this.disposed)
        this.transport.error(
          error instanceof Error ? error.message : 'The world could not be refreshed.',
        )
    } finally {
      this.running = false
      this.currentJob = null
      void this.drain()
    }
  }
  private async drain() {
    if (this.running || this.disposed) return
    const job = this.queue.shift()
    if (!job) {
      this.transport.busy(null)
      return
    }
    this.running = true
    this.currentJob = job
    this.transport.busy(job.intent)
    try {
      let view: WorldView
      try {
        view = await this.transport.command(job.intent, this.view)
      } catch (error) {
        if (!(error instanceof WorldConflict)) throw error
        this.accept(await this.transport.refresh(), false)
        if (movement(job.intent) && job.sequence < this.latestMovement) {
          job.resolve({ applied: false })
          return
        }
        view = await this.transport.command(job.intent, this.view)
      }
      const reconcile = !movement(job.intent) || job.sequence === this.latestMovement
      this.accept(view, reconcile && !this.queue.some((next) => movement(next.intent)))
      job.resolve({ applied: true, view })
    } catch (error) {
      if (!this.disposed && (!movement(job.intent) || job.sequence === this.latestMovement)) {
        this.transport.accept(this.view, true)
        this.transport.error(
          error instanceof Error ? error.message : 'Travel is briefly unavailable.',
        )
      }
      job.resolve({ applied: false })
    } finally {
      this.running = false
      this.currentJob = null
      void this.drain()
    }
  }
  dispose() {
    this.disposed = true
    for (const job of this.queue) job.resolve({ applied: false })
    this.queue = []
  }
}
