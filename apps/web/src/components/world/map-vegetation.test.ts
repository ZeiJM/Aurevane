import { expect, it } from 'vitest'
import { vegetationPose } from './map-vegetation'
it('breaks regular woodland rows with deterministic in-cell feet and varied growth', () => {
  const poses = Array.from({ length: 80 }, (_, i) =>
    vegetationPose('public', i % 10, Math.floor(i / 10), false),
  )
  expect(new Set(poses.map((p) => p.scale)).size).toBeGreaterThan(10)
  expect(new Set(poses.map((p) => p.x)).size).toBeGreaterThan(10)
  for (let i = 0; i < poses.length; i++) {
    const p = poses[i]!
    expect(p).toEqual(vegetationPose('public', i % 10, Math.floor(i / 10), false))
    expect(Math.abs(p.x)).toBeLessThanOrEqual(0.15)
    expect(Math.abs(p.y)).toBeLessThanOrEqual(0.12)
    expect(p.scale).toBeGreaterThanOrEqual(0.78)
    expect(p.scale).toBeLessThanOrEqual(1.18)
  }
  expect(vegetationPose('private', 2, 3, false)).not.toEqual(vegetationPose('public', 2, 3, false))
})
it('keeps authored avenues and landmark-adjacent trees anchored and full-sized', () => {
  for (let x = 0; x < 20; x++)
    expect(vegetationPose('public', x, 5, true)).toEqual({ x: 0, y: 0, scale: 1 })
})

it('varies private growth without moving roots or enlarging crowns over a surveyed landmark', () => {
  const poses = Array.from({ length: 40 }, (_, i) =>
    vegetationPose('void', i % 10, Math.floor(i / 10), false, true),
  )
  for (const p of poses) {
    expect(p.x).toBe(0)
    expect(p.y).toBe(0)
    expect(p.scale).toBeLessThanOrEqual(1)
  }
  expect(new Set(poses.map((p) => p.scale)).size).toBeGreaterThan(5)
})

it('keeps the same public tree growth through wrapped camera representations', () => {
  expect(vegetationPose('public', 2, 3, false)).toEqual(vegetationPose('public', 1666, 3, false))
  expect(vegetationPose('public', 2, 3, false)).toEqual(vegetationPose('public', -1662, 3, false))
})
