import { writeWorkerLog } from './logging.js'
import { runWorker } from './runtime.js'

try {
  await runWorker()
} catch (error) {
  writeWorkerLog('error', 'worker.crashed', {
    errorType: error instanceof Error ? error.name : 'unknown',
  })
  process.exitCode = 1
}
