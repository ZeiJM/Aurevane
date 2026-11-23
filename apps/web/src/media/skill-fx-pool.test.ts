import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { audioAssetRegistry, skillFxGroups } from '@aurevane/audio'
import assignments from './skill-fx-assignments.json'
import { resolveSkillAudioCueHook, skillAudioCueHookOptions } from './skill-media-hooks'
it('keeps every initial hook on its supplied reusable group and previews the battle group', () => {
  expect(Object.keys(assignments)).toHaveLength(153)
  expect(new Set(Object.values(assignments)).size).toBe(153)
  expect(skillAudioCueHookOptions).toHaveLength(153)
  for (const [hook, group] of Object.entries(assignments)) {
    const option = resolveSkillAudioCueHook(hook)!
    expect(option.audioGroup).toBe(group)
    expect(option.sampleAssetId).toBe(`${group}-1`)
    expect(option.sampleSrc).toBe(audioAssetRegistry.get(`${group}-1`)!.src)
    expect(resolveSkillAudioCueHook(group)?.label).toBe(option.label)
  }
  expect(resolveSkillAudioCueHook('audio.skill-fx.v01.999')).toBeNull()
})
it('ships all runtime derivatives with exact source hashes and leaves all variants lazy', () => {
  const release = JSON.parse(
    readFileSync(resolve('../../content/media-releases/skill-fx-v01.json'), 'utf8'),
  ) as { runtime: { path: string; sha256: string }[]; humanAcceptance: boolean }
  expect(release.humanAcceptance).toBe(false)
  expect(release.runtime).toHaveLength(918)
  for (const file of release.runtime)
    expect(
      createHash('sha256')
        .update(readFileSync(resolve('../..', file.path)))
        .digest('hex'),
    ).toBe(file.sha256)
  for (const group of skillFxGroups)
    for (const variant of [1, 2, 3])
      expect(audioAssetRegistry.get(`${group.key}-${variant}`)?.preload).toBe('none')
})

it('keeps only the new pool under game sound effects and never regenerates the retired pack', () => {
  const release = JSON.parse(
    readFileSync(resolve('../../content/media-releases/skill-fx-v01.json'), 'utf8'),
  ) as { runtime: { path: string }[] }
  const expected = new Set(release.runtime.map((file) => resolve('../..', file.path)))
  const walk = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(resolve(directory, entry.name)) : [resolve(directory, entry.name)],
    )
  expect(new Set(walk(resolve('public/media/audio/sfx')))).toEqual(expected)
  const scripts = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).scripts as Record<
    string,
    string
  >
  expect(scripts.build).not.toContain('render_phase4_audio')
  expect(scripts.dev).not.toContain('render_phase4_audio')
})
