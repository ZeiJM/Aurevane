/** Place a complete reading panel without clipping it or moving the battle layout. */
export function battleInfoPopoverPosition(
  anchor: { left?: number; right: number; top: number; bottom: number },
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  documentOffset = { x: 0, y: 0 },
  placement: 'auto' | 'above' | 'beside' = 'auto',
) {
  const above = anchor.top - panel.height - 8
  const preferredTop =
    placement === 'above' && above >= 8
      ? above
      : anchor.bottom + panel.height + 16 <= viewport.height
        ? anchor.bottom + 8
        : anchor.top - panel.height - 8
  const besideLeft = (anchor.left ?? anchor.right) - panel.width - 8
  const top =
    panel.height > viewport.height - 16
      ? 8
      : Math.max(8, Math.min(preferredTop, viewport.height - panel.height - 8))
  // A tall report can fit the viewport but neither side of its image vertically.
  // Keep hover-open readers off their own button so a real click can pin them.
  const overlapsAnchor = top < anchor.bottom && top + panel.height > anchor.top
  const besideRight = anchor.right + 8
  const fitsLeft = besideLeft >= 8 && besideLeft + panel.width <= viewport.width - 8
  const fitsRight = besideRight >= 8 && besideRight + panel.width <= viewport.width - 8
  return {
    left:
      ((placement === 'beside' || overlapsAnchor) && fitsLeft
        ? besideLeft
        : overlapsAnchor && fitsRight
          ? besideRight
          : Math.max(8, Math.min(anchor.right - panel.width, viewport.width - panel.width - 8))) +
      documentOffset.x,
    top: top + documentOffset.y,
  }
}
