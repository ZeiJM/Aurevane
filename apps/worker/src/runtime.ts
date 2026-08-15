import { writeWorkerLog, type WorkerLogWriter } from './logging.js'

export type WorkerMode = 'once' | 'continuous'

export interface WorkerRuntimeOptions {
  args?: string[]
  writer?: WorkerLogWriter
}

export function resolveWorkerMode(args: string[]): WorkerMode {
  return args.includes('--once') ? 'once' : 'continuous'
}

export async function runWorker(options: WorkerRuntimeOptions = {}): Promise<void> {
  const writer = options.writer ?? console.log
  const mode = resolveWorkerMode(options.args ?? process.argv.slice(2))

  writeWorkerLog('info', 'worker.ready', { mode }, writer)

  if (mode === 'once') {
    return
  }

  await waitForShutdown(writer)
}

function waitForShutdown(writer: WorkerLogWriter): Promise<void> {
  return new Promise((resolve) => {
    const finish = (signal: 'SIGINT' | 'SIGTERM') => {
      process.off('SIGINT', onSigint)
      process.off('SIGTERM', onSigterm)
      writeWorkerLog('info', 'worker.shutdown', { signal }, writer)
      resolve()
    }

    const onSigint = () => finish('SIGINT')
    const onSigterm = () => finish('SIGTERM')

    process.once('SIGINT', onSigint)
    process.once('SIGTERM', onSigterm)
  })
}
