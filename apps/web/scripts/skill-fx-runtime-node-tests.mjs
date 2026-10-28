import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('delivers only the new compressed sound pool with three variants per group', () => {
  const base = resolve('public/media/audio/sfx')
  assert.deepEqual(readdirSync(base), ['skill-fx-v01'])
  const files = readdirSync(resolve(base, 'skill-fx-v01'))
  assert.equal(files.length, 918)
  for (let group = 1; group <= 153; group++)
    for (const variant of [1, 2, 3]) {
      const name = `${String(group).padStart(3, '0')}-${variant}`
      const ogg = readFileSync(resolve(base, 'skill-fx-v01', `${name}.ogg`))
      const mp3 = readFileSync(resolve(base, 'skill-fx-v01', `${name}.mp3`))
      assert.equal(ogg.subarray(0, 4).toString('ascii'), 'OggS')
      assert.ok(
        mp3.subarray(0, 3).toString('ascii') === 'ID3' ||
          (mp3[0] === 255 && (mp3[1] & 224) === 224),
      )
    }
})
