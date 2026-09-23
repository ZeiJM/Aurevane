# ART-DISC-006 — Regular Discipline Skill action art, batches 01–04

Status: Owner-approved for implementation on 2026-09-23 after direct visual review in ChatGPT. Owner also authorized production deployment after the approved 40-image set is implemented and verified.

Scope: the first 40 regular Skill illustrations in the 136-image Discipline Skill replacement program:
- Vanguard: all 8 current regular Skills.
- Farstrider: all 8 current regular Skills.
- Shadehand: all 8 current regular Skills.
- Lifebinder: all 8 current regular Skills.
- Ironfist: all 8 current regular Skills.

The earlier rejected fourth-generation attempt is not used. Vital Sever, Searing Bloom and all eight Ironfist illustrations come from the later clean, individually generated 1:1 Run 4 accepted by the Owner.

Visual direction: one standalone square image per Skill; premium dark-fantasy anime RPG action illustration; no grids, collages, panels, embedded text, logos, borders, watermarks or procedural template filler. Generated imagery is presentation-only.

Source method: generated in the Owner's 2026-09-23 ChatGPT art-review session with OpenAI image generation. The accepted first four generation runs produced 40 individual 1254×1254 PNG masters. Runtime derivatives are deterministic 128×128 WebP encodes at quality 82 under `apps/web/public/media/art/discipline-skills/`.

Stable integration: canonical regular Skill IDs and their existing `media.iconKey` hooks remain the source identifiers. `apps/web/src/media/regular-skill-art.ts` maps only the approved 40 IDs. All other regular Skills continue to use the existing generated dark-fantasy fallback until their approved replacement batches are implemented.

Replacement policy: future approved art can replace/version these runtime paths without changing gameplay authority. Artwork does not affect combat rules, AP/MP, targeting, AI, version pinning, persistence or database state.
