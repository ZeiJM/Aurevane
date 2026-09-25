import 'server-only'

import { createHash } from 'node:crypto'

export interface AuthoredDriftVariant {
  id: string
  contentVersion: number
}

export interface CartographicDriftDefinition {
  id: string
  contentVersion: number
  generationVersion: number
  variants: readonly AuthoredDriftVariant[]
}

export interface CartographicDriftResolution {
  definitionId: string
  definitionContentVersion: number
  generationVersion: number
  cycleKey: string
  variant: AuthoredDriftVariant
  resolutionId: string
}

export class CartographicDriftError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CartographicDriftError'
  }
}

function stableId(value: string) {
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value)
}

function positiveInteger(value: number) {
  return Number.isInteger(value) && value > 0
}

export function assertCartographicDriftDefinition(definition: CartographicDriftDefinition) {
  if (!stableId(definition.id))
    throw new CartographicDriftError('Drift definition id must be a stable lowercase content id.')
  if (!positiveInteger(definition.contentVersion))
    throw new CartographicDriftError('Drift definition content version must be a positive integer.')
  if (!positiveInteger(definition.generationVersion))
    throw new CartographicDriftError('Drift generation version must be a positive integer.')
  if (!definition.variants.length)
    throw new CartographicDriftError('Drift definitions require at least one authored variant.')

  const ids = new Set<string>()
  for (const variant of definition.variants) {
    if (!stableId(variant.id))
      throw new CartographicDriftError('Drift variant id must be a stable lowercase content id.')
    if (!positiveInteger(variant.contentVersion))
      throw new CartographicDriftError('Drift variant content version must be a positive integer.')
    if (ids.has(variant.id))
      throw new CartographicDriftError('Drift variant ids must be unique within one definition.')
    ids.add(variant.id)
  }
}

export function resolveCartographicDrift(input: {
  definition: CartographicDriftDefinition
  cycleKey: string
  serverSeed: string
}): CartographicDriftResolution {
  assertCartographicDriftDefinition(input.definition)
  if (!input.cycleKey.trim())
    throw new CartographicDriftError('Drift resolution requires a server cadence cycle key.')
  if (!input.serverSeed)
    throw new CartographicDriftError('Drift resolution requires a private server-owned seed.')

  const resolutionHash = createHash('sha256')
    .update(
      JSON.stringify({
        definitionId: input.definition.id,
        definitionContentVersion: input.definition.contentVersion,
        generationVersion: input.definition.generationVersion,
        cycleKey: input.cycleKey,
        serverSeed: input.serverSeed,
      }),
    )
    .digest()
  const index = resolutionHash.readUInt32BE(0) % input.definition.variants.length
  const variant = input.definition.variants[index]!

  return {
    definitionId: input.definition.id,
    definitionContentVersion: input.definition.contentVersion,
    generationVersion: input.definition.generationVersion,
    cycleKey: input.cycleKey,
    variant: { ...variant },
    resolutionId: `sha256:${resolutionHash.toString('hex')}`,
  }
}
