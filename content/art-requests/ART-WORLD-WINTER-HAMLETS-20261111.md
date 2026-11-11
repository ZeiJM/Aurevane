# ART-WORLD-WINTER-HAMLETS-20261111

Type: seasonal environment sprite variant, original AI-assisted art.
Subject: existing Hayward farmstead, Millers’ Rest watermill, Thistledown herb cottage/greenhouse and Brookside riverside timber house. Existing names, families and anchors are unchanged.

Nick requested snowy building variants and the winter/river reference direction in the remaining art follow-through. The existing four-building atlas is the identity/edit reference. Built-in image generation produced the transparent winter master with thick settled snow, icicles, dormant plants, frosted glazing and warm windows. No third-party asset or named artist style is used.

Prompt: “Use case: lighting-weather. Edit target: the attached transparent 2x2 game sprite atlas. Create its winter variant for AUREVANE, preserving each of the four exact building identities, architectural silhouettes, isometric viewpoint, arrangement and clean transparent padding. Top left thatched farmstead/hay barn, top right watermill, bottom left herb cottage and glass greenhouse, bottom right timber fisher house with balcony/net/skiff. Add convincing thick settled snow to roof planes, window ledges, fences, barrels and contact ground; icicles under eaves and subtle frost on greenhouse glass; muted dormant plants replacing summer flowers. Keep warm amber windows and fine hand-painted timber/stone textures readable at gameplay scale. No falling snow particles, no background/environment, no new buildings, no text, no watermark, no frame, no cut-off edges. Four separated complete sprites one per equal quadrant with generous transparent gutters and their own grounded snow bases. Use the original atlas as identity reference, retain same relative footprint per sprite. Match mature richly detailed painterly isometric winter-village art, no cartoon styling.”

Source master is committed at `sources/hamlet-buildings-winter-v01.png`,1341×1173 RGBA, SHA256 `1d7b42dac97fca354cc3fa12dec5dc0fee682c99c639f3c531b9cfffa5d77638`.

Reproduce derivative from repository root:

`node tools/pack-hamlet-buildings.mjs content/art-requests/sources/hamlet-buildings-winter-v01.png apps/web/public/media/art/world/runtime/hamlet-buildings-winter-v01.webp`

The packer floors odd source quadrant dimensions (the omitted trailing column is transparent and the trailing row has alpha at most 1/255), alpha-bounds each cell, fits within360×294 and anchors to y313 in384×336 cells. Runtime is768×672 WebP,205970bytes, SHA256 `55346edb7be06767b5141a46a3c9805b46046201a0c7a5b479d356746e107d38`. It is conditionally loaded only for supported public Frostmere hamlets, with current atlas fallback. Source and packed atlas have been inspected; native scale/placement and human acceptance remain pending.
