# ART-DISC-001

TYPE: Foundation Discipline sigil suite
SUBJECT: Vanguard, Farstrider, Shadehand, Ironfist, Aetherist, and Lifebinder identity sigils
CONTEXT: Discipline Management launcher, committed Primary/Secondary cards, Discipline roster, and future compact build surfaces. Replace the current temporary inline SVG line art with one coherent production icon family while preserving instant recognition at small sizes.
MOOD: mature tactical fantasy, disciplined, premium, restrained
STYLE: original dark-fantasy game iconography with crisp silhouette-first geometry, tactile material cues, controlled illustrated depth, and no franchise resemblance
COMPOSITION: six square transparent masters with one centered emblem each; strong negative space; readable from approximately 24px through 128px; consistent optical weight and family framing without baking UI chrome into the artwork
SHAPE LANGUAGE: Vanguard — shield/forward blade, stable and weighty; Farstrider — arrow/pathfinder geometry, open and directional; Shadehand — split shadow/precision blade, asymmetrical and elusive; Ironfist — forged impact/anvil-star geometry, compact and forceful without using a generic fist; Aetherist — focused arcane aperture or star-channel geometry, precise rather than explosive; Lifebinder — protective living-knot/renewal geometry, supportive rather than floral decoration
MATERIALS: restrained forged metal, etched stone, dark leather, carved bone or arcane inlay where appropriate; supernatural energy only as a secondary accent
PALETTE: neutral charcoal/steel base with restrained Discipline-specific accents; identity must remain distinguishable without color
LIGHTING: controlled local highlights with clear edge separation on dark and light-adjacent UI surfaces; no bloom that softens silhouette
REQUIRED: coherent family stroke/fill/detail density; transparent background; no text; no letters; no numbers; no logo; no watermark; no signature; readable silhouette at 24px; distinct geometry for every Discipline; accessible recognition must not depend on hue alone
AVOID: generic RPG class badges, mobile-gacha gloss, chibi/cartoon treatment, excessive neon glow, overly thin line art, tiny ornamental clutter, photoreal objects, franchise icon resemblance, or six unrelated visual styles
SOURCE: internally authored scalable vector masters created for the AUREVANE repository; no third-party art, hotlinks, logos, or external copyrighted source material
RUNTIME TARGETS: optimized transparent SVG derivatives under `apps/web/public/media/art/disciplines/`, with deterministic 512×512 dimensions and filenames following the Art Bible naming standard
RUNTIME FILES: `disc_vanguard_icon_v01.svg`, `disc_farstrider_icon_v01.svg`, `disc_shadehand_icon_v01.svg`, `disc_ironfist_icon_v01.svg`, `disc_aetherist_icon_v01.svg`, `disc_lifebinder_icon_v01.svg`
PROVENANCE: internal vector illustration authored specifically for AUREVANE under this engineering batch; stable runtime IDs remain `discipline.foundation.*-sigil`; visual acceptance remains replaceable/versioned through the media pipeline
STATUS: IMPLEMENTED
