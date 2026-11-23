const BASIS = 10_000n

export function formatBattleEffectPercent(value: bigint) {
  const fraction = (value % 100n).toString().padStart(2, '0').replace(/0+$/, '')
  return `${value / 100n}${fraction ? `.${fraction}` : ''}%`
}

/** Exact ratios, with bounded work and the same precision ceiling as native damage. */
export function multiplyBattleEffectRatio(
  numerator: bigint,
  denominator: bigint,
  value: number,
  count: number,
) {
  if (value === 10_000 || numerator === 0n) return [numerator, denominator] as const
  const gcd = (a: bigint, b: bigint): bigint => {
    while (b) [a, b] = [b, a % b]
    return a
  }
  const product = (a: bigint, b: bigint) => {
    const result = a * b
    if (result.toString(2).length > 65_536) throw new RangeError('Unavailable exact total')
    return result
  }
  const multiply = (a: readonly [bigint, bigint], b: readonly [bigint, bigint]) => {
    const x = gcd(a[0], b[1])
    const y = gcd(b[0], a[1])
    return [product(a[0] / x, b[0] / y), product(a[1] / y, b[1] / x)] as const
  }
  const divisor = gcd(BigInt(value), BASIS)
  let factor: readonly [bigint, bigint] = [BigInt(value) / divisor, BASIS / divisor]
  let result: readonly [bigint, bigint] = [numerator, denominator]
  for (let remaining = count; remaining > 0; remaining = Math.floor(remaining / 2)) {
    if (remaining % 2 === 1) result = multiply(result, factor)
    if (remaining > 1) factor = multiply(factor, factor)
  }
  return result
}
