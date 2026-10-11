export interface CapturedPercentageRecovery {
  resource: 'hp' | 'mp'
  percent: number
  maximumAtCast: number
  amountPerApplication: number
}

export function percentageRecoveryAmount(maximum: number, percent: number): number {
  return maximum === 0 ? 0 : Math.max(1, Number((BigInt(maximum) * BigInt(percent)) / 100n))
}

export function validateCapturedPercentageRecovery(value: CapturedPercentageRecovery): void {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) => !['resource', 'percent', 'maximumAtCast', 'amountPerApplication'].includes(key),
    ) ||
    !['hp', 'mp'].includes(value.resource) ||
    !Number.isSafeInteger(value.percent) ||
    value.percent < 1 ||
    value.percent > 100 ||
    !Number.isSafeInteger(value.maximumAtCast) ||
    value.maximumAtCast < 0 ||
    !Number.isSafeInteger(value.amountPerApplication) ||
    value.amountPerApplication < 0 ||
    value.amountPerApplication > percentageRecoveryAmount(value.maximumAtCast, value.percent)
  )
    throw new TypeError('Invalid captured percentage recovery.')
}
