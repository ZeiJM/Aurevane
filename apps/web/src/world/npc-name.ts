export function worldNpcName(name: string, job: string) {
  return /\([^()]+\)$/.test(name) ? name : `${name} (${job})`
}
