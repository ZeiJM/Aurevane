import { expect, it } from 'vitest'
import {
  forestCanopy,
  mainlandTreeIndex,
  vegetationPose,
  treeFlex,
  treeWindBend,
} from './map-vegetation'
import { worldWindTarget } from './map-weather'
import { WORLD_MAP_WIDTH } from '@/world/topology'
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

it('mixes mainland woodland silhouettes without changing authored avenues', () => {
  for (const [region, expected] of [
    ['verdant-expanse', [1, 3, 6, 7]],
    ['frostmere', [2, 3]],
    ['glasswind-desert', [4, 5]],
    ['hollow-coast', [3, 6, 7]],
  ] as const) {
    const sample = Array.from({ length: 117 }, (_, i) =>
      mainlandTreeIndex(region, 660 + (i % 13), 305 + Math.floor(i / 13), false),
    )
    expect([...new Set(sample)].sort()).toEqual(expected)
    const signature = mainlandTreeIndex(region, 660, 305, true)
    expect(sample.filter((index) => index === signature).length).toBeGreaterThan(36)
    expect(mainlandTreeIndex(region, 668, 309, true)).toBe(signature)
    expect(mainlandTreeIndex(region, 668 + WORLD_MAP_WIDTH, 309, false)).toBe(sample[60])
  }
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
    expect(Math.abs(storm)).toBeLessThan(0.24)
    expect(treeWindBend(tree.seed, 7300, 0.054, tree.flex, 0)).toBe(0)
  }
})

it('keeps fog nearly still and gives wind and storm clearly stronger canopy motion', () => {
  const peak = (speed: number) =>
    Math.max(
      ...Array.from({ length: 240 }, (_, frame) =>
        Math.abs(treeWindBend(19937, frame * 34, speed, 1.15)),
      ),
    )
  const [fog, clear, overcast, rain, wind, storm] = (
    ['fog', 'clear', 'overcast', 'rain', 'wind', 'storm'] as const
  ).map((weather) => peak(worldWindTarget(weather, 'verdant-expanse'))) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  expect(fog).toBeLessThan(clear)
  expect(clear).toBeLessThan(overcast)
  expect(overcast).toBeLessThan(rain)
  expect(wind).toBeGreaterThan(rain * 2)
  expect(wind).toBeGreaterThan(0.08)
  expect(storm).toBeGreaterThan(wind * 1.15)
  expect(storm).toBeLessThan(0.24)
})

it('eases into and out of sheltered moments without visible snapping between idle frames', () => {
  for (const seed of [197, 571, 5391, 19937, 89121, 706219]) {
    const samples = Array.from({ length: 1800 }, (_, frame) =>
      treeWindBend(seed, frame * 34, 0.065, 1.28, 1.2),
    )
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.025)
    for (let frame = 1; frame < samples.length; frame++)
      expect(Math.abs(samples[frame]! - samples[frame - 1]!)).toBeLessThan(0.012)
  }
})

it('thins crowded Void groves deterministically and uses different silhouettes', () => {
  const sample = (theme: 'haven' | 'amethyst') =>
    Array.from({ length: 117 }, (_, i) =>
      forestCanopy('void:violet-estuary:1:13', i % 13, Math.floor(i / 13), theme),
    )
  const grove = sample('amethyst')
  const visible = grove.filter(({ visible }) => visible)
  expect(grove).toEqual(sample('amethyst'))
  expect(visible.length).toBeGreaterThan(58)
  expect(visible.length).toBeLessThan(94)
  expect(new Set(visible.map(({ index }) => index)).size).toBe(4)
  expect(sample('haven').some(({ index }) => index === 4)).toBe(true)
  expect(
    grove.every(({ x, y, scale }) => Math.abs(x) <= 0.23 && Math.abs(y) <= 0.19 && scale < 1.03),
  ).toBe(true)
})
