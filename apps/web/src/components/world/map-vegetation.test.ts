import { expect, it } from 'vitest'
import { vegetationPose, treeFlex, treeWindBend } from './map-vegetation'
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

it('gives trees distinct wind strengths and phases, including sheltered still ones', () => {
  const trees = Array.from({ length: 80 }, (_, i) => ({
    seed: i * 971,
    flex: treeFlex('starfall-highlands', i % 11, Math.floor(i / 11), i % 4),
  }))
  expect(trees.some((tree) => tree.flex === 0)).toBe(true)
  expect(trees.some((tree) => tree.flex > 1)).toBe(true)
  const bends = trees.map((tree) => treeWindBend(tree.seed, 7300, 0.045, tree.flex))
  expect(new Set(bends.map((n) => Math.round(n * 10000))).size).toBeGreaterThan(30)
  for (const tree of trees) {
    const clear = treeWindBend(tree.seed, 7300, 0.008, tree.flex)
    const storm = treeWindBend(tree.seed, 7300, 0.054, tree.flex)
    expect(Math.abs(storm)).toBeGreaterThanOrEqual(Math.abs(clear))
    expect(Math.abs(storm)).toBeLessThanOrEqual(0.11)
    expect(treeWindBend(tree.seed, 7300, 0.054, tree.flex, 0)).toBe(0)
  }
})
