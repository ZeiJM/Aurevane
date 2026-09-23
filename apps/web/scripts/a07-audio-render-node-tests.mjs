import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  A07_AUDIO_SAMPLE_RATE,
  DISCIPLINE_AUDIO_PROFILES,
  renderA07DisciplineAudio,
} from '../../../scripts/media/render_phase4_audio_v02.mjs'

test('renders 17 distinct Discipline action and Essence families as valid PCM WAVs', () => {
  const output = mkdtempSync(join(tmpdir(), 'aurevane-a07-audio-'))
  try {
    const rows = renderA07DisciplineAudio(output)
    assert.equal(rows.length, 102)
    assert.equal(new Set(rows.map((row) => row.family)).size, 17)
    assert.equal(Object.keys(DISCIPLINE_AUDIO_PROFILES).length, 17)
    assert.equal(new Set(Object.values(DISCIPLINE_AUDIO_PROFILES).map((profile) => profile.recipe)).size, 17)

    const files = readdirSync(output).filter((file) => file.endsWith('.wav'))
    assert.equal(files.length, 102)

    const actionHashes = new Set()
    for (const [family] of Object.entries(DISCIPLINE_AUDIO_PROFILES)) {
      const filename = `${family}-action-v02-1.wav`
      const buffer = readFileSync(join(output, filename))
      assert.equal(buffer.subarray(0, 4).toString('ascii'), 'RIFF')
      assert.equal(buffer.subarray(8, 12).toString('ascii'), 'WAVE')
      assert.equal(buffer.readUInt16LE(20), 1)
      assert.equal(buffer.readUInt16LE(22), 1)
      assert.equal(buffer.readUInt32LE(24), A07_AUDIO_SAMPLE_RATE)
      assert.equal(buffer.readUInt16LE(34), 16)
      assert.ok(statSync(join(output, filename)).size < 65_000)
      actionHashes.add(createHash('sha256').update(buffer).digest('hex'))
    }
    assert.equal(actionHashes.size, 17)

    const essenceFiles = rows.filter((row) => row.role === 'essence')
    assert.equal(essenceFiles.length, 51)
    assert.ok(Math.max(...essenceFiles.map((row) => row.bytes)) < 65_000)
  } finally {
    rmSync(output, { recursive: true, force: true })
  }
})
