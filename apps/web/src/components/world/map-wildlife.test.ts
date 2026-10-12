import { describe, expect, it } from 'vitest'
import { wildlifePose, type Wildlife } from './map-ambient'
import { drawWildlife } from './map-wildlife'

const fox: Wildlife = {
  seed: 0,
  index: 4,
  flying: false,
  path: [
    { x: 0.5, y: 0.5 },
    { x: 1.5, y: 0.5 },
  ],
}
const sheet = { width: 1536, height: 1024 } as HTMLImageElement

function paint(animal: Wildlife, now: number, animate = true) {
  type Draw = { matrix: number[]; crop: number[] }
  const draws: Draw[] = [],
    shadows: number[][] = [],
    stack: number[][] = []
  let matrix = [1, 0, 0, 1, 0, 0]
  const transform = (b: number[]) => {
    const a = matrix
    matrix = [
      a[0]! * b[0]! + a[2]! * b[1]!,
      a[1]! * b[0]! + a[3]! * b[1]!,
      a[0]! * b[2]! + a[2]! * b[3]!,
      a[1]! * b[2]! + a[3]! * b[3]!,
      a[0]! * b[4]! + a[2]! * b[5]! + a[4]!,
      a[1]! * b[4]! + a[3]! * b[5]! + a[5]!,
    ]
  }
  const ctx = {
    save: () => stack.push([...matrix]),
    restore: () => {
      matrix = stack.pop()!
    },
    translate: (x: number, y: number) => transform([1, 0, 0, 1, x, y]),
    scale: (x: number, y: number) => transform([x, 0, 0, y, 0, 0]),
    transform: (...values: number[]) => transform(values),
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    clip() {},
    fill() {},
    ellipse: (...values: number[]) => shadows.push(values),
    drawImage: (_image: HTMLImageElement, ...crop: number[]) =>
      draws.push({ matrix: [...matrix], crop }),
  } as unknown as CanvasRenderingContext2D
  drawWildlife(ctx, sheet, animal, wildlifePose(animal, now, animate), 100, 150, 64)
  return { draws, shadows, matrix }
}

describe('original wildlife articulation', () => {
  it('changes ground-leg painting while the body and contact shadow remain grounded', () => {
    const first = paint(fox, 550),
      next = paint(fox, 900)
    expect(first.draws).toHaveLength(5)
    expect(first.draws.slice(0, 4)).not.toEqual(next.draws.slice(0, 4))
    expect(first.draws[4]).toEqual(next.draws[4])
    expect(first.shadows).toEqual(next.shadows)
    const footHeights = [414, 418, 410, 424]
    const feet = first.draws.slice(0, 4).map(({ matrix: m }, i) => m[3]! * footHeights[i]! + m[5]!)
    expect(feet.some((y) => Math.abs(y - 150) < 0.01)).toBe(true)
    expect(feet.some((y) => y < 149)).toBe(true)
    expect(first.matrix).toEqual([1, 0, 0, 1, 0, 0])
  })

  it('leaves idle and motion-disabled animals completely still', () => {
    expect(paint(fox, 2500)).toEqual(paint(fox, 3100))
    expect(paint(fox, 0, false)).toEqual(paint(fox, 16000, false))
  })

  it('uses one cropped bird, articulating its wings independently of its body', () => {
    const bird = { ...fox, flying: true, index: 7 }
    const first = paint(bird, 400),
      next = paint(bird, 510)
    expect(first.draws).toHaveLength(3)
    for (const draw of first.draws) {
      expect(draw.crop[0]).toBe(1152)
      expect(draw.crop[1]).toBe(672)
      expect(draw.crop[2]).toBe(185)
      expect(draw.crop[3]).toBe(210)
    }
    expect(first.draws[0]!.matrix[2]).not.toEqual(next.draws[0]!.matrix[2])
    expect(first.draws[2]!.matrix.slice(0, 4)).toEqual(next.draws[2]!.matrix.slice(0, 4))
    expect(paint(bird, 0, false)).toEqual(paint(bird, 16000, false))
  })

  it('raises and crouches a rabbit above its unchanged contact shadow', () => {
    const rabbit = { ...fox, index: 6 }
    const first = paint(rabbit, 550),
      next = paint(rabbit, 900)
    expect(first.draws).toHaveLength(5)
    expect(first.draws[4]).not.toEqual(next.draws[4])
    expect(first.shadows[0]!.slice(0, 2)).toEqual(next.shadows[0]!.slice(0, 2))
  })
})
