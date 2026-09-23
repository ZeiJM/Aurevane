# ART-WORLD-005 — Highland Road and Northern Pass

Status: original generated implementation candidates; Owner visual acceptance and release remain open.

OpenAI built-in image generation, 2026-09-23. No third-party assets copied. Optimized WebP quality 86; original dimensions. Source and runtime hashes are recorded in provenance.json.

## highland-road

Use case: stylized-concept. Original Aurevane RPG painterly naturalistic fantasy environment, richly tactile but calm and readable. No people, animals, text, grid, labels, icons, UI, border, watermark, settlement, buildings or magical objects. Do not imitate another game. Soft overcast daylight, restrained mature colors. Highland Road approaching Starfall Highlands: weathered violet-grey crags, muted purple heather, olive upland grass, pale worn stone roadway, loose slate and exposed limestone. Asset type: overhead square-grid travel terrain. Full bleed landscape 13:9 ratio, near-top-down orthographic, NO sky or horizon. A STRAIGHT HORIZONTAL road runs left edge to right edge at exactly 50% image height, road band is 11% image height throughout. Clear narrow gravel verges immediately above and below the road. Impassable rugged ridges occupy top and bottom thirds. Keep entire central road empty and evenly wide for gameplay tokens. No diagonal path, river, bridge, ravine or crossing.

Source: exec-bb3df781-bf2c-419e-a7b6-e2e4eef5adda.png.

## highland-road-panorama

Use case: stylized-concept. Original Aurevane RPG painterly naturalistic fantasy environment, richly tactile but calm and readable. No people, animals, text, grid, labels, icons, UI, border, watermark, settlement, buildings or magical objects. Do not imitate another game. Soft overcast daylight, restrained mature colors. Highland Road approaching Starfall Highlands: weathered violet-grey crags, muted purple heather, olive upland grass, pale worn stone roadway, loose slate and exposed limestone. Asset type: seamless full 360-degree EQUIRECTANGULAR environment texture, exact 2:1 ratio, horizon at vertical center, sky upper half and ground lower half. Eye-level from the middle of the road, road stretches away in opposing directions. Continuous natural environment all around camera. Far-left and far-right edges depict the SAME continuous rocks, terrain heights and sky lighting and must join seamlessly when wrapped around a sphere. No frame or diptych or central seam. Keep horizon elevation consistent at both edges. Distant ridgelines and broad open sky; foreground texture detailed but restrained.

Source: exec-50c1c089-b048-48de-bfe0-d5e87e3aaac0.png; wrap repair source: exec-062cc782-e9e7-4dd4-a34b-9c1b49c3565f.png.

## northern-pass

Use case: stylized-concept. Original Aurevane RPG painterly naturalistic fantasy environment, richly tactile but calm and readable. No people, animals, text, grid, labels, icons, UI, border, watermark, settlement, buildings or magical objects. Do not imitate another game. Soft overcast daylight, restrained mature colors. Northern Pass approaching Frostmere: blue-grey mountain stone, layered snowbanks, frost-covered dark rock, sparse low alpine scrub, a cleared gravel-and-stone roadway with light snow at its edges. Soft pearl sky and comfortable cool daylight, no blizzard. Asset type: overhead square-grid travel terrain. Full bleed landscape 13:9 ratio, near-top-down orthographic, NO sky or horizon. A STRAIGHT HORIZONTAL road runs left edge to right edge at exactly 50% image height, road band is 11% image height throughout. Clear narrow gravel verges immediately above and below the road. Impassable rugged ridges occupy top and bottom thirds. Keep entire central road empty and evenly wide for gameplay tokens. No diagonal path, river, bridge, ravine or crossing.

Source: exec-9c6ffd45-e6c3-4e52-873a-e08f45e55451.png.

## northern-pass-panorama

Use case: stylized-concept. Original Aurevane RPG painterly naturalistic fantasy environment, richly tactile but calm and readable. No people, animals, text, grid, labels, icons, UI, border, watermark, settlement, buildings or magical objects. Do not imitate another game. Soft overcast daylight, restrained mature colors. Northern Pass approaching Frostmere: blue-grey mountain stone, layered snowbanks, frost-covered dark rock, sparse low alpine scrub, a cleared gravel-and-stone roadway with light snow at its edges. Soft pearl sky and comfortable cool daylight, no blizzard. Asset type: seamless full 360-degree EQUIRECTANGULAR environment texture, exact 2:1 ratio, horizon at vertical center, sky upper half and ground lower half. Eye-level from the middle of the road, road stretches away in opposing directions. Continuous natural environment all around camera. Far-left and far-right edges depict the SAME continuous rocks, terrain heights and sky lighting and must join seamlessly when wrapped around a sphere. No frame or diptych or central seam. Keep horizon elevation consistent at both edges. Distant ridgelines and broad open sky; foreground texture detailed but restrained.

Source: exec-591a09f1-82e4-459d-b4dd-e19c854a3691.png; wrap repair source: exec-637ef196-0c1b-4e66-9e42-b26821c9d97e.png.

## Wrap retouching

Use case: precise-object-edit. This 2:1 equirectangular 360 panorama has been cyclically shifted so the broken wrap join is the vertical line at EXACT IMAGE CENTER. Repair only the center 15% width, from sky top to foreground bottom, removing the straight stitch. Connect clouds, mountain silhouettes, rocks and ground with natural continuous detail, no vertical tonal divide. Preserve remaining 85% of the scene, exact dimensions, composition, perspective and style. Outer left/right edges already join: keep them untouched. No blur stripe, redesign, text or added objects.

For each panorama, swap the original PNG's two 887-pixel halves. Composite a 360-pixel full-height center strip (x=707) from the generated retouch with 100-pixel smoothstep feathering: alpha = smoothstep(min(1,x/100,(359-x)/100)). Preserve all other pixels. Swap halves back; encode WebP quality 86. Shifted final textures inspected before browser verification.

## Navigation and atmosphere

Both roads use a clear row-4 path, E0 through E12, four seconds per local step, wilderness encounter rules, narrow walkable verges and blocked outer ridges. Highland Road connects Aureth Crown to Starfall Highlands at S14-06; Northern Pass connects Starfall Highlands to Frostmere at S15-04. Highland cloud shadows and restrained pass spindrift respect motion controls/reduced motion. No new lore landmarks, settlements or safety zones. View 360 is an ambient sector view, not per-cell 3D geography.
