# Shared appearance wardrobe review

This slice extends the manual rig from four to 24 cuts. Twenty original vector outfits use separately authored silhouettes, garment shells and overlapping panels: cropped tailoring, broad shoulder layers, robes and skirts, workwear and different armor constructions. All use the same recipe for the portrait, five expressions, compact icon and four-facing gameplay atlas. The shared creator lets a person vary just the silhouette and disables cut/sleeve/accessory conflicts with a reason. NPC and player readers keep their existing recipe contract. Sampled old painted and manual URLs still return byte-for-byte identical art; no existing record or stored URL is rewritten.

## Results

| Requirement | Evidence | Status |
| --- | --- | --- |
| CHR-03 | 20 additional cuts with original shells, overlaps and optional fittings; the comparison fixes identity, fabric palette and fittings so garment geometry is the only variable. | Partial. This is the manual vector rig. Independently adjustable lining, cuffs, layer order, additional body/face controls, and production painted modular coverage are still missing. |
| CHR-04 | 648 four-field recipes attempted, 603 compatible with the actual parser, 603 exact cropped sprite outputs, **570** retained by the more conservative pairwise visual threshold. | Partial. 9,430 below the 10,000 target even if this vector evidence is accepted. The three existing painted presets are unchanged; do not report this as a painted production garment inventory. |
| CHR-05 | 20 controlled outfits and 120 seeded complete looks. 1,001 route checks across the two cohorts and three original painted presets. 0 exact recipe duplicates, 0 exact gameplay pixel duplicates, 9 of 7,140 pairs flagged by the feature proxy (17 of 120 looks), 0 pixel-near pairs at the threshold below. One-click variation on Seed 038 changed the tailed frock to belted overalls, increased its distance from Seed 008 from 1 to 5 and changed 700 gameplay pixels. | Verified for the local manual catalog review. No live or Owner art acceptance claimed. |

Field review uses the east-facing walking atlas frame at 45.6 × 60.8 CSS px (64 px projected tile × runtime scale), and battle uses a south-facing casting frame at 57.53 × 76.70 CSS px (72 px representative battle cell × token and actor factors). The 120 px portrait is the builder's reference rendering size. Browser captures use Chromium 151 at DPR 1. These are representative sizes, since world zoom and battle board cell size vary. The same-palette controlled sheet's closest pair still differed by 410 material/edge pixels in the two gameplay crops combined; the closest outlines differed by 79 alpha-mask pixels. The controlled sheet and seeded pages show original outlines, interior layers and pattern contrast at both scales. The seeded sampler rejects incompatible inputs only; it does not resample duplicates or favor different cuts.

The counter varies only cut, collar, sleeves and hem. It fixes body, hair, palette, closure, pattern and accessories. It rasterizes the garment area (y=19–57 of the rig) from the real gameplay atlas in both representative views and collapses byte-identical raster pairs. In stable catalog order, a recipe is retained only if it differs from *every* previously retained recipe by at least 16 material or edge pixels across the two views. A material difference requires at least 34/255 channel change with both pixels mostly opaque; an edge difference requires at least 34/255 alpha change. This is a reproducible lower bound for the scoped structural inputs, not a combinatorial estimate or a guarantee of human-perceived uniqueness. Closure, pattern, accessory and palette permutations receive no structural count credit. The feature proxy sums the weights of mismatched cut (4), hair (3), dominant palette (3), accessory (2), and textile (1); scores of 2 or less are flagged. Pixel-near pairs differ by fewer than 16 qualifying pixels across the two complete sprites. Both are screening methods; CHR-06's active-identity warning, uniform exception and race acceptance remain outside this slice.

## Reproduce

With repository dependencies and a compatible local Playwright Chromium installed, run from repository root:

```sh
AV_CHROMIUM_EXECUTABLE=/path/to/chromium \
  node apps/web/scripts/appearance-catalog-review.mjs . /tmp/aurevane-wardrobe-review
```

The directory contains `wardrobe-comparison.png`, six `catalog-*.png` sheets, `catalog-samples.json` (seed, exact recipes, asset/count receipts, comparison and variation measures), and desktop/mobile screenshots of the shared dialog. The dialog fixture exercises disabled incompatible choices, variation, undo, preloading the complete image set, confirmation and reopening the chosen design. The callback is isolated and does not write an account or change production state.

## Independent lower garments

Seven short vector tops now support eight independently selected lower constructions. The options include wrapped leggings, cuffed breeches, wide-leg trousers, a pleated kilt, an asymmetric apron, a divided overskirt, armored greaves, and shorts with tall boots. Long and integrated tops cover the layer, so the builder and persisted recipe validator reject those combinations. The builder keeps the lower garment while varying compatible tops. Selecting Original trousers restores the v1 recipe. The new choice is visible in the atlas. Its bust portraits, five expressions and icon use the same pixels as the corresponding upper outfit.

The new v2 recipe appends one lower-garment ID. Both media versions use the same asset reader, and an isolated database run checked the existing approval functions with each version. A v1 look was pinned on admission. A v2 candidate queued during the fight and activated after completion, with the prior battle's pin preserved. The NPC validator accepted the same v2 recipe and rejected an incompatible top. The database rejected a v2 alias for Original trousers. The builder was exercised at 1280 × 860 and 390 × 844, including incompatible options, switching between versions, undo, image loading, confirmation and reopening the chosen recipe.

`lower-garment-comparison.png` holds identity, color, top and fittings constant across eight new choices and the original. The closest pair differed by 305 material or edge pixels across the two gameplay crops. The closest silhouette pair differed by 104 opaque outline pixels. The same command above now includes that sheet, the original 120 seeded looks, and 1,064 route responses.

The expanded inventory uses the prior threshold and preserves the v1 enumeration order. It rasterized 1,827 compatible constructions from 5,832 attempted recipes. The pairwise filter retained **1,794**, comprising 570 v1 and 1,224 v2 constructions. Each retained v2 recipe cleared the same threshold against all earlier v1 and v2 selections. This leaves 8,206 constructions to the 10,000 target. The count covers the vector rig. Independent cuff and lining choices, further layering, and production painted coverage remain open.

## Independent sleeve cuffs

The v3 recipe adds turned-back cuffs, flared cuffs or plated bracers on compatible tops with exposed sleeves. The cuff and lower garment can be selected independently. Selecting the original cuffs returns to the v1 or v2 recipe, depending on the lower garment. The existing player and NPC authority validates the new URLs, and the isolated database tests exercise approval and battle pinning. Existing v1 and v2 fixture assets retain their original bytes.

The catalog review checked 1,092 media responses and confirmed the builder flow at 1280 × 860 and 390 × 844. On the same structural threshold it retained **5,196** of 5,229 compatible constructions, including 3,402 from v3. This leaves 4,804 constructions to the 10,000 target. In the controlled cuff comparison, the closest pair differed by 152 material or edge pixels and the closest silhouettes differed by 17 pixels across the two gameplay crops.

## Expanded sleeve construction catalog

Six additional shapes use the existing cuff slot: overlapping wraps, laced leather guards, segmented vambraces, split bell cuffs, gauntlet cuffs and scalloped cuffs. Each changes the sleeve construction. The three earlier v3 cuffs keep their art and URLs. The migration expands the private recipe allowlist. Player activation and NPC publication use the same authority, and the database regression verifies activation without altering an existing battle pin.

The production renderer and recipe parser accepted 12,033 constructions from 58,320 candidates. The original visual comparison retained **12,000** at the same pairwise threshold, using a fixed body, palette and textile. It counted 570 v1, 1,224 v2 and 10,206 v3 constructions. All 1,134 sampled media requests passed, and the shared builder passed at 1280 × 860 and 390 × 844. The controlled sleeve comparison used the same outfit and lower garment. The closest two drawings differed by 139 material or edge pixels across the field and battle crops. This meets the 10,000-construction requirement for the manual vector rig. The separate production painted asset and layering requirements remain open.
