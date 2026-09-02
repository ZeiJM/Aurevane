# ART-UI-003

TYPE: Battle command artwork replacement suite
SUBJECT: Inspect, Move, Guard, HP Recovery, and Finish Turn command-card artwork
CONTEXT: Replace low-resolution 160×160 legacy JPEG crops and their SVG framing wrappers with independently composed square masters that remain optically centered in the shared PvP/PvE command cockpit on desktop and mobile. Basic Attack is explicitly excluded because its approved replacement already exists.
MOOD: mature dark fantasy, decisive, supernatural, restrained
STYLE: original dark-fantasy anime illustration with a painterly cel-shaded finish and crisp premium game-art detail
COMPOSITION: exact square masters; one dominant centered subject per action; important details inside a central safe zone; balanced margin on all sides; no composition that depends on runtime overscan or asymmetric cropping
LIGHTING: near-black atmospheric field with controlled semantic rim light and high local subject contrast
PALETTE: Inspect — indigo/icy violet; Move — charcoal/teal; Guard — gunmetal/sapphire; HP Recovery — crimson/red-gold; Finish Turn — antique gold/bronze
REQUIRED: readable at command-card size; coherent anatomy and construction; no clipped focal subject; no text, logo, watermark, signature, border, card chrome, dropdown badge, or other baked-in UI; no franchise resemblance
AVOID: photorealism, chibi treatment, low-detail silhouettes, blurred geometry, excessive bloom, off-center focal points, legacy crop defects
OUTPUT MASTER: five 1254×1254 PNG generation masters retained outside runtime delivery
RUNTIME TARGETS: 1254×1254 WebP at quality 90 under `apps/web/public/media/skills/`, approximately 87–126 KB per image
RUNTIME FILES: `inspect.webp`, `move.webp`, `guard.webp`, `hp-recovery.webp`, `finish-turn.webp`
PROVENANCE: generated with OpenAI image generation in ChatGPT Work on 2026-09-02; each prompt used its corresponding Owner-provided production close-up as a semantic reference and the approved `basic-attack-fist.webp` as a finish/contrast reference; runtime derivatives were deterministically encoded with ImageMagick
STATUS: OWNER-REQUESTED PRODUCTION REVIEW
