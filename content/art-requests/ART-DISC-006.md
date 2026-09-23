# ART-DISC-006 — Regular Discipline Skill action art, batches 01–06

Status: Owner-approved for implementation on 2026-09-23 after direct visual review in ChatGPT. The Owner explicitly authorized implementation and production deployment of the approved Chronist batch after verification.

Scope: the first 56 regular Skill illustrations in the 136-image Discipline Skill replacement program:
- Vanguard: all 8 current regular Skills.
- Farstrider: all 8 current regular Skills.
- Shadehand: all 8 current regular Skills.
- Lifebinder: all 8 current regular Skills.
- Ironfist: all 8 current regular Skills.
- Aetherist: all 8 current regular Skills.
- Chronist: all 8 current regular Skills (Temporal Bolt, Haste, Slow, Delay, Rewind Step, Time Lock, Temporal Ward and Stolen Moment).

The earlier rejected fourth-generation attempt is not used. Vital Sever, Searing Bloom and all eight Ironfist illustrations come from the later clean, individually generated 1:1 Run 4 accepted by the Owner. Batch 05 adds Aetherist as one complete Discipline set. Batch 06 adds Chronist as one complete Discipline set using the canonical published Skill IDs.

Visual direction: one standalone square image per Skill; premium dark-fantasy anime RPG action illustration; no grids, collages, panels, embedded text, logos, borders, watermarks or procedural template filler. Generated imagery is presentation-only.

Source method: generated in the Owner's 2026-09-23 ChatGPT art-review session with OpenAI image generation. The accepted first six batches now provide 56 individual 1254×1254 PNG masters. Runtime derivatives are optimized 128×128 WebP encodes under `apps/web/public/media/art/discipline-skills/`.

Stable integration: canonical regular Skill IDs and their existing `media.iconKey` hooks remain the source identifiers. `apps/web/src/media/regular-skill-art.ts` maps only the approved 56 IDs. The remaining 80 regular Skills continue to use the existing generated dark-fantasy fallback until their approved Discipline batches are implemented.

Replacement policy: future approved art can replace/version these runtime paths without changing gameplay authority. Artwork does not affect combat rules, AP/MP, targeting, accuracy, AI, version pinning, persistence, progression or database state.
