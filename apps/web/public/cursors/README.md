# Owner-provided stone cursor pair

The Owner supplied `image(20261013-142958).png` on October 13, 2026 and requested a site-wide cursor from the supplied artwork. The implementation uses its stone arrow as the default cursor and its matching glowing stone hand for links and buttons. These assets replace the previously approved dark crystal SVG. They are derived from the supplied artwork, not third-party cursor libraries.

Source upload: `/workspace/scratch/76543342efb4/upload/image(20261013-142958).png`.

Source SHA-256: `9660e0a0069a6ee91010f9e735541f455cb5dd9757d002ff83e721788c6c1a0d`.

## Extraction

The built-in `image_gen` tool edited the supplied raster once per asset with `transparent_background: true`. The source was visually inspected first. Each call isolated one subject and removed the checkerboard and the other cursor; no programmatic background removal or replacement artwork was used.

Arrow prompt:

> Use case: background-extraction. Asset type: browser default cursor cutout. Input image 1 is the edit target, a raster image containing two stone cursors on a light checkerboard. Extract ONLY the LEFT stone arrow cursor. Remove the entire RIGHT stone hand and all checkerboard/light background. Return exactly one arrow object on a genuinely transparent alpha background. Preserve the provided arrow design faithfully: the upper-left pointed tip, asymmetric slate/stone arrow silhouette, beveled cracked dark slate gray surface, turquoise glowing fissures, diagonal lower-right stem, existing turquoise edge glow. Preserve orientation, shape, surface detail and colours; do not redraw as a vector, simplify, add decorative elements, change the design or include any hand. Compose the isolated arrow large in a square canvas with modest transparent padding and the full glow intact. No visible checkerboard, no text, no watermarks, no extra objects.

Hand prompt:

> Use case: background-extraction. Asset type: browser interactive hand cursor cutout. Input image 1 is the edit target, a raster image containing two stone cursors on a light checkerboard. Extract ONLY the RIGHT stone pointing hand cursor. Remove the entire LEFT arrow and all checkerboard/light background. Return exactly one hand object on a genuinely transparent alpha background. Preserve the provided hand design faithfully: upright raised index finger with fingertip as click point, curled stone fingers and thumb, cracked dark slate gray carved rock surface, luminous turquoise circular orb in its palm, turquoise glowing fissures and existing turquoise edge glow. Preserve orientation, shape, surface detail and colours; do not redraw as a vector, change the pose, simplify, add decorations or include any arrow. Compose isolated hand large in a square canvas with modest transparent padding and full glow intact. No visible checkerboard, no text, no watermarks, no extra objects.

Successful extraction outputs:

| Asset | Generated output                                                 | SHA-256                                                            |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| Arrow | `generated_images/exec-8c8abc77-ac8d-4622-97bd-9a9dc336d639.png` | `4c067356c83386050ee272d32df44062df4dc83137e247e110eb7b064a554b8e` |
| Hand  | `generated_images/exec-fe24f47d-9d59-4379-95fd-f762b242cda5.png` | `18c4ade40300dc0710fe8856db68336aa435d1356b390936280a595288bc6311` |

## Browser asset pipeline

Sharp preserves the generated alpha channel, crops to the bounds of all pixels with nonzero alpha, resizes proportionally inside 28×28 pixels using Lanczos3, and places the result at (2, 2) on a transparent 32×32 RGBA canvas. Both outputs fit inside 28×28 without changing the supplied orientation. The generated source crop bounds were arrow `(0, 23, 1224, 1231)` and hand `(0, 0, 1240, 1254)`.

| Browser asset     | Size  | Hotspot                   | Purpose                                                  | SHA-256                                                            |
| ----------------- | ----- | ------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| `stone-arrow.png` | 32×32 | (6, 3), visible arrow tip | Page and World map default                               | `4acf75d80abf74f12e6e3b306a82953bb0e605cc5b8b71d144d8a43cb54f4ba6` |
| `stone-hand.png`  | 32×32 | (10, 3), raised fingertip | Enabled links, buttons and ordinary interactive controls | `c6926ece0779336c838bac62dbda86512793bee9a7fac9eec9abd6104aff679f` |

Both hotspot pixels have alpha 255. The arrow contains 571 fully transparent pixels and the hand contains 617. The pair was inspected at native 32 px and nearest-neighbor 8× size. Plain PNG cursor URLs provide the supported browser fallback; unverified cursor `image-set` support is not required.

Global CSS owns `--av-cursor` and `--av-cursor-interactive`. World canvas uses the default arrow. Text entry, disabled, Chronicle help, drag, globe rotation and resize affordances retain their native/specialized cursors. Native World presentation coverage decodes both PNG URLs, checks their dimensions, transparent pixels and visible hotspot pixels, and verifies the default/interactive distinction across public account entry, recovery and authenticated World controls.
