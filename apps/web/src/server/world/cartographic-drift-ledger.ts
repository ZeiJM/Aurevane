import 'server-only'

import {
  resolveCartographicDrift,
  type CartographicDriftDefinition,
  type CartographicDriftResolution,
} from './cartographic-drift'

export interface CartographicDriftLedgerEntry {
  definitionId: string
  definitionContentVersion: number
  generationVersion: number
  cycleKey: string
  variantId: string
  variantContentVersion: number
  resolutionId: string
  resolvedAt: string
}

export interface CartographicDriftLedgerStore {
  insertIfAbsent(
    entry: CartographicDriftLedgerEntry,
  ): Promise<{ entry: CartographicDriftLedgerEntry; inserted: boolean }>
}

export class CartographicDriftLedgerConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CartographicDriftLedgerConflictError'
  }
}

function ledgerEntry(
  resolution: CartographicDriftResolution,
  resolvedAt: string,
): CartographicDriftLedgerEntry {
  return {
    definitionId: resolution.definitionId,
    definitionContentVersion: resolution.definitionContentVersion,
    generationVersion: resolution.generationVersion,
    cycleKey: resolution.cycleKey,
    variantId: resolution.variant.id,
    variantContentVersion: resolution.variant.contentVersion,
    resolutionId: resolution.resolutionId,
    resolvedAt,
  }
}

function sameResolution(
  existing: CartographicDriftLedgerEntry,
  candidate: CartographicDriftLedgerEntry,
) {
  return (
    existing.definitionId === candidate.definitionId &&
    existing.definitionContentVersion === candidate.definitionContentVersion &&
    existing.generationVersion === candidate.generationVersion &&
    existing.cycleKey === candidate.cycleKey &&
    existing.variantId === candidate.variantId &&
    existing.variantContentVersion === candidate.variantContentVersion &&
    existing.resolutionId === candidate.resolutionId
  )
}

export async function resolveCartographicDriftCycle(input: {
  definition: CartographicDriftDefinition
  cycleKey: string
  serverSeed: string
  store: CartographicDriftLedgerStore
  resolvedAt?: string
}): Promise<{ entry: CartographicDriftLedgerEntry; replayed: boolean }> {
  const resolution = resolveCartographicDrift({
    definition: input.definition,
    cycleKey: input.cycleKey,
    serverSeed: input.serverSeed,
  })
  const candidate = ledgerEntry(resolution, input.resolvedAt ?? new Date().toISOString())
  const persisted = await input.store.insertIfAbsent(candidate)

  if (!sameResolution(persisted.entry, candidate)) {
    throw new CartographicDriftLedgerConflictError(
      'Cartographic Drift cycle already has a different immutable resolution.',
    )
  }

  return {
    entry: { ...persisted.entry },
    replayed: !persisted.inserted,
  }
}
