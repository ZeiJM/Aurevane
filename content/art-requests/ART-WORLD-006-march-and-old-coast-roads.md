# ART-WORLD-006 — Eastern March Road and Old Coast Road

Status: original generated implementation candidates; Owner visual acceptance and release remain open.

OpenAI built-in image generation, 2026-09-23. No third-party assets copied. Source/runtime hashes, dimensions and sizes are recorded in provenance.json. Optimized runtime assets use WebP quality 86 at original dimensions.

## eastern-march-road

Use case: stylized-concept. Original Aurevane RPG painterly naturalistic fantasy environment, richly tactile but calm and legible. No people, animals, text, labels, grid, UI, border, watermark, settlements or magical objects. Do not imitate existing games. Restrained mature palette, soft overcast daylight, readable terrain. Eastern March Road from Emberreach toward Umbral March. Old pale-grey stone road through weathered charcoal basalt foothills, rusty lichen and olive scrub giving way to dark windswept pine woodland. Ash-brown earth, fern pockets, rugged rocky slopes, muted green-grey mist. Volcanic stone but NO fire or lava. Asset type: overhead square-grid travel terrain. Full bleed landscape 13:9 ratio, near-top-down orthographic with NO sky or horizon. One STRAIGHT HORIZONTAL stone road runs left edge to right edge at exactly 50% image height, clear road band exactly 11% image height throughout. Narrow walkable gravel verges immediately above and below. Impassable boulders and dense tree stands occupy top and bottom thirds. Keep central road empty and consistently wide for gameplay tokens. No diagonal paths, junctions or chasms.

Source: exec-e2c3ca12-32f1-495e-b150-7f378eb2c856.png.

## eastern-march-road-panorama

Use case: stylized-concept. Original Aurevane RPG painterly naturalistic fantasy environment, richly tactile but calm and legible. No people, animals, text, labels, grid, UI, border, watermark, settlements or magical objects. Do not imitate existing games. Restrained mature palette, soft overcast daylight, readable terrain. Eastern March Road from Emberreach toward Umbral March. Old pale-grey stone road through weathered charcoal basalt foothills, rusty lichen and olive scrub giving way to dark windswept pine woodland. Ash-brown earth, fern pockets, rugged rocky slopes, muted green-grey mist. Volcanic stone but NO fire or lava. Asset type: full 360-degree EQUIRECTANGULAR texture, exact 2:1 aspect ratio, horizon at vertical center, upper half sky and lower half ground. Eye-level standing on the stone road, road receding in opposite directions. Continuous surrounding landscape, broad cloudy sky and forested ridges. Far-left and far-right edges must join seamlessly as adjacent columns in the same environment when wrapped on a sphere: match skyline heights, cloud lighting, tree shapes and foreground. No diptych, panels, vignette, dividing lines or central stitch.

Source: exec-41fe3432-b4c6-49b1-bac4-01002da5971e.png; wrap repair source: exec-f8540f76-2b30-4cb0-8945-f7768b6cb5dd.png.

## old-coast-road

Use case: stylized-concept. Original Aurevane RPG painterly naturalistic fantasy environment, richly tactile but calm and legible. No people, animals, text, labels, grid, UI, border, watermark, settlements or magical objects. Do not imitate existing games. Restrained mature palette, soft overcast daylight, readable terrain. Old Coast Road from Hollow Coast toward Umbral March, an INLAND coastal woodland route. Weathered pale cobblestones, salt-worn limestone outcrops, moss, grey-green windswept trees, dark pines and tangled roots. Damp muted earth and low cool silver mist. No sea, river, bridge, water crossing, buildings or new lore landmarks. Asset type: overhead square-grid travel terrain. Full bleed landscape 13:9 ratio, near-top-down orthographic with NO sky or horizon. One STRAIGHT HORIZONTAL stone road runs left edge to right edge at exactly 50% image height, clear road band exactly 11% image height throughout. Narrow walkable gravel verges immediately above and below. Impassable boulders and dense tree stands occupy top and bottom thirds. Keep central road empty and consistently wide for gameplay tokens. No diagonal paths, junctions or chasms.

Source: exec-7964f4f8-41e9-44de-86f7-5223fc1fadc7.png.

## old-coast-road-panorama

Use case: stylized-concept. Original Aurevane RPG painterly naturalistic fantasy environment, richly tactile but calm and legible. No people, animals, text, labels, grid, UI, border, watermark, settlements or magical objects. Do not imitate existing games. Restrained mature palette, soft overcast daylight, readable terrain. Old Coast Road from Hollow Coast toward Umbral March, an INLAND coastal woodland route. Weathered pale cobblestones, salt-worn limestone outcrops, moss, grey-green windswept trees, dark pines and tangled roots. Damp muted earth and low cool silver mist. No sea, river, bridge, water crossing, buildings or new lore landmarks. Asset type: full 360-degree EQUIRECTANGULAR texture, exact 2:1 aspect ratio, horizon at vertical center, upper half sky and lower half ground. Eye-level standing on the stone road, road receding in opposite directions. Continuous surrounding landscape, broad cloudy sky and forested ridges. Far-left and far-right edges must join seamlessly as adjacent columns in the same environment when wrapped on a sphere: match skyline heights, cloud lighting, tree shapes and foreground. No diptych, panels, vignette, dividing lines or central stitch.

Source: exec-78cecc85-4954-484b-979b-f47d89614ab2.png; wrap repair source: exec-87acd1ad-feb5-4fe8-82e6-b3662f056b27.png.

## Panorama wrap retouching

Use case: precise-object-edit. This 2:1 equirectangular 360 panorama has been cyclically shifted so its wrap join is the vertical line at EXACT IMAGE CENTER. Repair only the center 15% width, sky top to foreground bottom, removing the straight stitch and tonal discontinuity. Connect clouds, tree branches, rock contours and ground texture with natural continuous detail. Preserve remaining 85% of image, exact dimensions, composition, perspective and style. Outer left/right edges already join: keep untouched. No blur stripe, redesign, text or added objects.

The first Old Coast retouch was rejected because it retained a sky seam and brightened the scene. Accepted second prompt:

Use case: precise-object-edit. Retouch the supplied panorama. There is a thin straight VERTICAL SEAM precisely at x=50% of the image width, especially visible in the cloudy sky. Remove this seam by repainting a narrow central column from top to bottom with naturally CONTINUOUS clouds, tree branches and stones. No hard straight edges anywhere along this line. Do not retain the input stitching artifact. Keep lighting overcast, grey, no sunlight or warm glow. Preserve the scene's entire left and right sides and exact canvas. This is a small technical stitch repair, not a new painting. No other changes.

Runtime derivative: swap the original PNG's two 887-pixel halves. Composite the generated retouch's 360-pixel full-height center strip at x=707 with 100-pixel smoothstep feathering: alpha = smoothstep(min(1,x/100,(359-x)/100)), where x is local to that strip. Preserve all pixels outside the strip. Swap halves back, encode Sharp WebP quality 86. Inspect shifted final wrap previews before browser acceptance.

## Navigation and atmosphere

Eastern March Road connects Emberreach to Umbral March at S22-08; Old Coast Road connects Hollow Coast to Umbral March at S20-11. Both roads are dry row-4 stone paths, E0–E12, with narrow decorative verges and blocked trees/boulders. Only the 13 stone-road squares are walkable: adjacent cell centres overlap the painted obstacles. Old Coast Road is an inland coastal woodland route without a sea crossing. Local movement is four seconds per square, with existing wilderness encounter rules and ordinary boundary crossings. Slow mist/cloud shadows respect the existing motion controls and reduced-motion preference. No settlement, new named landmark or lore revelation. View 360 is an ambient sector scene, not per-cell 3D geography.
