import type { LowerGarment } from './appearance-lower-catalog'

// Lower-layer art uses the shared 48 × 64 actor coordinates. Ankles follow the walk
// phase, while waist attachments stay inside the upper shell's existing anchor.
export function renderLowerGarment(
  garment: LowerGarment,
  [fabric, shade, light, trim]: readonly [string, string, string, string],
  skin: string,
  walk: number,
  spread: number,
) {
  const left = 19 - walk * 0.9
  const right = 29 + walk * 0.9
  const outline = '#28242c'
  const shell = (path: string, color: string) =>
    `<path d="${path}" fill="${color}" stroke="${outline}" stroke-width=".95" stroke-linejoin="round"/>`
  const line = (path: string, color: string, width = 1.1) =>
    `<path d="${path}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  const ankles = `M20 41Q19 46 ${left} 54M28 41Q29 46 ${right} 54`
  const boots = shell(
    `M${left - 2.2} 52h4.6l.5 5.8h-8v-2.2Zm${right - left} 0h4.6l2.9 3.6v2.2h-8Z`,
    '#3b2e32',
  )
  const fittedLegs = line(ankles, outline, 6) + line(ankles, shade, 4.3)
  const layers: Record<LowerGarment, () => string> = {
    wraps: () =>
      fittedLegs +
      line(`M${left - 2} 49l4-2m-4 5 4-2m${right - left - 4} -1 4-2m-4 5 4-2`, trim, 1.35) +
      boots,
    breeches: () =>
      fittedLegs +
      shell(`M17 35h14l4 7-1 6-5 1-5-7-5 7-5-1-1-6Z`, fabric) +
      line('M15 47l6 1m6 0 6-1', trim, 1.8) +
      line('M16 40l2 4m14-4-2 4', light) +
      boots,
    wideleg: () =>
      boots +
      shell(
        `M18 35h12l3 6L${right + 5} 55H${right - 5}L24 43 ${left + 5} 55H${left - 5}L15 41Z`,
        fabric,
      ) +
      line(`M19 40L${left - 2.4} 53M29 40L${right + 2.4} 53`, light) +
      line(`M${left - 4} 54h8m${right - left - 8} 0h8`, trim, 1.2),
    kilt: () =>
      fittedLegs +
      boots +
      shell('M17 35h14l7 13-8 2-6-1-6 1-8-2Z', fabric) +
      shell('M22 36h7l3 12-7 1Z', light) +
      line('M18 40l-4 7m7-7-2 8m11-8 4 7', shade, 1.4) +
      line('M11 47l7 2 6-1 6 1 7-2', trim),
    apron: () =>
      fittedLegs +
      boots +
      shell('M16 35h16l3 8-6 12-13-3-4-6Z', shade) +
      shell('M21 36h10l3 7-7 13-7-4Z', fabric) +
      line('M31 39l-1 7-4 8m-10-4 4 2', trim, 1.6),
    divided: () =>
      fittedLegs +
      boots +
      shell(`M17 35h7l-2 9-1 9-7 3-4-3 3-12ZM25 35h6l5 8 3 10-5 3-7-3-1-9Z`, fabric) +
      line('M16 42l-3 11m18-11 4 11', trim, 1.4) +
      line('M20 41l-2 11m10-11 3 11', light),
    greaves: () =>
      fittedLegs +
      boots +
      shell(`M16 43l4-3 4 4-2 4-2 7-5-1 1-8Zm12 1 4-4 4 3v3l1 8-5 1-2-7Z`, light) +
      line('M18 44l2 1 2-1m8 0 2 1 2-1m-15 4-1 5m15-5 1 5', shade, 1.25) +
      line('M16 51h4m12 0h4', trim),
    shorts: () =>
      line(ankles, outline, 5.8) +
      line(ankles, skin, 4.1) +
      shell('M17 35h14l3 9-7 1-3-4-3 4-7-1Z', fabric) +
      shell(
        `M${left - 2.6} 48h4.9l.5 7-1.5 3h-6.5l1.6-3Zm${right - left} 0h4.9l1 7 1.5 3h-7.2l-1-3Z`,
        shade,
      ) +
      line(`M${left - 2.4} 49h4.4m${right - left - 4.4} 0h4.4`, trim, 1.45),
  }
  return `<g transform="translate(24 0) scale(${spread} 1) translate(-24 0)">${layers[garment]()}</g>`
}
