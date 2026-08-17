#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import process from 'node:process'

import { formatPv1Summary, summarizePv1Sessions } from './pv1-report-lib.mjs'

function printUsage() {
  console.error('Usage: pnpm validation:pv1-report <sessions.json> [--json]')
}

async function main() {
  const args = process.argv.slice(2)
  const inputPath = args.find((arg) => !arg.startsWith('--'))
  const jsonOutput = args.includes('--json')
  const unsupportedFlags = args.filter((arg) => arg.startsWith('--') && arg !== '--json')

  if (!inputPath || unsupportedFlags.length > 0) {
    printUsage()
    process.exitCode = 1
    return
  }

  try {
    const source = await readFile(inputPath, 'utf8')
    const records = JSON.parse(source)
    const summary = summarizePv1Sessions(records)

    if (jsonOutput) {
      console.log(JSON.stringify(summary, null, 2))
      return
    }

    console.log(formatPv1Summary(summary))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`PV-1 report failed: ${message}`)
    process.exitCode = 1
  }
}

await main()
