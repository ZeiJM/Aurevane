export type ServerLogDetails = Record<string, string | number | boolean | null>

export interface ServerLogger {
  error(event: string, details?: ServerLogDetails): void
}

export const serverLogger: ServerLogger = {
  error(event, details = {}) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        event,
        ...details,
      }),
    )
  },
}
