# ART-DISC-006 — Regular Discipline Skill action art, batch 01

Status: Owner-approved for implementation on 2026-09-23 after direct visual review in ChatGPT. Production deployment remains separately Owner-controlled.

Scope: the first 30 regular Skill illustrations in the 136-image Discipline Skill replacement program:
- Vanguard: all 8 current regular Skills.
- Farstrider: all 8 current regular Skills.
- Shadehand: all 8 current regular Skills.
- Lifebinder: Mending Light, Mend, Barrier, Renew, Sanctuary and Fortifying Light.

Vital Sever and Searing Bloom are intentionally not part of this implementation batch. The Owner rejected the attempted fourth generation session after prompt/context drift, so those two Lifebinder Skills remain on the existing procedural fallback until regenerated in a clean session.

Visual direction: one standalone square image per Skill; dark-fantasy anime action illustration; no grids, collages, panels, embedded text, logos, watermarks or procedural template filler. Generated imagery is presentation-only.

Source method: generated in the Owner's 2026-09-23 ChatGPT art-review session with OpenAI image generation. The accepted first three generation runs produced 30 individual 1254×1254 PNG masters. Runtime derivatives are deterministic 192×192 WebP encodes at quality 82 under `apps/web/public/media/art/discipline-skills/`.

Stable integration: canonical regular Skill IDs and their existing `media.iconKey` hooks remain the source identifiers. `apps/web/src/media/regular-skill-art.ts` maps only the approved 30 IDs. All other regular Skills continue to use the existing generated dark-fantasy fallback until their approved replacement batches are implemented.

Replacement policy: future approved art can replace/version these runtime paths without changing gameplay authority. Artwork does not affect combat rules, AP/MP, targeting, AI, version pinning, persistence or database state.
