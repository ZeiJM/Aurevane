import { defaultBasicSkills } from './combat-basic-actions'

/** The original saved Basic/Support roster, for explicit immutable-capture regression fixtures. */
export function historicalBasicSkills() {
  return defaultBasicSkills()
    .filter((row) => !['basic.pilfer', 'basic.fleetstep', 'basic.invocation'].includes(row.id))
    .map((row) => (row.id === 'basic.guard' ? { ...row, contentVersion: 1, enabled: true } : row))
}
