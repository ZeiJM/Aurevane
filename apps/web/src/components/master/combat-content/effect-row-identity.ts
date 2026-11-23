/** Presentation identities never become combat payload fields or change packet order. */
export interface EffectRowIdentity<T> {
  readonly value: readonly T[]
  readonly keys: readonly number[]
  readonly next: number
}
export function reconcileEffectRowIdentity<T>(
  prior: EffectRowIdentity<T>,
  value: readonly T[],
): EffectRowIdentity<T> {
  const used = new Set<number>()
  const keys = value.map((effect) => {
    const index = prior.value.findIndex((candidate, i) => candidate === effect && !used.has(i))
    if (index < 0) return null
    used.add(index)
    return prior.keys[index]!
  })
  const reserved = new Set(keys.filter((key): key is number => key !== null))
  let next = prior.next
  return {
    value,
    keys: keys.map((key, index) => {
      if (key !== null) return key
      const previous = prior.keys[index]
      if (previous !== undefined && !reserved.has(previous)) {
        reserved.add(previous)
        return previous
      }
      return next++
    }),
    next,
  }
}
