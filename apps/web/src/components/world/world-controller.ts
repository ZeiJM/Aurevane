import { mergeWorldAttackReceipt, type WorldAttackReceipt } from '@/world/attack-receipt'
import { STEP_MS } from '@/world/catalog'
import { retainWorldSceneReferences } from '@/world/presence'
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
  private idleRead: AbortController | null = null
  private sceneRead: AbortController | null = null
  private lastSceneAt = -Infinity
  private lastSceneSector: string | null = null
  constructor(
    public view: WorldView,
    private transport: {
      command: (intent: WorldIntent, view: WorldView) => Promise<WorldView | WorldAttackReceipt>
      refresh: (signal?: AbortSignal, fullScene?: boolean) => Promise<WorldView>
      accept: (view: WorldView, reconcile: boolean) => void
      presentation?: (view: WorldView) => void
      sceneCovered?: (view: WorldView) => boolean
      error: (message: string) => void
      busy: (intent: WorldIntent | null) => void
    },
  ) {}
  get attackPending() {
    return [this.currentJob, ...this.queue].some((job) => job?.intent.kind === 'attack')
  }
  get pending() {
    return this.running || this.queue.length > 0
  }
  /** A peer-only read cannot replace owned authority or reset its visual clock. */
  acceptPlayers(source: WorldView, players: WorldView['players']) {
    if (
      this.disposed ||
      source.characterId !== this.view.characterId ||
      source.version > this.view.version ||
      source.sectors !== this.view.sectors ||
      source.atlas !== this.view.atlas
    )
      return false
    const moved =
      source.position?.sectorId !== this.view.position?.sectorId ||
      source.position?.x !== this.view.position?.x ||
      source.position?.y !== this.view.position?.y
    this.view = {
      ...this.view,
      players: moved ? players.map((player) => ({ ...player, attackable: false })) : players,
    }
    return true
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
    if (intent.kind !== 'tick' && this.idleRead) {
      const read = this.idleRead
      this.idleRead = null
      this.running = false
      read.abort()
    }
    if (intent.kind === 'attack') {
      // A new encounter intent supersedes unsent walking, but never a write
      // already in flight, an explicit Stop, or another action.
      this.queue = this.queue.filter((job) => {
        if (!['walk', 'autopath'].includes(job.intent.kind)) return true
        job.resolve({ applied: false })
        return false
      })
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
    this.transport.accept(
      view,
      (reconcile && !this.attackPending) || Boolean(view.movementBlocked || view.battleSessionId),
    )
    if (view.battleSessionId) {
      for (const job of this.queue) job.resolve({ applied: false })
      this.queue = []
    }
    // Replan well before the 256-step persistence window ends. All steps still
    // use the normal command channel/deadline; newer clicks and actions win.
    if (
      view.routeDestination &&
      view.route.length > 0 &&
      view.route.length <= 128 &&
      !view.movementBlocked &&
      !view.battleSessionId &&
      (!this.currentJob || this.currentJob.intent.kind === 'tick') &&
      this.queue.length === 0
    ) {
      void this.send(
        view.routeObjectiveId
          ? { kind: 'autopath', objectiveId: view.routeObjectiveId }
          : { kind: 'walk', destination: view.routeDestination },
      )
    }
  }
  /** Scene presentation never occupies or aborts the authority command queue. */
  async hydrate(options: { movement?: boolean } = {}) {
    if (this.disposed || this.sceneRead || !this.transport.presentation) return
    // Ordinary movement already carries owned authority and peers have a
    // separate live channel. Avoid repeatedly downloading/indexing the full
    // atlas while this approved public route is still supplied. Explicit reads,
    // crossings, private discovery, missing terrain and arrival bypass pacing.
    if (
      options.movement &&
      this.view.route.length &&
      this.lastSceneSector === this.view.position.sectorId &&
      Date.now() - this.lastSceneAt < 750 &&
      this.view.sectors.find((sector) => sector.id === this.view.position.sectorId)?.charted &&
      this.transport.sceneCovered?.(this.view) === true &&
      this.view.route
        .slice(0, 8)
        .every((step) =>
          this.view.sectors
            .find((sector) => sector.id === step.position.sectorId)
            ?.cells.some(
              (cell) => cell.x === step.position.x && cell.y === step.position.y && cell.walkable,
            ),
        )
    )
      return
    const read = new AbortController(),
      source = this.view
    this.sceneRead = read
    try {
      const incoming = await this.transport.refresh(read.signal, true)
      if (
        this.disposed ||
        read.signal.aborted ||
        incoming.characterId !== this.view.characterId ||
        incoming.characterId !== source.characterId
      )
        return
      const newerBlocking =
        incoming.version === this.view.version &&
        incoming.serverNow >= this.view.serverNow &&
        (incoming.movementBlocked !== this.view.movementBlocked ||
          incoming.battleSessionId !== this.view.battleSessionId)
      if (incoming.version > this.view.version || newerBlocking) {
        const pendingMovement = [this.currentJob, ...this.queue].some(
          (job) => job && movement(job.intent),
        )
        this.accept(
          incoming,
          Boolean(incoming.movementBlocked || incoming.battleSessionId) || !pendingMovement,
        )
        return
      }
      const position = this.view.position
      if (
        !incoming.sectors.some(
          (sector) =>
            sector.id === position.sectorId &&
            sector.cells.some((cell) => cell.x === position.x && cell.y === position.y),
        )
      )
        return
      if (incoming.version < this.view.version) {
        const previous = new Map(this.view.sectors.map((sector) => [sector.id, sector]))
        const supplied = new Map(incoming.sectors.map((sector) => [sector.id, sector]))
        const walkable = (scene: typeof previous, point: WorldView['position']) =>
          scene
            .get(point.sectorId)
            ?.cells.some((cell) => cell.x === point.x && cell.y === point.y && cell.walkable)
        let from = this.view.position
        for (const step of this.view.route) {
          if (walkable(previous, step.position) && !walkable(supplied, step.position)) return
          const oldSector = previous.get(from.sectorId),
            newSector = supplied.get(from.sectorId)
          const road = oldSector?.exits.find(
            (exit) =>
              exit.from.x === from.x &&
              exit.from.y === from.y &&
              exit.to.sectorId === step.position.sectorId &&
              exit.to.x === step.position.x &&
              exit.to.y === step.position.y &&
              exit.durationMs === step.durationMs,
          )
          if (
            road &&
            !newSector?.exits.some(
              (exit) =>
                exit.from.sectorId === road.from.sectorId &&
                exit.from.x === road.from.x &&
                exit.from.y === road.from.y &&
                exit.to.sectorId === road.to.sectorId &&
                exit.to.x === road.to.x &&
                exit.to.y === road.to.y &&
                exit.durationMs === road.durationMs,
            )
          )
            return
          if (
            from.sectorId === step.position.sectorId &&
            walkable(previous, from) &&
            walkable(previous, step.position) &&
            (oldSector?.stepMs ?? STEP_MS) !== (newSector?.stepMs ?? STEP_MS)
          )
            return
          from = step.position
        }
      }
      const sameVersion = incoming.version === this.view.version
      const peers = new Map(this.view.players.map((player) => [player.characterId, player]))
      const known = (position: WorldView['position']) =>
        incoming.sectors.some(
          (sector) =>
            sector.id === position.sectorId &&
            sector.cells.some((cell) => cell.x === position.x && cell.y === position.y),
        )
      const players = incoming.players.map((player) => {
        const previous = peers.get(player.characterId),
          old = previous?.movement,
          next = player.movement
        const older =
          old &&
          next &&
          (next.version < old.version ||
            (next.version === old.version && next.serverNow < old.serverNow))
        if (
          older &&
          previous &&
          known(previous.position) &&
          old.route.every((step) => known(step.position))
        )
          return sameVersion || !previous.attackable ? previous : { ...previous, attackable: false }
        return { ...player, attackable: sameVersion && player.attackable }
      })
      this.view = retainWorldSceneReferences(this.view, {
        ...this.view,
        sectors: incoming.sectors,
        scenery: incoming.scenery,
        atlas: incoming.atlas,
        players,
        environment: incoming.environment,
        ...(sameVersion
          ? {
              objectives: incoming.objectives,
              interactions: incoming.interactions,
              anchors: incoming.anchors,
              archive: incoming.archive,
              livePresence: incoming.livePresence,
            }
          : {}),
      })
      this.lastSceneAt = Date.now()
      this.lastSceneSector = incoming.position.sectorId
      this.transport.presentation(this.view)
    } catch {
      // Approved movement remains usable; the regular schedule retries presentation.
    } finally {
      if (this.sceneRead === read) this.sceneRead = null
    }
  }
  async refresh(resumeMovement = false) {
    if (this.disposed) return
    if (resumeMovement && this.idleRead) {
      const read = this.idleRead
      this.idleRead = null
      this.running = false
      read.abort()
    }
    if (this.pending || this.disposed) return
    if (
      resumeMovement &&
      this.view.route.length &&
      !this.view.movementBlocked &&
      !this.view.battleSessionId
    ) {
      // A read alone retains the old saved tile while its approved route is due.
      // Settle through the serialized command channel before loading presentation.
      const receipt = await this.send({ kind: 'tick' })
      if (receipt.applied) await this.hydrate()
      return
    }
    const read = new AbortController()
    this.idleRead = read
    this.running = true
    try {
      const view = await this.transport.refresh(read.signal)
      if (this.idleRead === read && !read.signal.aborted) this.accept(view, true)
    } catch (error) {
      if (!this.disposed && this.idleRead === read && !read.signal.aborted)
        this.transport.error(
          error instanceof Error ? error.message : 'The world could not be refreshed.',
        )
    } finally {
      if (this.idleRead === read) {
        this.idleRead = null
        this.running = false
        this.currentJob = null
        void this.drain()
      }
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
      let receipt: WorldView | WorldAttackReceipt,
        source = this.view
      try {
        receipt = await this.transport.command(job.intent, source)
      } catch (error) {
        if (!(error instanceof WorldConflict)) throw error
        this.accept(await this.transport.refresh(), false)
        if (movement(job.intent) && job.sequence < this.latestMovement) {
          job.resolve({ applied: false })
          return
        }
        source = this.view
        receipt = await this.transport.command(job.intent, source)
      }
      const view =
        job.intent.kind === 'attack' && !('version' in receipt)
          ? mergeWorldAttackReceipt(this.view, receipt, source.characterId)
          : (receipt as WorldView)
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
    this.sceneRead?.abort()
    this.sceneRead = null
    this.idleRead?.abort()
    this.idleRead = null
    for (const job of this.queue) job.resolve({ applied: false })
    this.queue = []
  }
}
