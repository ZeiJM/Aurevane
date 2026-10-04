/** Place a complete reading panel without clipping it or moving the battle layout. */
export function battleInfoPopoverPosition(
  anchor: { right: number; top: number; bottom: number },
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  documentOffset = { x: 0, y: 0 },
  placement: 'auto' | 'above' = 'auto',
) {
  const above = anchor.top - panel.height - 8
  const preferredTop =
    placement === 'above' && above >= 8
      ? above
      : anchor.bottom + panel.height + 16 <= viewport.height
        ? anchor.bottom + 8
        : anchor.top - panel.height - 8
  return {
    left:
      Math.max(8, Math.min(anchor.right - panel.width, viewport.width - panel.width - 8)) +
      documentOffset.x,
    top:
      (panel.height > viewport.height - 16
        ? 8
        : Math.max(8, Math.min(preferredTop, viewport.height - panel.height - 8))) +
      documentOffset.y,
  }
}
