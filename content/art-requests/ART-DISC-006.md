# ART-DISC-006 — Regular Discipline Skill action art, batches 01–10

Status: Owner-approved for implementation on 2026-09-23 after direct visual review in ChatGPT. The Owner explicitly authorized implementation of the complete Wildwarden batch. Production deployment is intentionally deferred while the Vercel build-rate limit is active.

Scope: the first 88 regular Skill illustrations in the 136-image Discipline Skill replacement program:
- Vanguard: all 8 current regular Skills.
- Farstrider: all 8 current regular Skills.
- Shadehand: all 8 current regular Skills.
- Lifebinder: all 8 current regular Skills.
- Ironfist: all 8 current regular Skills.
- Aetherist: all 8 current regular Skills.
- Chronist: all 8 current regular Skills.
- Bastion: all 8 current regular Skills (Shield Bash, Cover, Challenge, Fortress, Hold Fast, Shield Line, Stalwart Strike and Steady Footing).
- Ravager: all 8 current regular Skills (Frenzy, Gash, Cleaving Blow, Blood Rush, War Roar, Desperate Execution, Blood Siphon and Open Wound).
- Edgedancer: all 8 current regular Skills (Lunge, Riposte, Hamstring, Flourish, Poised Guard, Flanking Cut, Severing Cut and Finishing Thrust).
- Wildwarden: all 8 current regular Skills (Snare, Hunter's Mark, Venom Shot, Field Remedy, Thorn Line, Pursuit Shot, Renewing Herbs and Close Quarry).

The earlier rejected fourth-generation attempt is not used. Vital Sever, Searing Bloom and all eight Ironfist illustrations come from the later clean, individually generated 1:1 Run 4 accepted by the Owner. Batch 05 adds Aetherist, Batch 06 adds Chronist, and Batch 07 adds Bastion as complete Discipline sets using canonical published Skill IDs.

Bastion v02 refresh: after testing the first Bastion release, the Owner reported that Hold Fast did not present an image in the intended experience and that several Bastion compositions looked too repetitive/carbon-copy. The Owner requested and approved a full eight-image Bastion refresh in the stronger moonlit-gold Bastion visual language. All eight canonical Bastion Skill IDs now point to cache-busting `-v02.webp` runtime derivatives. The earlier Bastion grids/collages, duplicate attempts and v01 runtime mappings are not used by the registry.

Ravager batch: eight separate 1:1 illustrations were approved after an extra distinction pass so each Skill reads as a different action composition while retaining one crimson/black iron berserker identity.

Edgedancer batch: eight separate 1:1 illustrations were approved as a complete Discipline set, using a moonlit blue-black duelist identity with distinct lunging, countering, control, flourish, guard, flanking, severing and finishing compositions.

Wildwarden batch: eight separate 1:1 illustrations were approved as a complete Discipline set, using a dark verdant hooded warden identity with strongly distinct thorn restraint, quarry marking, venom archery, field remedy, thorn-line control, pursuit shot, renewing herbs and close-quarters strike compositions.

Visual direction: one standalone square image per Skill; premium dark-fantasy anime RPG action illustration; no grids, collages, panels, embedded text, logos, borders, watermarks or procedural template filler. Generated imagery is presentation-only.

Source method: generated in the Owner's 2026-09-23 ChatGPT art-review session with OpenAI image generation. The accepted first ten Discipline batches cover 88 regular Skills. Runtime derivatives are optimized 128×128 WebP encodes under `apps/web/public/media/art/discipline-skills/`; Bastion uses v02 paths so stale v01 CDN/browser caches cannot mask the refresh.

Stable integration: canonical regular Skill IDs and their existing `media.iconKey` hooks remain the source identifiers. `apps/web/src/media/regular-skill-art.ts` maps exactly the approved 88 IDs. The remaining 48 regular Skills continue to use the existing generated dark-fantasy fallback until their approved Discipline batches are implemented.

Replacement policy: future approved art can replace/version these runtime paths without changing gameplay authority. Artwork does not affect combat rules, AP/MP, targeting, accuracy, AI, version pinning, persistence, progression or database state.
