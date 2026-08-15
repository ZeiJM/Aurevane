export type WorkerLogLevel = 'info' | 'error'
export type WorkerLogDetails = Record<string, string | number | boolean | null>
export type WorkerLogWriter = (line: string) => void

export function writeWorkerLog(
  level: WorkerLogLevel,
  event: string,
  details: WorkerLogDetails = {},
  writer: WorkerLogWriter = console.log,
): void {
  writer(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...details,
    }),
  )
}
