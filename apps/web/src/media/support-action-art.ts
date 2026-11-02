/** Original artwork for the universal support actions and their moon drake. */
export const SUPPORT_ACTION_ART = [
  {
    id: 'basic.pilfer.icon',
    actionId: 'basic.pilfer',
    name: 'Pilfer',
    src: '/media/art/support/pilfer-v01.webp',
    generationRequestId: 'exec-d9f3f49a-56f3-494e-b8e9-c79792024714',
  },
  {
    id: 'basic.fleetstep.icon',
    actionId: 'basic.fleetstep',
    name: 'Fleetstep',
    src: '/media/art/support/fleetstep-v01.webp',
    generationRequestId: 'exec-6ea5dfcc-88fd-4095-a68f-273a9a089cc5',
  },
  {
    id: 'basic.invocation.icon',
    actionId: 'basic.invocation',
    name: 'Invocation',
    src: '/media/art/support/invocation-v01.webp',
    generationRequestId: 'exec-ed92b01a-9c1f-4343-9d60-7ed982de2147',
  },
] as const
export const VESPER_PORTRAIT_ART = {
  id: 'summon.vesper.portrait',
  src: '/media/art/support/vesper-portrait-v01.webp',
  generationRequestId: 'exec-8554861f-3e67-42fa-b6f2-a9629c32a4c0',
} as const
export function supportActionArtwork(actionId: string): string | null {
  if (actionId === 'summon.vesper.moon-bolt') return VESPER_PORTRAIT_ART.src
  return SUPPORT_ACTION_ART.find((row) => row.actionId === actionId)?.src ?? null
}
export function summonPortraitArtwork(key: string): string | null {
  return key === VESPER_PORTRAIT_ART.id ? VESPER_PORTRAIT_ART.src : null
}
export function isRegisteredSummonPortraitSource(src: string): boolean {
  return src === VESPER_PORTRAIT_ART.src
}
