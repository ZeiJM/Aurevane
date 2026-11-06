/** Original technique illustrations generated for the November 6 Item presentation batch. */
export const ITEM_TECHNIQUE_ART = [
  ['twinfang-blade', 'Quickstep'],
  ['tower-shield', 'Tower Guard'],
  ['stormcaller-staff', 'Storm Ward'],
  ['emberbrand', 'Kindle'],
].map(([id, alt]) => ({
  id: `item.${id}.technique.art.v1`,
  kind: 'icon' as const,
  status: 'approved' as const,
  requestId: 'ART-ITEM-TECHNIQUE-20261106',
  decorative: false,
  alt: alt!,
  src: `/media/art/items/techniques/${id}-technique-v01.webp`,
  width: 512,
  height: 512,
}))
